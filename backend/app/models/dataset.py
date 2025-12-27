from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    owner = relationship("User", back_populates="owned_datasets", foreign_keys=[owner_id])
    items = relationship("DataItem", back_populates="dataset", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="dataset", cascade="all, delete-orphan")
