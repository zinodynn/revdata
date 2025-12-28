from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AuthCodeCreate(BaseModel):
    dataset_id: int
    item_start: int
    item_end: int
    permission: str = "edit"
    max_online: int = 1
    max_verify_count: int = 10
    expires_at: Optional[datetime] = None


class AuthCodeResponse(BaseModel):
    id: int
    code: str
    dataset_id: int
    item_start: int
    item_end: int
    permission: str
    max_online: int
    current_online: int
    max_verify_count: int
    verify_count: int
    expires_at: Optional[datetime]
    is_active: bool
    creator_id: int
    created_at: datetime
    reviewed_count: int = 0

    class Config:
        from_attributes = True


class AuthCodeVerifyRequest(BaseModel):
    code: str


class AuthCodeVerifyResponse(BaseModel):
    valid: bool
    message: Optional[str] = None
    dataset_id: Optional[int] = None
    item_start: Optional[int] = None
    item_end: Optional[int] = None
    permission: Optional[str] = None
    session_token: Optional[str] = None


class AuthCodeReviewedItemResponse(BaseModel):
    id: int
    item_id: int
    action: str
    created_at: datetime

    class Config:
        from_attributes = True
