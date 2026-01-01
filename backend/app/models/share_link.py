import enum
import secrets
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class SharePermission(str, enum.Enum):
    VIEW = "view"  # 仅查看
    COMMENT = "comment"  # 查看+评论
    EDIT = "edit"  # 查看+编辑


class ShareLink(Base):
    """分享链接"""

    __tablename__ = "share_links"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)

    # 分享令牌
    token = Column(String(64), unique=True, index=True, nullable=False)

    # 权限设置
    permission = Column(
        SQLEnum(SharePermission), default=SharePermission.VIEW, nullable=False
    )

    # 有效期设置
    expires_at = Column(DateTime, nullable=True)  # None 表示永不过期

    # 访问限制
    max_access_count = Column(Integer, nullable=True)  # None 表示无限制
    access_count = Column(Integer, default=0)

    # 创建者
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 状态
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    dataset = relationship("Dataset", backref="share_links")
    creator = relationship("User", backref="created_share_links")

    @classmethod
    def generate_token(cls) -> str:
        """生成随机分享令牌"""
        return secrets.token_urlsafe(32)

    def is_valid(self) -> bool:
        """检查链接是否有效"""
        if not self.is_active:
            return False

        # 检查过期时间
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False

        # 检查访问次数
        if self.max_access_count and self.access_count >= self.max_access_count:
            return False

        return True
