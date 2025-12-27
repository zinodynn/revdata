from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.dataset import DatasetFormat, DatasetStatus


class DatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DatasetResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    format: DatasetFormat
    source_file: Optional[str]
    item_count: int
    owner_id: int
    status: DatasetStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DatasetListResponse(BaseModel):
    items: List[DatasetResponse]
    total: int
    page: int
    page_size: int
