from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, field_validator

from app.models.data_item import ItemStatus, ItemType


class DataItemResponse(BaseModel):
    id: int
    dataset_id: int
    seq_num: int
    item_type: ItemType
    original_content: Dict[str, Any]
    current_content: Dict[str, Any]
    status: ItemStatus
    is_marked: bool = False
    assigned_to: Optional[int]
    reviewed_by: Optional[int]
    reviewed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    # 计算字段 - 是否有修改
    has_changes: bool = False

    @field_validator("is_marked", mode="before")
    @classmethod
    def set_is_marked_default(cls, v):
        return v if v is not None else False

    class Config:
        from_attributes = True


class DataItemUpdate(BaseModel):
    current_content: Dict[str, Any]
    status: Optional[ItemStatus] = None
    is_marked: Optional[bool] = None
    comment: Optional[str] = None  # 修改说明


class DataItemListResponse(BaseModel):
    items: List[DataItemResponse]
    total: int
    page: int
    page_size: int

    # 统计信息
    pending_count: int = 0
    approved_count: int = 0
    rejected_count: int = 0
    modified_count: int = 0
    marked_count: int = 0
    rejected_count: int = 0
    modified_count: int = 0
