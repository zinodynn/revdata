from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class ReferenceDoc(Base):
    __tablename__ = "reference_docs"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)  # 文档显示名称
    file_path = Column(String(500), nullable=False)  # 存储路径(相对 UPLOAD_DIR)
    file_type = Column(String(50), nullable=False)  # pdf/doc/docx
    file_size = Column(Integer, default=0)  # 文件大小(字节)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    dataset = relationship("Dataset", back_populates="reference_docs")
