from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
import os
import json
import csv
import io

from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.dataset import Dataset, DatasetFormat, DatasetStatus
from app.models.data_item import DataItem, ItemType, ItemStatus
from app.schemas.dataset import DatasetCreate, DatasetResponse, DatasetListResponse
from app.api.deps import get_current_user

router = APIRouter()


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
                {"role": "assistant", "content": answer}
            ]
        }
    
    return content


@router.post("/upload", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
            detail="不支持的文件格式,请上传 JSONL、JSON、CSV 或 TSV 文件"
        )
    
    # 创建数据集记录
    dataset = Dataset(
        name=name,
        description=description,
        format=format_type,
        source_file=file.filename,
        owner_id=current_user.id,
        status=DatasetStatus.IMPORTING
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"文件解析失败: {str(e)}"
        )
    
    # 创建数据项
    for seq_num, item_content in enumerate(items, start=1):
        item_type = detect_item_type(item_content)
        normalized = normalize_content(item_content, item_type)
        
        data_item = DataItem(
            dataset_id=dataset.id,
            seq_num=seq_num,
            item_type=item_type,
            original_content=normalized,
            current_content=normalized,
            status=ItemStatus.PENDING
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
    current_user: User = Depends(get_current_user)
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
        items=datasets,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取数据集详情"""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="数据集不存在"
        )
    
    return dataset
