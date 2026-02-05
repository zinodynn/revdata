"""
Folder schemas for API request/response validation.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class FolderBase(BaseModel):
    """目录基础字段"""
    name: str = Field(..., min_length=1, max_length=200)
    parent_id: Optional[int] = None


class FolderCreate(FolderBase):
    """创建目录请求"""
    pass


class FolderUpdate(BaseModel):
    """更新目录请求（重命名）"""
    name: str = Field(..., min_length=1, max_length=200)


class FolderMove(BaseModel):
    """移动目录请求"""
    parent_id: Optional[int] = None  # None 表示移动到根目录


class FolderResponse(FolderBase):
    """目录响应"""
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FolderTreeNode(BaseModel):
    """目录树节点（用于前端 Tree 组件）"""
    id: int
    name: str
    parent_id: Optional[int] = None
    children: List["FolderTreeNode"] = []
    dataset_count: int = 0  # 该目录下的数据集数量

    class Config:
        from_attributes = True


# 解决循环引用
FolderTreeNode.model_rebuild()


class DatasetMoveRequest(BaseModel):
    """移动数据集到目录请求"""
    folder_id: Optional[int] = None  # None 表示移动到根目录
