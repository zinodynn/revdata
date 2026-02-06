"""
Folder management API endpoints.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.dataset import Dataset
from app.models.folder import Folder
from app.models.user import User
from app.schemas.folder import (
    FolderCreate,
    FolderMove,
    FolderResponse,
    FolderTreeNode,
    FolderUpdate,
)

router = APIRouter()

# 最大嵌套层数
MAX_FOLDER_DEPTH = 5


async def get_folder_depth(db: AsyncSession, folder_id: int) -> int:
    """计算目录的嵌套深度"""
    depth = 0
    current_id = folder_id
    
    while current_id is not None and depth < MAX_FOLDER_DEPTH + 1:
        result = await db.execute(
            select(Folder.parent_id).where(Folder.id == current_id)
        )
        row = result.first()
        if row is None:
            break
        current_id = row[0]
        depth += 1
    
    return depth


async def build_folder_tree(
    db: AsyncSession, 
    owner_id: int, 
    parent_id: Optional[int] = None
) -> List[FolderTreeNode]:
    """递归构建目录树"""
    # 获取当前层级的目录
    result = await db.execute(
        select(Folder)
        .where(Folder.owner_id == owner_id)
        .where(Folder.parent_id == parent_id)
        .order_by(Folder.name)
    )
    folders = result.scalars().all()
    
    tree = []
    for folder in folders:
        # 统计该目录下的数据集数量
        count_result = await db.execute(
            select(func.count(Dataset.id))
            .where(Dataset.folder_id == folder.id)
        )
        dataset_count = count_result.scalar() or 0
        
        # 递归获取子目录
        children = await build_folder_tree(db, owner_id, folder.id)
        
        tree.append(FolderTreeNode(
            id=folder.id,
            name=folder.name,
            parent_id=folder.parent_id,
            children=children,
            dataset_count=dataset_count,
        ))
    
    return tree


@router.get("", response_model=List[FolderTreeNode])
async def list_folders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取当前用户的目录树
    """
    tree = await build_folder_tree(db, current_user.id)
    return tree


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    folder_in: FolderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    创建新目录
    """
    # 检查父目录
    if folder_in.parent_id is not None:
        parent_result = await db.execute(
            select(Folder)
            .where(Folder.id == folder_in.parent_id)
            .where(Folder.owner_id == current_user.id)
        )
        parent = parent_result.scalar_one_or_none()
        if parent is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="父目录不存在"
            )
        
        # 检查嵌套深度
        depth = await get_folder_depth(db, folder_in.parent_id)
        if depth >= MAX_FOLDER_DEPTH - 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"目录嵌套层数不能超过 {MAX_FOLDER_DEPTH} 层"
            )
    
    # 检查同级目录名称是否重复
    existing_result = await db.execute(
        select(Folder)
        .where(Folder.owner_id == current_user.id)
        .where(Folder.parent_id == folder_in.parent_id)
        .where(Folder.name == folder_in.name)
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="同级目录下已存在同名目录"
        )
    
    # 创建目录
    folder = Folder(
        name=folder_in.name,
        parent_id=folder_in.parent_id,
        owner_id=current_user.id,
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    
    return folder


@router.get("/{folder_id}", response_model=FolderResponse)
async def get_folder(
    folder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取目录详情
    """
    result = await db.execute(
        select(Folder)
        .where(Folder.id == folder_id)
        .where(Folder.owner_id == current_user.id)
    )
    folder = result.scalar_one_or_none()
    
    if folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="目录不存在"
        )
    
    return folder


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: int,
    folder_in: FolderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    重命名目录
    """
    result = await db.execute(
        select(Folder)
        .where(Folder.id == folder_id)
        .where(Folder.owner_id == current_user.id)
    )
    folder = result.scalar_one_or_none()
    
    if folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="目录不存在"
        )
    
    # 检查同级目录名称是否重复
    existing_result = await db.execute(
        select(Folder)
        .where(Folder.owner_id == current_user.id)
        .where(Folder.parent_id == folder.parent_id)
        .where(Folder.name == folder_in.name)
        .where(Folder.id != folder_id)
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="同级目录下已存在同名目录"
        )
    
    folder.name = folder_in.name
    await db.commit()
    await db.refresh(folder)
    
    return folder


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    删除目录（必须为空）
    """
    result = await db.execute(
        select(Folder)
        .where(Folder.id == folder_id)
        .where(Folder.owner_id == current_user.id)
    )
    folder = result.scalar_one_or_none()
    
    if folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="目录不存在"
        )
    
    # 检查是否有子目录
    children_result = await db.execute(
        select(func.count(Folder.id))
        .where(Folder.parent_id == folder_id)
    )
    if children_result.scalar() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="目录下存在子目录，请先删除子目录"
        )
    
    # 检查是否有数据集
    datasets_result = await db.execute(
        select(func.count(Dataset.id))
        .where(Dataset.folder_id == folder_id)
    )
    if datasets_result.scalar() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="目录下存在数据集，请先移动或删除数据集"
        )
    
    await db.delete(folder)
    await db.commit()


@router.put("/{folder_id}/move", response_model=FolderResponse)
async def move_folder(
    folder_id: int,
    move_in: FolderMove,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    移动目录到其他位置
    """
    result = await db.execute(
        select(Folder)
        .where(Folder.id == folder_id)
        .where(Folder.owner_id == current_user.id)
    )
    folder = result.scalar_one_or_none()
    
    if folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="目录不存在"
        )
    
    # 不能移动到自己或自己的子目录下
    if move_in.parent_id is not None:
        if move_in.parent_id == folder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能将目录移动到自己下面"
            )
        
        # 检查目标是否是自己的子目录
        current_id = move_in.parent_id
        while current_id is not None:
            if current_id == folder_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="不能将目录移动到自己的子目录下"
                )
            parent_result = await db.execute(
                select(Folder.parent_id).where(Folder.id == current_id)
            )
            row = parent_result.first()
            if row is None:
                break
            current_id = row[0]
        
        # 检查目标目录是否存在
        target_result = await db.execute(
            select(Folder)
            .where(Folder.id == move_in.parent_id)
            .where(Folder.owner_id == current_user.id)
        )
        if target_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="目标目录不存在"
            )
        
        # 检查嵌套深度
        depth = await get_folder_depth(db, move_in.parent_id)
        if depth >= MAX_FOLDER_DEPTH - 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"目录嵌套层数不能超过 {MAX_FOLDER_DEPTH} 层"
            )
    
    folder.parent_id = move_in.parent_id
    await db.commit()
    await db.refresh(folder)
    
    return folder
