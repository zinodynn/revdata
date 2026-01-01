from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.share_link import SharePermission


class ShareLinkCreate(BaseModel):
    dataset_id: int
    permission: SharePermission = SharePermission.VIEW
    expires_at: Optional[datetime] = None
    max_access_count: Optional[int] = None


class ShareLinkResponse(BaseModel):
    id: int
    dataset_id: int
    token: str
    permission: SharePermission
    expires_at: Optional[datetime]
    max_access_count: Optional[int]
    access_count: int
    is_active: bool
    created_by: int
    created_at: datetime

    # 完整分享URL
    share_url: Optional[str] = None

    class Config:
        from_attributes = True


class ShareLinkValidation(BaseModel):
    """分享链接验证结果"""

    valid: bool
    permission: Optional[SharePermission] = None
    dataset_id: Optional[int] = None
    message: Optional[str] = None
