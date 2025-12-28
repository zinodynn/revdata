import csv
import io
import json
import os
from typing import List, Optional

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.data_item import DataItem, ItemStatus, ItemType
from app.models.dataset import Dataset, DatasetFormat, DatasetStatus
from app.models.user import User
from app.schemas.dataset import (
    DatasetCreate,
    DatasetListResponse,
    DatasetResponse,
    DatasetUpdate,
    DisplayMode,
    FieldDetectionResponse,
    FieldMapping,
)
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


def detect_fields_from_content(items: List[dict]) -> tuple[List[str], FieldMapping]:
    """从内容中检测字段并生成建议映射"""
    if not items:
        return [], FieldMapping()

    # 收集所有字段
    all_fields = set()
    for item in items[:10]:  # 只检查前10条
        if isinstance(item, dict):
            all_fields.update(item.keys())

    detected_fields = sorted(list(all_fields))

    # 生成建议映射
    suggested = FieldMapping(detected_fields=detected_fields)

    # 检测问题字段
    q_keys = ["instruction", "question", "prompt", "input", "query", "user", "human"]
    for key in q_keys:
        if key in all_fields:
            suggested.question_field = key
            break

    # 检测回答字段
    a_keys = ["output", "answer", "completion", "response", "assistant", "bot", "reply"]
    for key in a_keys:
        if key in all_fields:
            suggested.answer_field = key
            break

    # 检测思考字段
    think_keys = [
        "thinking",
        "reasoning",
        "thought",
        "chain_of_thought",
        "cot",
        "rationale",
    ]
    for key in think_keys:
        if key in all_fields:
            suggested.thinking_field = key
            break

    # 检测上下文字段
    ctx_keys = ["system", "system_prompt", "context", "instruction_prefix"]
    for key in ctx_keys:
        if key in all_fields:
            suggested.context_field = key
            break

    # 检测消息字段
    msg_keys = ["messages", "conversations", "dialogue", "chat", "turns"]
    for key in msg_keys:
        if key in all_fields:
            suggested.messages_field = key
            suggested.display_mode = DisplayMode.CONVERSATION
            break

    # 确定显示模式
    if suggested.messages_field:
        suggested.display_mode = DisplayMode.CONVERSATION
    elif suggested.question_field and suggested.answer_field:
        suggested.display_mode = DisplayMode.QA_PAIR
    else:
        suggested.display_mode = DisplayMode.PLAIN

    # 剩余字段作为元数据
    mapped_fields = {
        suggested.question_field,
        suggested.answer_field,
        suggested.thinking_field,
        suggested.context_field,
        suggested.messages_field,
    }
    suggested.metadata_fields = [
        f for f in detected_fields if f not in mapped_fields and f is not None
    ]

    return detected_fields, suggested


def detect_item_type(content: dict) -> ItemType:
    """检测语料类型"""
    # QA类型检测
    qa_patterns = [
        ("instruction", "output"),
        ("question", "answer"),
        ("prompt", "completion"),
        ("input", "output"),
    ]
    for q_key, a_key in qa_patterns:
        if q_key in content and a_key in content:
            return ItemType.QA

    # messages格式 (OpenAI/ShareGPT)
    if "messages" in content or "conversations" in content:
        return ItemType.QA

    return ItemType.PLAIN


def normalize_content(content: dict, item_type: ItemType) -> dict:
    """标准化内容格式"""
    if item_type == ItemType.PLAIN:
        # 尝试提取文本字段
        for key in ["text", "content", "sentence", "data"]:
            if key in content:
                return {"text": content[key]}
        # 如果没有标准字段,保留原始
        return content

    # QA类型标准化
    if "messages" in content:
        return {"messages": content["messages"]}
    if "conversations" in content:
        return {"messages": content["conversations"]}

    # 提取QA对
    q_keys = ["instruction", "question", "prompt", "input"]
    a_keys = ["output", "answer", "completion", "response"]

    question = None
    answer = None

    for key in q_keys:
        if key in content:
            question = content[key]
            break

    for key in a_keys:
        if key in content:
            answer = content[key]
            break

    if question is not None and answer is not None:
        return {
            "messages": [
                {"role": "user", "content": question},
                {"role": "assistant", "content": answer},
            ]
        }

    return content


@router.post(
    "/upload", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED
)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """上传并导入数据集"""
    # 检测文件格式
    filename = file.filename.lower()
    if filename.endswith(".jsonl"):
        format_type = DatasetFormat.JSONL
    elif filename.endswith(".json"):
        format_type = DatasetFormat.JSON
    elif filename.endswith(".csv"):
        format_type = DatasetFormat.CSV
    elif filename.endswith(".tsv"):
        format_type = DatasetFormat.TSV
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不支持的文件格式,请上传 JSONL、JSON、CSV 或 TSV 文件",
        )

    # 创建数据集记录
    dataset = Dataset(
        name=name,
        description=description,
        format=format_type,
        source_file=file.filename,
        owner_id=current_user.id,
        status=DatasetStatus.IMPORTING,
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)

    # 读取并解析文件内容
    content = await file.read()
    items = []

    try:
        if format_type == DatasetFormat.JSONL:
            lines = content.decode("utf-8").strip().split("\n")
            for line in lines:
                if line.strip():
                    items.append(json.loads(line))

        elif format_type == DatasetFormat.JSON:
            data = json.loads(content.decode("utf-8"))
            if isinstance(data, list):
                items = data
            else:
                items = [data]

        elif format_type in [DatasetFormat.CSV, DatasetFormat.TSV]:
            delimiter = "," if format_type == DatasetFormat.CSV else "\t"
            text_content = content.decode("utf-8")
            reader = csv.DictReader(io.StringIO(text_content), delimiter=delimiter)
            items = [dict(row) for row in reader]

    except Exception as e:
        # 解析失败,删除数据集
        await db.delete(dataset)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"文件解析失败: {str(e)}"
        )

    # 检测字段并生成建议映射
    detected_fields, suggested_mapping = detect_fields_from_content(items)
    dataset.field_mapping = suggested_mapping.model_dump()

    # 创建数据项 - 保存原始内容，不再标准化
    for seq_num, item_content in enumerate(items, start=1):
        item_type = detect_item_type(item_content)

        data_item = DataItem(
            dataset_id=dataset.id,
            seq_num=seq_num,
            item_type=item_type,
            original_content=item_content,  # 保存原始内容
            current_content=item_content,  # 保存原始内容
            status=ItemStatus.PENDING,
        )
        db.add(data_item)

    # 更新数据集状态
    dataset.item_count = len(items)
    dataset.status = DatasetStatus.READY
    await db.commit()
    await db.refresh(dataset)

    return dataset


@router.get("", response_model=DatasetListResponse)
async def list_datasets(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取数据集列表"""
    offset = (page - 1) * page_size

    # 查询总数
    count_result = await db.execute(select(func.count(Dataset.id)))
    total = count_result.scalar()

    # 查询数据
    result = await db.execute(
        select(Dataset)
        .order_by(Dataset.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    datasets = result.scalars().all()

    return DatasetListResponse(
        items=datasets, total=total, page=page, page_size=page_size
    )


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取数据集详情"""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="数据集不存在"
        )

    return dataset


@router.put("/{dataset_id}", response_model=DatasetResponse)
async def update_dataset(
    dataset_id: int,
    update_data: DatasetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新数据集配置（管理员）"""
    # 检查权限
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="只有管理员可以修改数据集配置"
        )

    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="数据集不存在"
        )

    # 更新字段
    if update_data.name is not None:
        dataset.name = update_data.name
    if update_data.description is not None:
        dataset.description = update_data.description
    if update_data.field_mapping is not None:
        dataset.field_mapping = update_data.field_mapping.model_dump()
    if update_data.review_config is not None:
        dataset.review_config = update_data.review_config.model_dump()
    if update_data.status is not None:
        dataset.status = update_data.status

    await db.commit()
    await db.refresh(dataset)

    return dataset


@router.get("/{dataset_id}/preview")
async def preview_dataset(
    dataset_id: int,
    count: int = 5,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """预览数据集内容（用于配置字段映射）"""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="数据集不存在"
        )

    # 获取前N条数据项
    items_result = await db.execute(
        select(DataItem)
        .where(DataItem.dataset_id == dataset_id)
        .order_by(DataItem.seq_num)
        .limit(count)
    )
    items = items_result.scalars().all()

    # 收集所有字段
    all_fields = set()
    sample_data = []
    for item in items:
        content = item.original_content
        if isinstance(content, dict):
            all_fields.update(content.keys())
            sample_data.append(content)

    return {
        "dataset_id": dataset_id,
        "dataset_name": dataset.name,
        "total_items": dataset.item_count,
        "detected_fields": sorted(list(all_fields)),
        "current_mapping": dataset.field_mapping,
        "sample_data": sample_data,
    }


@router.post("/detect-fields", response_model=FieldDetectionResponse)
async def detect_fields_from_file(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user)
):
    """预览文件并检测字段（上传前预览）"""
    # 检测文件格式
    filename = file.filename.lower()
    content = await file.read()
    items = []

    try:
        if filename.endswith(".jsonl"):
            lines = content.decode("utf-8").strip().split("\n")
            for line in lines[:100]:  # 只读取前100行
                if line.strip():
                    items.append(json.loads(line))

        elif filename.endswith(".json"):
            data = json.loads(content.decode("utf-8"))
            if isinstance(data, list):
                items = data[:100]
            else:
                items = [data]

        elif filename.endswith(".csv") or filename.endswith(".tsv"):
            delimiter = "," if filename.endswith(".csv") else "\t"
            text_content = content.decode("utf-8")
            reader = csv.DictReader(io.StringIO(text_content), delimiter=delimiter)
            for i, row in enumerate(reader):
                if i >= 100:
                    break
                items.append(dict(row))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不支持的文件格式"
            )

    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"JSON解析失败: {str(e)}"
        )

    detected_fields, suggested_mapping = detect_fields_from_content(items)

    return FieldDetectionResponse(
        detected_fields=detected_fields,
        sample_data=items[:3],
        suggested_mapping=suggested_mapping,
        item_count_estimate=len(items),
    )
