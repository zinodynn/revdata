import enum
from datetime import datetime

from app.core.database import Base
from sqlalchemy import JSON, Boolean, Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship


class ItemType(str, enum.Enum):
    PLAIN = "plain"  # 纯文本语料
    QA = "qa"  # 对话QA语料


class ItemStatus(str, enum.Enum):
    PENDING = "pending"  # 待审核
    APPROVED = "approved"  # 已通过
    REJECTED = "rejected"  # 已拒绝
    MODIFIED = "modified"  # 已修改待复核


class DataItem(Base):
    __tablename__ = "data_items"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    seq_num = Column(Integer, nullable=False)  # 在数据集中的序号
    item_type = Column(SQLEnum(ItemType), default=ItemType.PLAIN)

    # 内容存储 (JSON格式支持多种结构)
    original_content = Column(JSON, nullable=False)  # 原始内容
    current_content = Column(JSON, nullable=False)  # 当前内容 (可能已修改)

    status = Column(SQLEnum(ItemStatus), default=ItemStatus.PENDING)
    is_marked = Column(Boolean, default=False)  # 是否被标记(不确定/待定)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    dataset = relationship("Dataset", back_populates="items")
    assignee = relationship(
        "User", back_populates="assigned_items", foreign_keys=[assigned_to]
    )
    revisions = relationship(
        "Revision", back_populates="item", cascade="all, delete-orphan"
    )

    # 复合索引
    __table_args__ = (
        # Index for pagination within dataset
    )
