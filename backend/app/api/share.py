from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user
from app.core.database import get_db
from app.models.dataset import Dataset
from app.models.share_link import ShareLink, SharePermission
from app.models.user import User
from app.schemas.share_link import (
    ShareLinkCreate,
    ShareLinkResponse,
    ShareLinkValidation,
)

router = APIRouter()


@router.post("", response_model=ShareLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_share_link(
    share_in: ShareLinkCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建分享链接"""
    # 检查数据集是否存在
    result = await db.execute(select(Dataset).where(Dataset.id == share_in.dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")

    # 检查权限 (只有数据集所有者或管理员可以创建分享链接)
    if dataset.owner_id != current_user.id and current_user.role not in [
        "super_admin",
        "admin",
    ]:
        raise HTTPException(status_code=403, detail="无权限创建分享链接")

    # 创建分享链接
    share_link = ShareLink(
        dataset_id=share_in.dataset_id,
        token=ShareLink.generate_token(),
        permission=share_in.permission,
        expires_at=share_in.expires_at,
        max_access_count=share_in.max_access_count,
        created_by=current_user.id,
    )
    db.add(share_link)
    await db.commit()
    await db.refresh(share_link)

    # 生成完整URL
    base_url = str(request.base_url).rstrip("/")
    response = ShareLinkResponse.model_validate(share_link)
    response.share_url = f"{base_url}/share/{share_link.token}"

    return response


@router.get("/dataset/{dataset_id}", response_model=List[ShareLinkResponse])
async def list_share_links(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取数据集的所有分享链接"""
    result = await db.execute(
        select(ShareLink)
        .where(ShareLink.dataset_id == dataset_id)
        .order_by(ShareLink.created_at.desc())
    )
    share_links = result.scalars().all()
    return share_links


@router.get("/validate/{token}", response_model=ShareLinkValidation)
async def validate_share_link(token: str, db: AsyncSession = Depends(get_db)):
    """验证分享链接"""
    result = await db.execute(select(ShareLink).where(ShareLink.token == token))
    share_link = result.scalar_one_or_none()

    if not share_link:
        return ShareLinkValidation(valid=False, message="分享链接不存在")

    if not share_link.is_valid():
        if not share_link.is_active:
            return ShareLinkValidation(valid=False, message="分享链接已禁用")
        if share_link.expires_at and datetime.utcnow() > share_link.expires_at:
            return ShareLinkValidation(valid=False, message="分享链接已过期")
        if (
            share_link.max_access_count
            and share_link.access_count >= share_link.max_access_count
        ):
            return ShareLinkValidation(valid=False, message="分享链接访问次数已达上限")

    return ShareLinkValidation(
        valid=True, permission=share_link.permission, dataset_id=share_link.dataset_id
    )


@router.post("/access/{token}")
async def access_share_link(token: str, db: AsyncSession = Depends(get_db)):
    """记录分享链接访问"""
    result = await db.execute(select(ShareLink).where(ShareLink.token == token))
    share_link = result.scalar_one_or_none()

    if not share_link or not share_link.is_valid():
        raise HTTPException(status_code=404, detail="分享链接无效")

    # 增加访问计数
    share_link.access_count += 1
    await db.commit()

    return {"dataset_id": share_link.dataset_id, "permission": share_link.permission}


@router.delete("/{share_id}")
async def delete_share_link(
    share_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除/禁用分享链接"""
    result = await db.execute(select(ShareLink).where(ShareLink.id == share_id))
    share_link = result.scalar_one_or_none()

    if not share_link:
        raise HTTPException(status_code=404, detail="分享链接不存在")

    # 只有创建者或管理员可以删除
    if share_link.created_by != current_user.id and current_user.role not in [
        "super_admin",
        "admin",
    ]:
        raise HTTPException(status_code=403, detail="无权限删除")

    share_link.is_active = False
    await db.commit()

    return {"message": "分享链接已禁用"}
