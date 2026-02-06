import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.dataset import Dataset
from app.models.reference_doc import ReferenceDoc
from app.models.user import User
from app.schemas.reference_doc import ReferenceDocListResponse, ReferenceDocResponse

router = APIRouter()

ALLOWED_DOC_TYPES = {".pdf", ".doc", ".docx"}


@router.post(
    "/dataset/{dataset_id}",
    response_model=ReferenceDocResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_reference_doc(
    dataset_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """上传参考文档到数据集"""
    # 检查数据集是否存在
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="数据集不存在"
        )

    # 检查文件类型
    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的文件格式 {ext}，仅支持 PDF、DOC、DOCX",
        )

    # 保存文件
    upload_id = str(uuid.uuid4())
    save_dir = os.path.join(settings.UPLOAD_DIR, "reference_docs", str(dataset_id))
    os.makedirs(save_dir, exist_ok=True)

    safe_filename = f"{upload_id}{ext}"
    file_path = os.path.join(save_dir, safe_filename)

    file_size = 0
    with open(file_path, "wb") as buffer:
        while True:
            chunk = await file.read(1024 * 1024 * 10)  # 10MB chunks
            if not chunk:
                break
            buffer.write(chunk)
            file_size += len(chunk)

    relative_path = os.path.relpath(file_path, settings.UPLOAD_DIR).replace("\\", "/")

    # 创建记录
    doc = ReferenceDoc(
        dataset_id=dataset_id,
        name=filename,
        file_path=relative_path,
        file_type=ext.lstrip("."),
        file_size=file_size,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return doc


@router.get("/dataset/{dataset_id}", response_model=ReferenceDocListResponse)
async def list_reference_docs(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取数据集的参考文档列表"""
    count_result = await db.execute(
        select(func.count(ReferenceDoc.id)).where(
            ReferenceDoc.dataset_id == dataset_id
        )
    )
    total = count_result.scalar()

    result = await db.execute(
        select(ReferenceDoc)
        .where(ReferenceDoc.dataset_id == dataset_id)
        .order_by(ReferenceDoc.created_at.desc())
    )
    docs = result.scalars().all()

    return ReferenceDocListResponse(items=docs, total=total)


@router.get("/{doc_id}/view")
async def view_reference_doc(
    doc_id: int,
    token: str = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """查看/下载参考文档 (支持通过 query parameter 传递 token 用于 iframe)"""
    # 验证用户身份 (支持 query param token 用于 iframe 场景)
    if token:
        payload = decode_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的令牌"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="需要认证"
        )
    result = await db.execute(
        select(ReferenceDoc).where(ReferenceDoc.id == doc_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="文档不存在"
        )

    abs_path = os.path.join(settings.UPLOAD_DIR, doc.file_path)
    if not os.path.exists(abs_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="文档文件不存在"
        )

    # 对 PDF 使用 inline 展示, 其他类型使用附件下载
    media_type_map = {
        "pdf": "application/pdf",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    media_type = media_type_map.get(doc.file_type, "application/octet-stream")

    return FileResponse(
        abs_path,
        media_type=media_type,
        filename=doc.name,
        headers={
            "Content-Disposition": f'inline; filename="{doc.name}"'
            if doc.file_type == "pdf"
            else f'attachment; filename="{doc.name}"'
        },
    )


@router.delete("/{doc_id}")
async def delete_reference_doc(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """删除参考文档"""
    result = await db.execute(
        select(ReferenceDoc).where(ReferenceDoc.id == doc_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="文档不存在"
        )

    # 删除文件
    abs_path = os.path.join(settings.UPLOAD_DIR, doc.file_path)
    if os.path.exists(abs_path):
        os.remove(abs_path)

    await db.delete(doc)
    await db.commit()

    return {"message": "文档已删除"}
