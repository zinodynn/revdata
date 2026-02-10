"""
导入历史记录模型 - 记录每次数据集上传和追加操作
"""
import enum

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String, Text, func
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class ImportOperationType(str, enum.Enum):
    UPLOAD = "upload"  # 初始上传
    APPEND = "append"  # 追加导入


class ImportStatus(str, enum.Enum):
    IMPORTING = "importing"  # 导入中
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"  # 失败


class ImportHistory(Base):
    """导入历史记录"""
    __tablename__ = "import_histories"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    
    # 操作信息
    operation_type = Column(SQLEnum(ImportOperationType), nullable=False)
    filename = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0)  # 字节
    
    # 导入统计
    total_items = Column(Integer, default=0)  # 文件中总条目数
    imported_items = Column(Integer, default=0)  # 实际导入条目数
    skipped_duplicates = Column(Integer, default=0)  # 跳过的重复项
    
    # 状态
    status = Column(SQLEnum(ImportStatus), default=ImportStatus.IMPORTING)
    error_message = Column(Text, nullable=True)
    
    # 去重配置快照
    dedup_config_snapshot = Column(JSON, nullable=True)
    skip_duplicates = Column(Boolean, default=False)  # 是否启用了去重
    
    # 数据项范围（用于撤销/恢复）
    start_seq = Column(Integer, nullable=True)  # 起始 seq_num
    end_seq = Column(Integer, nullable=True)  # 结束 seq_num
    
    # 激活状态（用于撤销）
    is_active = Column(Boolean, default=True)
    
    # 操作人和时间
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="import_histories")
    creator = relationship("User", backref="import_histories")
