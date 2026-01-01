import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_auth_code_from_session,
    get_current_user,
    get_optional_user,
    verify_session_token,
)
from app.core.database import get_db
from app.models.auth_code import AuthCode, AuthCodeSession
from app.models.data_item import DataItem, ItemStatus
from app.models.revision import Revision
from app.models.user import User
from app.schemas.data_item import DataItemListResponse, DataItemResponse, DataItemUpdate
from app.utils import normalize_json_keys

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/dataset/{dataset_id}", response_model=DataItemListResponse)
async def list_items(
    dataset_id: int,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[ItemStatus] = None,
    is_marked: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取数据集的语料列表"""
    offset = (page - 1) * page_size

    # 构建查询条件
    conditions = [DataItem.dataset_id == dataset_id]
    if status_filter:
        conditions.append(DataItem.status == status_filter)
    if is_marked is not None:
        conditions.append(DataItem.is_marked == is_marked)

    # 查询总数
    count_result = await db.execute(
        select(func.count(DataItem.id)).where(and_(*conditions))
    )
    total = count_result.scalar()

    # 查询各状态数量
    stats = {}
    for s in ItemStatus:
        stat_result = await db.execute(
            select(func.count(DataItem.id)).where(
                and_(DataItem.dataset_id == dataset_id, DataItem.status == s)
            )
        )
        stats[s.value] = stat_result.scalar()

    # 查询标记数量
    marked_result = await db.execute(
        select(func.count(DataItem.id)).where(
            and_(DataItem.dataset_id == dataset_id, DataItem.is_marked == True)
        )
    )
    marked_count = marked_result.scalar()

    # 查询数据
    result = await db.execute(
        select(DataItem)
        .where(and_(*conditions))
        .order_by(DataItem.seq_num)
        .offset(offset)
        .limit(page_size)
    )
    items = result.scalars().all()

    # 标记是否有修改，并规范化响应中的 JSON 键（移除 BOM 等不可见字符）
    item_responses = []
    for item in items:
        item.original_content = normalize_json_keys(item.original_content)
        item.current_content = normalize_json_keys(item.current_content)
        response = DataItemResponse.model_validate(item)
        response.has_changes = item.original_content != item.current_content
        item_responses.append(response)

    return DataItemListResponse(
        items=item_responses,
        total=total,
        page=page,
        page_size=page_size,
        pending_count=stats.get("pending", 0),
        approved_count=stats.get("approved", 0),
        rejected_count=stats.get("rejected", 0),
        modified_count=stats.get("modified", 0),
        marked_count=marked_count,
    )


@router.get("/{item_id}", response_model=DataItemResponse)
async def get_item(
    item_id: int,
    session_token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
    auth_code: Optional[AuthCode] = Depends(get_auth_code_from_session),
):
    """获取单条语料详情"""
    # 验证权限
    if not current_user and not auth_code:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="需要登录或有效的授权码"
        )

    result = await db.execute(select(DataItem).where(DataItem.id == item_id))
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="语料不存在")

    # 如果是授权码访问，验证范围
    if auth_code:
        if item.dataset_id != auth_code.dataset_id:
            raise HTTPException(status_code=403, detail="授权码无权访问该数据集")

        if auth_code.item_ids:
            if item.id not in auth_code.item_ids:
                raise HTTPException(status_code=403, detail="该语料不在授权范围内")
        elif item.seq_num < auth_code.item_start or item.seq_num > auth_code.item_end:
            raise HTTPException(status_code=403, detail="序号超出授权范围")

    # 规范化返回的 JSON 字段，避免键名中带有 BOM 等不可见字符
    item.original_content = normalize_json_keys(item.original_content)
    item.current_content = normalize_json_keys(item.current_content)
    response = DataItemResponse.model_validate(item)
    response.has_changes = item.original_content != item.current_content
    return response


@router.get("/dataset/{dataset_id}/seq/{seq_num}", response_model=DataItemResponse)
async def get_item_by_seq(
    dataset_id: int,
    seq_num: int,
    session_token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
    auth_code: Optional[AuthCode] = Depends(get_auth_code_from_session),
):
    """根据序号获取语料 - 支持用户认证或session_token认证"""
    # 验证权限
    if not current_user and not auth_code:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="需要登录或有效的授权码"
        )

    # 如果是授权码访问，验证范围
    if auth_code:
        if dataset_id != auth_code.dataset_id:
            raise HTTPException(status_code=403, detail="授权码无权访问该数据集")

        # 优先检查 item_ids
        if auth_code.item_ids:
            # 这里需要查询 seq_num 对应的 item_id 是否在 item_ids 中
            # 但为了性能，我们先查询出 item，再检查 ID
            pass  # 将在查询到 item 后检查
        elif seq_num < auth_code.item_start or seq_num > auth_code.item_end:
            raise HTTPException(status_code=403, detail="序号超出授权范围")

    result = await db.execute(
        select(DataItem).where(
            and_(DataItem.dataset_id == dataset_id, DataItem.seq_num == seq_num)
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="语料不存在")

    # 再次检查授权范围 (针对 item_ids)
    if auth_code and auth_code.item_ids:
        if item.id not in auth_code.item_ids:
            raise HTTPException(status_code=403, detail="该语料不在授权范围内")

    # 规范化返回的 JSON 字段，避免键名中带有 BOM 等不可见字符
    item.original_content = normalize_json_keys(item.original_content)
    item.current_content = normalize_json_keys(item.current_content)
    response = DataItemResponse.model_validate(item)
    response.has_changes = item.original_content != item.current_content
    return response


@router.put("/{item_id}", response_model=DataItemResponse)
async def update_item(
    item_id: int,
    update_data: DataItemUpdate,
    session_token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
    auth_code: Optional[AuthCode] = Depends(get_auth_code_from_session),
):
    """更新语料内容 - 支持用户认证或session_token认证"""
    # 记录请求上下文，帮助排查授权问题
    logger.debug(
        "update_item called",
        extra={
            "item_id": item_id,
            "session_token": session_token,
            "current_user_id": getattr(current_user, "id", None),
            "auth_code_id": getattr(auth_code, "id", None),
        },
    )

    # 验证权限
    if not current_user and not auth_code:
        # 额外检查 session_token 是否存在但已被标记为离开，从而给出更明确的错误提示
        if session_token:
            res = await db.execute(
                select(AuthCodeSession).where(
                    AuthCodeSession.session_token == session_token
                )
            )
            s = res.scalar_one_or_none()
            if s and s.is_left:
                logger.info(
                    "update_item: session token already left",
                    extra={"session_token": session_token, "session_id": s.id},
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="授权会话已结束（session 已离开）",
                )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="需要登录或有效的授权码"
        )

    # 如果是授权码访问，验证权限
    if auth_code and auth_code.permission == "view":
        raise HTTPException(status_code=403, detail="授权码仅有查看权限")

    result = await db.execute(select(DataItem).where(DataItem.id == item_id))
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="语料不存在")

    # 如果是授权码访问，验证范围
    if auth_code:
        if item.dataset_id != auth_code.dataset_id:
            raise HTTPException(status_code=403, detail="授权码无权访问该数据集")

        if auth_code.item_ids:
            if item.id not in auth_code.item_ids:
                raise HTTPException(status_code=403, detail="该语料不在授权范围内")
        elif item.seq_num < auth_code.item_start or item.seq_num > auth_code.item_end:
            raise HTTPException(status_code=403, detail="序号超出授权范围")

    # 创建修改记录（仅登录用户）
    if current_user:
        revision = Revision(
            item_id=item.id,
            user_id=current_user.id,
            previous_content=item.current_content,
            new_content=update_data.current_content,
            comment=update_data.comment,
        )
        db.add(revision)

    # 更新语料
    # 规范化内容以避免键名中携带不可见字符（例如 BOM）导致前端解析问题
    from app.utils import normalize_json_keys

    item.current_content = normalize_json_keys(update_data.current_content)
    if update_data.status:
        item.status = update_data.status
    elif item.current_content != item.original_content:
        # 只有内容真正改变时才设置为 MODIFIED
        item.status = ItemStatus.MODIFIED

    if update_data.is_marked is not None:
        item.is_marked = update_data.is_marked

    if current_user:
        item.reviewed_by = current_user.id
    elif auth_code:
        item.reviewed_by = auth_code.creator_id  # 授权码创建者
    item.reviewed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(item)

    # 规范化返回的 JSON 字段
    item.original_content = normalize_json_keys(item.original_content)
    item.current_content = normalize_json_keys(item.current_content)

    response = DataItemResponse.model_validate(item)
    response.has_changes = item.original_content != item.current_content
    return response


@router.post("/{item_id}/approve", response_model=DataItemResponse)
async def approve_item(
    item_id: int,
    session_token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
    auth_code: Optional[AuthCode] = Depends(get_auth_code_from_session),
):
    """通过语料 - 支持用户认证或session_token认证"""
    # 验证权限
    if not current_user and not auth_code:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="需要登录或有效的授权码"
        )

    if auth_code and auth_code.permission == "view":
        raise HTTPException(status_code=403, detail="授权码仅有查看权限")

    result = await db.execute(select(DataItem).where(DataItem.id == item_id))
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="语料不存在")

    # 如果是授权码访问，验证范围
    if auth_code:
        if item.dataset_id != auth_code.dataset_id:
            raise HTTPException(status_code=403, detail="授权码无权访问该数据集")

        if auth_code.item_ids:
            if item.id not in auth_code.item_ids:
                raise HTTPException(status_code=403, detail="该语料不在授权范围内")
        elif item.seq_num < auth_code.item_start or item.seq_num > auth_code.item_end:
            raise HTTPException(status_code=403, detail="序号超出授权范围")

    item.status = ItemStatus.APPROVED
    if current_user:
        item.reviewed_by = current_user.id
    elif auth_code:
        item.reviewed_by = auth_code.creator_id
    item.reviewed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(item)

    # 规范化返回的 JSON 字段
    item.original_content = normalize_json_keys(item.original_content)
    item.current_content = normalize_json_keys(item.current_content)

    response = DataItemResponse.model_validate(item)
    response.has_changes = item.original_content != item.current_content
    return response


@router.post("/{item_id}/reject", response_model=DataItemResponse)
async def reject_item(
    item_id: int,
    session_token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
    auth_code: Optional[AuthCode] = Depends(get_auth_code_from_session),
):
    """拒绝语料 - 支持用户认证或session_token认证"""
    # 验证权限
    if not current_user and not auth_code:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="需要登录或有效的授权码"
        )

    if auth_code and auth_code.permission == "view":
        raise HTTPException(status_code=403, detail="授权码仅有查看权限")

    result = await db.execute(select(DataItem).where(DataItem.id == item_id))
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="语料不存在")

    # 如果是授权码访问，验证范围
    if auth_code:
        if item.dataset_id != auth_code.dataset_id:
            raise HTTPException(status_code=403, detail="授权码无权访问该数据集")

        if auth_code.item_ids:
            if item.id not in auth_code.item_ids:
                raise HTTPException(status_code=403, detail="该语料不在授权范围内")
        elif item.seq_num < auth_code.item_start or item.seq_num > auth_code.item_end:
            raise HTTPException(status_code=403, detail="序号超出授权范围")

    item.status = ItemStatus.REJECTED
    if current_user:
        item.reviewed_by = current_user.id
    elif auth_code:
        item.reviewed_by = auth_code.creator_id
    item.reviewed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(item)

    # 规范化返回的 JSON 字段
    item.original_content = normalize_json_keys(item.original_content)
    item.current_content = normalize_json_keys(item.current_content)

    response = DataItemResponse.model_validate(item)
    response.has_changes = item.original_content != item.current_content
    return response
