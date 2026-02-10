from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ReferenceDocResponse(BaseModel):
    id: int
    dataset_id: int
    name: str
    file_path: str
    file_type: str
    file_size: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReferenceDocListResponse(BaseModel):
    items: List[ReferenceDocResponse]
    total: int
