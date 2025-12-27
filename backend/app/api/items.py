from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.models.user import User
from app.models.data_item import DataItem, ItemStatus
from app.models.revision import Revision
from app.schemas.data_item import DataItemResponse, DataItemUpdate, DataItemListResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/dataset/{dataset_id}", response_model=DataItemListResponse)
async def list_items(
    dataset_id: int,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[ItemStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取数据集的语料列表"""
    offset = (page - 1) * page_size
    
    # 构建查询条件
    conditions = [DataItem.dataset_id == dataset_id]
    if status_filter:
        conditions.append(DataItem.status == status_filter)
    
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
    
    # 查询数据
    result = await db.execute(
        select(DataItem)
        .where(and_(*conditions))
        .order_by(DataItem.seq_num)
        .offset(offset)
        .limit(page_size)
    )
    items = result.scalars().all()
    
    # 标记是否有修改
    item_responses = []
    for item in items:
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
        modified_count=stats.get("modified", 0)
    )


@router.get("/{item_id}", response_model=DataItemResponse)
async def get_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取单条语料详情"""
    result = await db.execute(select(DataItem).where(DataItem.id == item_id))
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="语料不存在"
        )
    
    response = DataItemResponse.model_validate(item)
    response.has_changes = item.original_content != item.current_content
    return response


@router.get("/dataset/{dataset_id}/seq/{seq_num}", response_model=DataItemResponse)
async def get_item_by_seq(
    dataset_id: int,
    seq_num: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """根据序号获取语料"""
    result = await db.execute(
        select(DataItem).where(
            and_(DataItem.dataset_id == dataset_id, DataItem.seq_num == seq_num)
        )
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="语料不存在"
        )
    
    response = DataItemResponse.model_validate(item)
    response.has_changes = item.original_content != item.current_content
    return response


@router.put("/{item_id}", response_model=DataItemResponse)
async def update_item(
    item_id: int,
    update_data: DataItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新语料内容"""
    result = await db.execute(select(DataItem).where(DataItem.id == item_id))
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="语料不存在"
        )
    
    # 创建修改记录
    revision = Revision(
        item_id=item.id,
        user_id=current_user.id,
        previous_content=item.current_content,
        new_content=update_data.current_content,
        comment=update_data.comment
    )
    db.add(revision)
    
    # 更新语料
    item.current_content = update_data.current_content
    if update_data.status:
        item.status = update_data.status
    else:
        item.status = ItemStatus.MODIFIED
    item.reviewed_by = current_user.id
    item.reviewed_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(item)
    
    response = DataItemResponse.model_validate(item)
    response.has_changes = item.original_content != item.current_content
    return response


@router.post("/{item_id}/approve", response_model=DataItemResponse)
async def approve_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """通过语料"""
    result = await db.execute(select(DataItem).where(DataItem.id == item_id))
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="语料不存在"
        )
    
    item.status = ItemStatus.APPROVED
    item.reviewed_by = current_user.id
    item.reviewed_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(item)
    
    response = DataItemResponse.model_validate(item)
    response.has_changes = item.original_content != item.current_content
    return response


@router.post("/{item_id}/reject", response_model=DataItemResponse)
async def reject_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """拒绝语料"""
    result = await db.execute(select(DataItem).where(DataItem.id == item_id))
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="语料不存在"
        )
    
    item.status = ItemStatus.REJECTED
    item.reviewed_by = current_user.id
    item.reviewed_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(item)
    
    response = DataItemResponse.model_validate(item)
    response.has_changes = item.original_content != item.current_content
    return response
