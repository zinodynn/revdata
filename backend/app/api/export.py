import csv
import io
import json
from typing import Optional

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.data_item import DataItem, ItemStatus
from app.models.dataset import Dataset
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/{dataset_id}")
async def export_dataset(
    dataset_id: int,
    format: str = "jsonl",
    status_filter: Optional[str] = None,
    include_original: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    导出数据集

    - format: jsonl, json, csv
    - status_filter: pending, approved, rejected, modified (可选)
    - include_original: 是否包含原始内容
    """
    # 检查数据集
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")

    # 构建查询
    conditions = [DataItem.dataset_id == dataset_id]
    if status_filter:
        try:
            status_enum = ItemStatus(status_filter)
            conditions.append(DataItem.status == status_enum)
        except ValueError:
            pass

    result = await db.execute(
        select(DataItem).where(and_(*conditions)).order_by(DataItem.seq_num)
    )
    items = result.scalars().all()

    # 根据格式导出
    if format == "jsonl":
        return export_jsonl(items, dataset.name, include_original)
    elif format == "json":
        return export_json(items, dataset.name, include_original)
    elif format == "csv":
        return export_csv(items, dataset.name, include_original)
    else:
        raise HTTPException(status_code=400, detail="不支持的导出格式")


def export_jsonl(items, dataset_name: str, include_original: bool):
    """导出为JSONL格式"""

    def generate():
        for item in items:
            data = item.current_content.copy()
            data["_status"] = item.status.value
            data["_seq_num"] = item.seq_num
            if include_original and item.original_content != item.current_content:
                data["_original"] = item.original_content
            yield json.dumps(data, ensure_ascii=False) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "Content-Disposition": f'attachment; filename="{dataset_name}_export.jsonl"'
        },
    )


def export_json(items, dataset_name: str, include_original: bool):
    """导出为JSON格式"""
    data = []
    for item in items:
        record = item.current_content.copy()
        record["_status"] = item.status.value
        record["_seq_num"] = item.seq_num
        if include_original and item.original_content != item.current_content:
            record["_original"] = item.original_content
        data.append(record)

    content = json.dumps(data, ensure_ascii=False, indent=2)

    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{dataset_name}_export.json"'
        },
    )


def export_csv(items, dataset_name: str, include_original: bool):
    """导出为CSV格式"""
    output = io.StringIO()

    if not items:
        return StreamingResponse(
            iter([""]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{dataset_name}_export.csv"'
            },
        )

    # 收集所有可能的字段
    all_fields = set()
    for item in items:
        content = item.current_content
        if isinstance(content, dict):
            # 展平 messages 格式
            if "messages" in content:
                all_fields.add("question")
                all_fields.add("answer")
            else:
                all_fields.update(content.keys())

    all_fields.add("_status")
    all_fields.add("_seq_num")
    if include_original:
        all_fields.add("_has_changes")

    fieldnames = sorted(list(all_fields))
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for item in items:
        content = item.current_content
        row = {"_status": item.status.value, "_seq_num": item.seq_num}

        if isinstance(content, dict):
            if "messages" in content:
                messages = content.get("messages", [])
                row["question"] = messages[0]["content"] if len(messages) > 0 else ""
                row["answer"] = messages[1]["content"] if len(messages) > 1 else ""
            else:
                row.update(content)

        if include_original:
            row["_has_changes"] = item.original_content != item.current_content

        writer.writerow(row)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{dataset_name}_export.csv"'
        },
    )
