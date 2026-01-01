import random
import string

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AuthCode(Base):
    """授权码模型 - 6位数字验证码"""

    __tablename__ = "auth_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(6), unique=True, index=True, nullable=False)  # 6位数字授权码

    # 关联数据集和范围
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    item_start = Column(Integer, nullable=False)  # 起始序号
    item_end = Column(Integer, nullable=False)  # 结束序号
    item_ids = Column(
        JSON, nullable=True
    )  # 指定的语料ID列表 (可选, 若存在则优先于范围)

    # 权限设置
    permission = Column(String(20), default="edit")  # view, comment, edit

    # 限制设置
    max_online = Column(Integer, default=1)  # 最大同时在线数
    current_online = Column(Integer, default=0)  # 当前在线数
    max_verify_count = Column(Integer, default=10)  # 最大验证次数
    verify_count = Column(Integer, default=0)  # 已验证次数

    # 有效期
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # 状态
    is_active = Column(Boolean, default=True)

    # 创建者
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关系
    dataset = relationship("Dataset", back_populates="auth_codes")
    creator = relationship("User", back_populates="created_auth_codes")
    sessions = relationship("AuthCodeSession", back_populates="auth_code")
    reviewed_items = relationship("AuthCodeReviewedItem", back_populates="auth_code")

    @classmethod
    def generate_code(cls) -> str:
        """生成6位数字授权码"""
        return "".join(random.choices(string.digits, k=6))


class AuthCodeSession(Base):
    """授权码会话 - 追踪在线状态"""

    __tablename__ = "auth_code_sessions"

    id = Column(Integer, primary_key=True, index=True)
    auth_code_id = Column(Integer, ForeignKey("auth_codes.id"), nullable=False)
    session_token = Column(String(64), unique=True, nullable=False)

    # 客户端信息
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)

    # 状态
    is_left = Column(Boolean, default=False)  # 是否已离开

    # 时间
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_active_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)

    # 关系
    auth_code = relationship("AuthCode", back_populates="sessions")


class AuthCodeReviewedItem(Base):
    """授权码审核记录 - 追踪被授权人的审核"""

    __tablename__ = "auth_code_reviewed_items"

    id = Column(Integer, primary_key=True, index=True)
    auth_code_id = Column(Integer, ForeignKey("auth_codes.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("data_items.id"), nullable=False)

    # 审核结果
    action = Column(String(20), nullable=False)  # approve, reject, modify
    previous_content = Column(String, nullable=True)
    new_content = Column(String, nullable=True)

    # 时间
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关系
    auth_code = relationship("AuthCode", back_populates="reviewed_items")
