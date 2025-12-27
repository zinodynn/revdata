from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"        # 待处理
    IN_PROGRESS = "in_progress"  # 进行中
    COMPLETED = "completed"    # 已完成
    DELEGATED = "delegated"    # 已委派


class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    assigner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 任务范围 (起始和结束序号)
    item_start = Column(Integer, nullable=False)
    item_end = Column(Integer, nullable=False)
    
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING)
    priority = Column(Integer, default=0)  # 0=normal, 1=high, 2=urgent
    note = Column(Text, nullable=True)
    due_date = Column(DateTime, nullable=True)
    
    # 委派记录
    delegated_from_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="tasks")
    assigner = relationship("User", back_populates="created_tasks", foreign_keys=[assigner_id])
    assignee = relationship("User", back_populates="assigned_tasks", foreign_keys=[assignee_id])
    delegated_from = relationship("Task", remote_side=[id])
