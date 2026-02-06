import csv
import io
import json
import os
import uuid
import zipfile
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.models.data_item import DataItem, ItemStatus, ItemType
from app.models.dataset import Dataset, DatasetFormat, DatasetStatus
from app.models.folder import Folder
from app.models.task import Task
from app.models.user import User, UserRole
from app.schemas.dataset import (
    DatasetListResponse,
    DatasetResponse,
    DatasetUpdate,
    DisplayMode,
    FieldDetectionResponse,
    FieldMapping,
)
from app.schemas.folder import DatasetMoveRequest
from app.utils import normalize_json_keys

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

    # 检测图片字段
    img_keys = ["image", "images", "img", "imgs", "picture", "pictures"]
    for key in img_keys:
        if key in all_fields:
            suggested.image_field = key
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
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """上传并导入数据集 (异步处理)"""
    # 检测文件格式
    filename = file.filename.lower()
    is_zip = filename.endswith(".zip")

    if is_zip:
        format_type = DatasetFormat.JSONL  # 默认先占位,稍后通过内容确认
    elif filename.endswith(".jsonl"):
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
            detail="不支持的文件格式,请上传 JSONL, JSON, CSV, TSV 或 ZIP 文件",
        )

    # 1. 保存文件到磁盘 (分块写入)
    upload_id = str(uuid.uuid4())
    save_dir = os.path.join(settings.UPLOAD_DIR, upload_id)
    os.makedirs(save_dir, exist_ok=True)

    file_path = os.path.join(save_dir, file.filename)
    
    # 使用 chunk 写入, 避免内存溢出
    with open(file_path, "wb") as buffer:
        while True:
            chunk = await file.read(1024 * 1024 * 10) # 10MB chunks
            if not chunk:
                break
            buffer.write(chunk)

    # 简单设置 initial source_file, 后台任务会更新为解压后的文件路径
    relative_path = os.path.relpath(file_path, settings.UPLOAD_DIR).replace("\\", "/")

    # 创建数据集记录
    dataset = Dataset(
        name=name,
        description=description,
        format=format_type,
        source_file=relative_path,
        owner_id=current_user.id,
        status=DatasetStatus.IMPORTING,
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)

    # 添加后台任务
    background_tasks.add_task(
        process_dataset_import, dataset.id, file_path, is_zip, format_type
    )

    return dataset


async def process_dataset_import(
    dataset_id: int, file_path: str, is_zip: bool, format_type: DatasetFormat
):
    """
    后台处理数据集导入任务
    """
    import asyncio
    
    async with AsyncSessionLocal() as db:
        try:
            # 获取数据集
            result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
            dataset = result.scalar_one_or_none()
            if not dataset:
                return

            # 2. 如果是zip,解压并寻找数据文件
            data_file_path = file_path
            save_dir = os.path.dirname(file_path)

            if is_zip:
                extract_dir = save_dir
                
                def unzip_file():
                    with zipfile.ZipFile(file_path, "r") as zip_ref:
                        zip_ref.extractall(extract_dir)
                
                await asyncio.to_thread(unzip_file)

                # 寻找数据文件
                found = False
                for root, dirs, files in os.walk(extract_dir):
                    for f in files:
                        if f.endswith(".jsonl"):
                            data_file_path = os.path.join(root, f)
                            format_type = DatasetFormat.JSONL
                            found = True
                            break
                        elif f.endswith(".json") and not f.endswith("package.json"):
                            data_file_path = os.path.join(root, f)
                            format_type = DatasetFormat.JSON
                            found = True
                            break
                    if found:
                        break

                if not found:
                    raise Exception("ZIP包中未找到支持的数据文件(.jsonl/.json)")

            # 更新 source_file (存储相对路径)
            relative_path = os.path.relpath(data_file_path, settings.UPLOAD_DIR).replace(
                "\\", "/"
            )
            dataset.source_file = relative_path
            dataset.format = format_type

            # 读取并解析文件内容
            items = []
            
            def read_content():
                read_items = []
                with open(data_file_path, "r", encoding="utf-8") as f:
                    if format_type == DatasetFormat.JSONL:
                        for line in f:
                            if line.strip():
                                read_items.append(json.loads(line))
                    elif format_type == DatasetFormat.JSON:
                        data = json.load(f)
                        if isinstance(data, list):
                            read_items = data
                        else:
                            read_items = [data]
                return read_items

            items = await asyncio.to_thread(read_content)

            items = [normalize_json_keys(it) for it in items]

            # 检测字段并生成建议映射
            detected_fields, suggested_mapping = detect_fields_from_content(items)
            dataset.field_mapping = suggested_mapping.model_dump()

            # 创建数据项
            # 分批写入
            batch_size = 1000
            for i in range(0, len(items), batch_size):
                batch = items[i : i + batch_size]
                for seq_offset, item_content in enumerate(batch):
                    item_type = detect_item_type(item_content)
                    data_item = DataItem(
                        dataset_id=dataset.id,
                        seq_num=i + seq_offset + 1,
                        item_type=item_type,
                        original_content=item_content,
                        current_content=item_content,
                        status=ItemStatus.PENDING,
                    )
                    db.add(data_item)
                await db.commit()

            # 更新数据集状态
            dataset.item_count = len(items)
            dataset.status = DatasetStatus.READY
            await db.commit()
            
        except Exception as e:
            print(f"Error processing dataset {dataset_id}: {e}")
            await db.rollback()
            await db.delete(dataset)
            await db.commit()



@router.get("", response_model=DatasetListResponse)
async def list_datasets(
    page: int = 1,
    page_size: int = 20,
    folder_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取数据集列表，支持按目录筛选"""
    offset = (page - 1) * page_size

    # 构建查询条件
    conditions = []
    if folder_id is not None:
        conditions.append(Dataset.folder_id == folder_id)
    elif folder_id is None:
        # 如果 folder_id 参数存在且为空字符串，筛选根目录下的数据集
        # 注意: FastAPI 默认 None 表示未传参数
        pass  # 返回所有数据集

    # 查询总数
    count_query = select(func.count(Dataset.id))
    if conditions:
        count_query = count_query.where(*conditions)
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    # 查询数据
    query = select(Dataset).order_by(Dataset.created_at.desc()).offset(offset).limit(page_size)
    if conditions:
        query = query.where(*conditions)
    result = await db.execute(query)
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


@router.post("/transfer-all")
async def transfer_all_datasets(
    from_user_id: int,
    to_user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """批量转移数据集所有权（管理员）"""
    # 检查目标用户
    result = await db.execute(select(User).where(User.id == to_user_id))
    to_user = result.scalar_one_or_none()
    if not to_user or not to_user.is_active:
        raise HTTPException(status_code=400, detail="目标用户不存在或已禁用")

    if to_user.role not in ["super_admin", "admin"]:
        raise HTTPException(
            status_code=400, detail="只能将所有权转移给管理员或超级管理员"
        )

    # 执行转移
    result = await db.execute(
        update(Dataset)
        .where(Dataset.owner_id == from_user_id)
        .values(owner_id=to_user_id)
    )
    await db.commit()
    return {"message": f"成功转移了 {result.rowcount} 个数据集"}


@router.put("/{dataset_id}", response_model=DatasetResponse)
async def update_dataset(
    dataset_id: int,
    update_data: DatasetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """更新数据集配置（管理员）"""
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
    if update_data.owner_id is not None:
        # 检查新所有者是否存在且活跃
        result = await db.execute(select(User).where(User.id == update_data.owner_id))
        new_owner = result.scalar_one_or_none()
        if not new_owner:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="新所有者不存在"
            )
        if not new_owner.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能将所有权转移给已禁用的用户",
            )
        if new_owner.role not in ["super_admin", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="只能将所有权转移给管理员或超级管理员",
            )
        dataset.owner_id = update_data.owner_id

    await db.commit()
    await db.refresh(dataset)

    return dataset


@router.put("/{dataset_id}/move", response_model=DatasetResponse)
async def move_dataset(
    dataset_id: int,
    move_data: DatasetMoveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """移动数据集到指定目录"""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="数据集不存在"
        )

    # 检查权限：只有所有者或管理员可以移动
    if dataset.owner_id != current_user.id and current_user.role not in [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
    ]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权移动此数据集"
        )

    # 如果指定了目标目录，检查目录是否存在且属于当前用户
    if move_data.folder_id is not None:
        folder_result = await db.execute(
            select(Folder)
            .where(Folder.id == move_data.folder_id)
            .where(Folder.owner_id == current_user.id)
        )
        folder = folder_result.scalar_one_or_none()
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="目标目录不存在"
            )

    dataset.folder_id = move_data.folder_id
    await db.commit()
    await db.refresh(dataset)

    return dataset


@router.delete("/{dataset_id}")
async def delete_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除数据集（仅限所有者或超级管理员）"""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="数据集不存在"
        )

    # 权限检查：只有所有者或超级管理员可以删除
    if (
        current_user.role != UserRole.SUPER_ADMIN
        and dataset.owner_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有数据集所有者或超级管理员可以删除数据集",
        )

    # 检查是否有正在进行的任务
    task_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.dataset_id == dataset_id, Task.status != "completed"
        )
    )
    active_tasks = task_result.scalar()
    if active_tasks > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"该数据集还有 {active_tasks} 个未完成的任务，请先删除或完成任务后再删除数据集",
        )

    await db.delete(dataset)
    await db.commit()

    return {"message": "数据集已删除"}


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

        elif filename.endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(content), "r") as z:
                # 寻找第一个支持的数据文件
                target_file = None
                for name in z.namelist():
                    lower_name = name.lower()
                    if lower_name.endswith(".jsonl") or lower_name.endswith(".json"):
                        target_file = name
                        break

                if target_file and target_file.lower().endswith(".jsonl"):
                    with z.open(target_file) as f:
                        lines = f.read().decode("utf-8").strip().split("\n")
                        for line in lines[:100]:
                            if line.strip():
                                items.append(json.loads(line))
                elif target_file and target_file.lower().endswith(".json"):
                    with z.open(target_file) as f:
                        data = json.loads(f.read().decode("utf-8"))
                        if isinstance(data, list):
                            items = data[:100]
                        else:
                            items = [data]
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="ZIP包中未找到支持的数据文件(.jsonl/.json)",
                    )

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
    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="失效的ZIP文件"
        )
    except Exception as e:
        print(f"Detect fields error: {e}")
        # 如果不是我们预期的错误，继续抛出或者返回通用错误
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"文件解析失败: {str(e)}"
        )

    detected_fields, suggested_mapping = detect_fields_from_content(items)

    return FieldDetectionResponse(
        detected_fields=detected_fields,
        sample_data=items[:3],
        suggested_mapping=suggested_mapping,
        item_count_estimate=len(items),
    )
