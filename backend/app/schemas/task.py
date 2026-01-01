from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.task import TaskStatus


class TaskCreate(BaseModel):
    dataset_id: int
    assignee_id: int
    item_start: int
    item_end: int
    item_ids: Optional[List[int]] = None
    priority: Optional[int] = 0
    note: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskResponse(BaseModel):
    id: int
    dataset_id: int
    assigner_id: int
    assignee_id: int
    item_start: int
    item_end: int
    item_ids: Optional[List[int]] = None
    status: TaskStatus
    priority: int
    note: Optional[str]
    due_date: Optional[datetime]
    created_at: datetime
    completed_at: Optional[datetime]

    # 进度信息
    total_items: int = 0
    reviewed_items: int = 0

    class Config:
        from_attributes = True


class TaskDelegate(BaseModel):
    new_assignee_id: int
    note: Optional[str] = None


class TaskListResponse(BaseModel):
    items: List[TaskResponse]
    total: int
