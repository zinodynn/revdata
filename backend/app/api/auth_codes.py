import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.auth_code import AuthCode, AuthCodeReviewedItem, AuthCodeSession
from app.models.user import User
from app.schemas.auth_code import (
    AuthCodeCreate,
    AuthCodeResponse,
    AuthCodeVerifyResponse,
)

router = APIRouter(prefix="/auth-codes", tags=["auth-codes"])


@router.post("", response_model=AuthCodeResponse)
async def create_auth_code(
    data: AuthCodeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建授权码"""
    # 生成唯一的6位数字码
    for _ in range(10):  # 最多尝试10次
        code = AuthCode.generate_code()
        existing = await db.execute(select(AuthCode).where(AuthCode.code == code))
        if not existing.scalar_one_or_none():
            break
    else:
        raise HTTPException(status_code=500, detail="无法生成唯一授权码")

    auth_code = AuthCode(
        code=code,
        dataset_id=data.dataset_id,
        item_start=data.item_start,
        item_end=data.item_end,
        item_ids=data.item_ids,
        permission=data.permission,
        max_online=data.max_online,
        max_verify_count=data.max_verify_count,
        expires_at=data.expires_at,
        creator_id=current_user.id,
    )
    db.add(auth_code)
    await db.commit()
    await db.refresh(auth_code)

    return AuthCodeResponse(
        **{k: v for k, v in auth_code.__dict__.items() if not k.startswith("_")},
        reviewed_count=0,
    )


@router.get("/dataset/{dataset_id}", response_model=List[AuthCodeResponse])
async def list_auth_codes(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取数据集的授权码列表"""
    query = (
        select(AuthCode, func.count(AuthCodeReviewedItem.id).label("reviewed_count"))
        .outerjoin(AuthCodeReviewedItem)
        .where(AuthCode.dataset_id == dataset_id)
        .where(AuthCode.creator_id == current_user.id)
        .group_by(AuthCode.id)
        .order_by(AuthCode.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    return [
        AuthCodeResponse(
            **{k: v for k, v in row[0].__dict__.items() if not k.startswith("_")},
            reviewed_count=row[1],
        )
        for row in rows
    ]


@router.post("/{code}/verify", response_model=AuthCodeVerifyResponse)
async def verify_auth_code(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """验证授权码"""
    result = await db.execute(select(AuthCode).where(AuthCode.code == code))
    auth_code = result.scalar_one_or_none()

    if not auth_code:
        return AuthCodeVerifyResponse(valid=False, message="授权码不存在")

    if not auth_code.is_active:
        return AuthCodeVerifyResponse(valid=False, message="授权码已被撤销")

    # 检查过期
    if auth_code.expires_at and auth_code.expires_at < datetime.now(timezone.utc):
        return AuthCodeVerifyResponse(valid=False, message="授权码已过期")

    # 检查验证次数
    if auth_code.verify_count >= auth_code.max_verify_count:
        return AuthCodeVerifyResponse(valid=False, message="授权码验证次数已用尽")

    # 检查在线数
    if auth_code.current_online >= auth_code.max_online:
        return AuthCodeVerifyResponse(valid=False, message="授权码在线人数已满")

    # 更新验证次数
    auth_code.verify_count += 1
    auth_code.current_online += 1

    # 创建会话
    session_token = secrets.token_hex(32)
    session = AuthCodeSession(
        auth_code_id=auth_code.id,
        session_token=session_token,
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(session)
    await db.commit()

    # log created session info
    try:
        import logging

        logger = logging.getLogger(__name__)
        logger.info(
            "auth_code verify created session",
            extra={
                "code": code,
                "auth_code_id": auth_code.id,
                "session_token": session_token,
                "expires_at": session.expires_at,
            },
        )
    except Exception:
        pass

    return AuthCodeVerifyResponse(
        valid=True,
        dataset_id=auth_code.dataset_id,
        item_start=auth_code.item_start,
        item_end=auth_code.item_end,
        item_ids=auth_code.item_ids,
        permission=auth_code.permission,
        session_token=session_token,
    )


@router.delete("/{auth_code_id}")
async def revoke_auth_code(
    auth_code_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """撤销授权码"""
    result = await db.execute(
        select(AuthCode).where(
            AuthCode.id == auth_code_id,
            AuthCode.creator_id == current_user.id,
        )
    )
    auth_code = result.scalar_one_or_none()

    if not auth_code:
        raise HTTPException(status_code=404, detail="授权码不存在")

    auth_code.is_active = False
    await db.commit()

    return {"message": "授权码已撤销"}


@router.post("/session/leave")
async def leave_session(
    session_token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    """离开会话，释放在线计数

    Accepts session_token either as query parameter or JSON body {"session_token": "..."}.
    If missing, returns a harmless message instead of 422 to avoid failed unload flows.
    """
    # 尝试从 JSON body 中获取 session_token（兼容 sendBeacon）
    if not session_token and request is not None:
        try:
            payload = await request.json()
            if isinstance(payload, dict):
                session_token = payload.get("session_token")
        except Exception:
            pass

    if not session_token:
        return {"message": "no session_token provided"}

    result = await db.execute(
        select(AuthCodeSession).where(AuthCodeSession.session_token == session_token)
    )
    session = result.scalar_one_or_none()

    if not session:
        return {"message": "会话不存在"}

    if session.is_left:
        return {"message": "会话已离开"}

    # 标记会话已离开
    session.is_left = True

    # 减少在线计数
    auth_code = await db.get(AuthCode, session.auth_code_id)
    if auth_code and auth_code.current_online > 0:
        auth_code.current_online -= 1

    await db.commit()

    return {"message": "已离开会话"}


@router.post("/{code}/record-review")
async def record_review(
    code: str,
    item_id: int,
    action: str,
    session_token: str = None,
    db: AsyncSession = Depends(get_db),
):
    """记录授权审核操作"""
    result = await db.execute(select(AuthCode).where(AuthCode.code == code))
    auth_code = result.scalar_one_or_none()

    if not auth_code:
        raise HTTPException(status_code=404, detail="授权码不存在")

    # 检查是否已记录
    existing = await db.execute(
        select(AuthCodeReviewedItem).where(
            AuthCodeReviewedItem.auth_code_id == auth_code.id,
            AuthCodeReviewedItem.item_id == item_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"message": "已记录"}

    reviewed = AuthCodeReviewedItem(
        auth_code_id=auth_code.id,
        item_id=item_id,
        action=action,
    )
    db.add(reviewed)
    await db.commit()

    return {"message": "记录成功"}


@router.get("/{code}/reviewed")
async def get_reviewed_items(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取授权码的审核记录"""
    result = await db.execute(
        select(AuthCode).where(
            AuthCode.code == code,
            AuthCode.creator_id == current_user.id,
        )
    )
    auth_code = result.scalar_one_or_none()

    if not auth_code:
        raise HTTPException(status_code=404, detail="授权码不存在")

    result = await db.execute(
        select(AuthCodeReviewedItem)
        .where(AuthCodeReviewedItem.auth_code_id == auth_code.id)
        .order_by(AuthCodeReviewedItem.created_at.desc())
    )
    items = result.scalars().all()

    return items
