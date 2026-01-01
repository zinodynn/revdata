from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel

from app.models.dataset import DatasetFormat, DatasetStatus


class DisplayMode(str, Enum):
    """显示模式"""

    CONVERSATION = "conversation"  # 对话模式(messages格式)
    QA_PAIR = "qa_pair"  # 问答对模式
    PLAIN = "plain"  # 纯文本模式
    AUTO = "auto"  # 自动检测


class FieldMapping(BaseModel):
    """字段映射配置"""

    question_field: Optional[str] = None  # 问题/用户输入字段
    answer_field: Optional[str] = None  # 回答/助手输出字段
    thinking_field: Optional[str] = None  # 思考过程字段
    context_field: Optional[str] = None  # 上下文/系统提示字段
    messages_field: Optional[str] = None  # 对话消息数组字段
    metadata_fields: List[str] = []  # 元数据字段列表
    display_mode: DisplayMode = DisplayMode.AUTO
    detected_fields: List[str] = []  # 系统检测到的所有字段


class ReviewConfig(BaseModel):
    """审核规则配置"""

    require_reason: bool = False  # 拒绝时是否必须填写原因
    allow_edit: bool = True  # 是否允许编辑内容
    review_mode: str = "single"  # single/double 单次/双重审核
    auto_approve_after: Optional[int] = None  # 自动通过时间(分钟)


class DatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    field_mapping: Optional[FieldMapping] = None
    review_config: Optional[ReviewConfig] = None


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    field_mapping: Optional[FieldMapping] = None
    review_config: Optional[ReviewConfig] = None
    status: Optional[DatasetStatus] = None


class DatasetResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    format: DatasetFormat
    source_file: Optional[str]
    item_count: int
    owner_id: int
    status: DatasetStatus
    field_mapping: Optional[dict] = None
    review_config: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DatasetListResponse(BaseModel):
    items: List[DatasetResponse]
    total: int
    page: int
    page_size: int


class FieldDetectionRequest(BaseModel):
    """字段检测请求 - 用于预览文件结构"""

    sample_content: str  # 文件内容样本


class FieldDetectionResponse(BaseModel):
    """字段检测响应"""

    detected_fields: List[str]  # 检测到的所有字段
    sample_data: List[dict]  # 样本数据(前3条)
    suggested_mapping: FieldMapping  # 建议的映射配置
    item_count_estimate: int  # 估算条目数
