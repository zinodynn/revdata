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
    image_field: Optional[str] = None  # 图片字段 (相对路径)

    # 多轮对话字段配置
    message_role_field: Optional[str] = "role"  # 消息对象中角色字段名
    message_content_field: Optional[str] = "content"  # 消息对象中内容字段名
    user_role_value: Optional[str] = "user"  # 用户角色的值
    assistant_role_value: Optional[str] = "assistant"  # 助手角色的值
    system_role_value: Optional[str] = "system"  # 系统角色的值

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


class DedupConfig(BaseModel):
    """去重配置"""

    enabled: bool = False
    use_embedding: bool = False  # True 用 embedding, False 用文本相似度
    embedding_api_url: Optional[str] = None
    embedding_api_key: Optional[str] = None
    embedding_model: str = "text-embedding-ada-002"
    embedding_batch_size: int = 32
    embedding_concurrency: int = 1
    similarity_threshold: float = 0.8
    query_field: str = "question"  # 用于去重比较的字段


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    field_mapping: Optional[FieldMapping] = None
    review_config: Optional[ReviewConfig] = None
    dedup_config: Optional[DedupConfig] = None
    status: Optional[DatasetStatus] = None
    owner_id: Optional[int] = None


class AppendResult(BaseModel):
    """追加导入结果"""

    total_in_file: int  # 文件中的总条目数
    appended: int  # 实际追加的条目数
    skipped_duplicates: int  # 跳过的重复条目数
    new_total: int  # 追加后数据集总条目数


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
    dedup_config: Optional[dict] = None
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
