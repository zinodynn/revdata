import os
import uuid
from pathlib import Path

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
from urllib.parse import quote

router = APIRouter()

ALLOWED_DOC_TYPES = {".pdf", ".doc", ".docx"}


def build_content_disposition(filename: str, disposition: str = "inline") -> str:
    """构建支持非 ASCII 文件名的 Content-Disposition 头（包含 filename*）"""
    # ASCII 回退文件名，丢弃无法编码的字符
    try:
        ascii_filename = filename.encode("latin-1", errors="ignore").decode("latin-1")
    except Exception:
        ascii_filename = "file"
    if not ascii_filename:
        ascii_filename = "file"
    # URL-encode UTF-8 文件名
    quoted = quote(filename, safe="")
    return f"{disposition}; filename=\"{ascii_filename}\"; filename*=UTF-8''{quoted}"


def convert_word_to_pdf(word_file_path: str) -> str:
    """
    将 Word 文档转换为 PDF
    使用 Python docx2pdf 库（Windows）或 pypandoc（跨平台）
    返回转换后的 PDF 文件路径
    """
    output_dir = os.path.dirname(word_file_path)
    pdf_path = os.path.splitext(word_file_path)[0] + ".pdf"
    
    # 如果 PDF 已存在且比 Word 文件新，直接返回
    if os.path.exists(pdf_path):
        if os.path.getmtime(pdf_path) >= os.path.getmtime(word_file_path):
            print(f"[PDF Convert] Using cached PDF: {pdf_path}")
            return pdf_path
    
    print(f"[PDF Convert] Starting conversion of {word_file_path}")
    
    try:
        # 方案 1: 使用 docx2pdf (推荐用于 Windows，基于 pywin32)
        try:
            print("[PDF Convert] Trying docx2pdf...")
            from docx2pdf import convert
            convert(word_file_path, pdf_path)
            if os.path.exists(pdf_path):
                print(f"[PDF Convert] SUCCESS with docx2pdf")
                return pdf_path
        except ImportError:
            print("[PDF Convert] docx2pdf not installed")
        except Exception as e:
            print(f"[PDF Convert] docx2pdf failed: {type(e).__name__}: {e}")
        
        # 方案 2: 使用 pypandoc (跨平台，需要安装 pandoc)
        try:
            print("[PDF Convert] Trying pypandoc...")
            import pypandoc
            pypandoc.convert_file(
                word_file_path,
                'pdf',
                outputfile=pdf_path,
                extra_args=['--pdf-engine=xelatex']
            )
            if os.path.exists(pdf_path):
                print(f"[PDF Convert] SUCCESS with pypandoc")
                return pdf_path
        except ImportError:
            print("[PDF Convert] pypandoc not installed")
        except Exception as e:
            print(f"[PDF Convert] pypandoc failed: {type(e).__name__}: {e}")
        
        # 方案 3: 使用 unoconv (需要 LibreOffice Python API)
        try:
            import subprocess
            print("[PDF Convert] Trying unoconv...")
            result = subprocess.run(
                ['unoconv', '-f', 'pdf', '-o', pdf_path, word_file_path],
                capture_output=True,
                timeout=30,
                check=False,
            )
            if result.returncode == 0 and os.path.exists(pdf_path):
                print(f"[PDF Convert] SUCCESS with unoconv")
                return pdf_path
            print(f"[PDF Convert] unoconv failed with code {result.returncode}")
        except Exception as e:
            print(f"[PDF Convert] unoconv error: {type(e).__name__}: {e}")
        
        # 方案 4: 使用 LibreOffice 命令行（作为后备方案）
        try:
            import subprocess
            print("[PDF Convert] Trying LibreOffice CLI...")
            libreoffice_cmds = [
                "libreoffice",
                "soffice",
                r"C:\Program Files\LibreOffice\program\soffice.exe",
                r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
            ]
            
            for cmd in libreoffice_cmds:
                try:
                    result = subprocess.run(
                        [
                            cmd,
                            "--headless",
                            "--convert-to",
                            "pdf",
                            "--outdir",
                            output_dir,
                            word_file_path,
                        ],
                        capture_output=True,
                        timeout=30,
                        check=False,
                    )
                    if result.returncode == 0 and os.path.exists(pdf_path):
                        print(f"[PDF Convert] SUCCESS with LibreOffice CLI")
                        return pdf_path
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    continue
            print("[PDF Convert] LibreOffice CLI not available or conversion failed")
        except Exception as e:
            print(f"[PDF Convert] LibreOffice error: {type(e).__name__}: {e}")
        
        # 所有方案都失败
        print(f"[PDF Convert] All methods failed, will fallback to browser-side conversion")
        return ""
    except Exception as e:
        print(f"Word to PDF conversion failed: {e}")
        return ""


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
    """查看/下载参考文档 (支持通过 query parameter 传递 token 用于 iframe)
    
    Word 文档会自动转换为 PDF 后展示
    """
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

    # Word 文档自动转换为 PDF
    if doc.file_type in ["doc", "docx"]:
        pdf_path = convert_word_to_pdf(abs_path)
        if pdf_path and os.path.exists(pdf_path):
            # 成功转换，返回 PDF
            filename_pdf = os.path.splitext(doc.name)[0] + ".pdf"
            return FileResponse(
                pdf_path,
                media_type="application/pdf",
                filename=filename_pdf,
                headers={"Content-Disposition": build_content_disposition(filename_pdf, "inline")},
            )
        else:
            # 转换失败，提供原文件下载
            return FileResponse(
                abs_path,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                if doc.file_type == "docx"
                else "application/msword",
                filename=doc.name,
                headers={"Content-Disposition": build_content_disposition(doc.name, "attachment")},
            )

    # PDF 和其他文件直接返回
    media_type_map = {
        "pdf": "application/pdf",
    }
    media_type = media_type_map.get(doc.file_type, "application/octet-stream")

    # 根据文件类型选择默认的 disposition
    disposition = "inline" if doc.file_type == "pdf" else "attachment"
    return FileResponse(
        abs_path,
        media_type=media_type,
        filename=doc.name,
        headers={"Content-Disposition": build_content_disposition(doc.name, disposition)},
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
