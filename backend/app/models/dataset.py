import enum
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class DatasetFormat(str, enum.Enum):
    JSONL = "jsonl"
    JSON = "json"
    CSV = "csv"
    TSV = "tsv"
    PARQUET = "parquet"


class DatasetStatus(str, enum.Enum):
    IMPORTING = "importing"
    READY = "ready"
    REVIEWING = "reviewing"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class DisplayMode(str, enum.Enum):
    """显示模式"""

    CONVERSATION = "conversation"  # 对话模式(messages格式)
    QA_PAIR = "qa_pair"  # 问答对模式
    PLAIN = "plain"  # 纯文本模式
    AUTO = "auto"  # 自动检测


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    format = Column(SQLEnum(DatasetFormat), nullable=False)
    source_file = Column(String(500), nullable=True)
    item_count = Column(Integer, default=0)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(SQLEnum(DatasetStatus), default=DatasetStatus.IMPORTING)

    # 字段映射配置 (管理员配置)
    # {
    #   "question_field": "instruction",     # 问题/用户输入字段
    #   "answer_field": "output",            # 回答/助手输出字段
    #   "thinking_field": "reasoning",       # 思考过程字段(可选)
    #   "context_field": "system_prompt",    # 上下文/系统提示(可选)
    #   "messages_field": "messages",        # 对话消息数组字段
    #   "metadata_fields": ["source", "id"], # 元数据字段(显示但不可编辑)
    #   "display_mode": "conversation",      # 显示模式
    #   "detected_fields": ["instruction", "output", "source"] # 系统检测到的字段
    # }
    field_mapping = Column(JSON, nullable=True, default=None)

    # 审核规则配置
    # {
    #   "require_reason": false,      # 是否必须填写拒绝原因
    #   "allow_edit": true,           # 是否允许编辑
    #   "review_mode": "single",      # single/double 单次/双重审核
    #   "auto_approve_after": null,   # 自动通过时间(分钟)
    # }
    review_config = Column(JSON, nullable=True, default=None)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship(
        "User", back_populates="owned_datasets", foreign_keys=[owner_id]
    )
    items = relationship(
        "DataItem", back_populates="dataset", cascade="all, delete-orphan"
    )
    tasks = relationship("Task", back_populates="dataset", cascade="all, delete-orphan")
    auth_codes = relationship(
        "AuthCode", back_populates="dataset", cascade="all, delete-orphan"
    )
