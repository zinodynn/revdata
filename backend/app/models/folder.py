"""
Folder model for organizing datasets into hierarchical directories.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class Folder(Base):
    """
    数据集目录模型
    - 支持多层嵌套结构（最大5层）
    - 每个用户独立的目录结构
    - 禁止删除非空目录
    """
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 自关联：父目录 - 子目录
    parent = relationship(
        "Folder",
        remote_side=[id],
        back_populates="children",
        foreign_keys=[parent_id]
    )
    children = relationship(
        "Folder",
        back_populates="parent",
        foreign_keys=[parent_id],
        cascade="all, delete-orphan"
    )

    # 关联：所有者
    owner = relationship("User", back_populates="folders")

    # 关联：目录下的数据集
    datasets = relationship("Dataset", back_populates="folder")
