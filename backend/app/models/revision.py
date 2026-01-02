from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Revision(Base):
    """修改版本记录 - 保存每次修改的历史"""

    __tablename__ = "revisions"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("data_items.id"), nullable=False, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # 修改内容
    previous_content = Column(JSON, nullable=False)  # 修改前内容
    new_content = Column(JSON, nullable=False)  # 修改后内容
    diff_data = Column(JSON, nullable=True)  # 差异数据 (可选,用于快速渲染)

    # 修改说明
    comment = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    item = relationship("DataItem", back_populates="revisions")
    user = relationship("User", back_populates="revisions")
