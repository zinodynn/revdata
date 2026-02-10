"""
导入历史 API 端点
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.data_item import DataItem
from app.models.dataset import Dataset
from app.models.import_history import ImportHistory, ImportStatus
from app.models.user import User
from app.schemas.import_history import ImportHistoryListResponse

router = APIRouter()


@router.get("/datasets/{dataset_id}/import-history", response_model=ImportHistoryListResponse)
async def list_import_history(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取数据集的导入历史记录列表"""
    # 检查数据集是否存在
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")
    
    # 查询导入历史
    query = (
        select(ImportHistory)
        .where(ImportHistory.dataset_id == dataset_id)
        .order_by(ImportHistory.created_at.desc())
    )
    result = await db.execute(query)
    histories = result.scalars().all()
    
    return ImportHistoryListResponse(items=histories, total=len(histories))


@router.post("/datasets/{dataset_id}/import-history/{history_id}/rollback")
async def rollback_import(
    dataset_id: int,
    history_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """撤销某次导入（软删除数据项）"""
    # 检查导入历史记录
    result = await db.execute(
        select(ImportHistory)
        .where(ImportHistory.id == history_id)
        .where(ImportHistory.dataset_id == dataset_id)
    )
    import_history = result.scalar_one_or_none()
    if not import_history:
        raise HTTPException(status_code=404, detail="导入历史记录不存在")
    
    if not import_history.is_active:
        raise HTTPException(status_code=400, detail="该导入已被撤销")
    
    if import_history.status != ImportStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="只能撤销已完成的导入")
    
    # 获取数据集
    dataset_result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = dataset_result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")
    
    # 软删除该次导入的数据项（通过 seq_num 范围）
    if import_history.start_seq and import_history.end_seq:
        # 可以选择真删除或标记为 inactive
        # 这里使用真删除
        await db.execute(
            select(DataItem)
            .where(DataItem.dataset_id == dataset_id)
            .where(DataItem.seq_num >= import_history.start_seq)
            .where(DataItem.seq_num <= import_history.end_seq)
        )
        items_to_delete = (await db.execute(
            select(DataItem)
            .where(DataItem.dataset_id == dataset_id)
            .where(DataItem.seq_num >= import_history.start_seq)
            .where(DataItem.seq_num <= import_history.end_seq)
        )).scalars().all()
        
        for item in items_to_delete:
            await db.delete(item)
        
        # 更新数据集条目数
        dataset.item_count = (dataset.item_count or 0) - len(items_to_delete)
        
        # 标记导入历史为非激活
        import_history.is_active = False
        
        await db.commit()
        
        return {
            "message": "导入已撤销",
            "deleted_items": len(items_to_delete),
            "new_item_count": dataset.item_count
        }
    else:
        raise HTTPException(status_code=400, detail="导入记录缺少 seq 范围信息")


@router.post("/datasets/{dataset_id}/import-history/{history_id}/restore")
async def restore_import(
    dataset_id: int,
    history_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """恢复已撤销的导入
    
    注意：由于数据项已被物理删除，恢复需要重新导入原文件。
    这里暂不实现，建议用户重新追加原文件。
    """
    raise HTTPException(
        status_code=501,
        detail="恢复功能暂未实现，请重新追加原文件"
    )
