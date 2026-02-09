"""
导入历史 schemas
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ImportHistoryResponse(BaseModel):
    id: int
    dataset_id: int
    operation_type: str
    filename: str
    file_size: int
    total_items: int
    imported_items: int
    skipped_duplicates: int
    status: str
    error_message: Optional[str]
    dedup_config_snapshot: Optional[dict]
    skip_duplicates: bool
    start_seq: Optional[int]
    end_seq: Optional[int]
    is_active: bool
    created_by: int
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ImportHistoryListResponse(BaseModel):
    items: list[ImportHistoryResponse]
    total: int
