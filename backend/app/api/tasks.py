from datetime import datetime
from typing import Optional

from app.api.deps import get_current_admin, get_current_user
from app.core.database import get_db
from app.models.data_item import DataItem, ItemStatus
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.task import TaskCreate, TaskDelegate, TaskListResponse, TaskResponse
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """创建任务 (管理员)"""
    task = Task(
        dataset_id=task_in.dataset_id,
        assigner_id=current_user.id,
        assignee_id=task_in.assignee_id,
        item_start=task_in.item_start,
        item_end=task_in.item_end,
        priority=task_in.priority or 0,
        note=task_in.note,
        due_date=task_in.due_date,
    )
    db.add(task)

    # 更新对应语料的分配
    await db.execute(
        DataItem.__table__.update()
        .where(
            and_(
                DataItem.dataset_id == task_in.dataset_id,
                DataItem.seq_num >= task_in.item_start,
                DataItem.seq_num <= task_in.item_end,
            )
        )
        .values(assigned_to=task_in.assignee_id)
    )

    await db.commit()
    await db.refresh(task)

    # 计算进度
    response = TaskResponse.model_validate(task)
    response.total_items = task.item_end - task.item_start + 1
    response.reviewed_items = 0

    return response


@router.get("/my", response_model=TaskListResponse)
async def list_my_tasks(
    status_filter: Optional[TaskStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取我的任务列表"""
    conditions = [Task.assignee_id == current_user.id]
    if status_filter:
        conditions.append(Task.status == status_filter)

    result = await db.execute(
        select(Task)
        .where(and_(*conditions))
        .order_by(Task.priority.desc(), Task.created_at.desc())
    )
    tasks = result.scalars().all()

    # 计算每个任务的进度
    task_responses = []
    for task in tasks:
        response = TaskResponse.model_validate(task)
        response.total_items = task.item_end - task.item_start + 1

        # 查询已审核数量
        reviewed_result = await db.execute(
            select(func.count(DataItem.id)).where(
                and_(
                    DataItem.dataset_id == task.dataset_id,
                    DataItem.seq_num >= task.item_start,
                    DataItem.seq_num <= task.item_end,
                    DataItem.status != ItemStatus.PENDING,
                )
            )
        )
        response.reviewed_items = reviewed_result.scalar()
        task_responses.append(response)

    return TaskListResponse(items=task_responses, total=len(task_responses))


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取任务详情"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")

    response = TaskResponse.model_validate(task)
    response.total_items = task.item_end - task.item_start + 1

    reviewed_result = await db.execute(
        select(func.count(DataItem.id)).where(
            and_(
                DataItem.dataset_id == task.dataset_id,
                DataItem.seq_num >= task.item_start,
                DataItem.seq_num <= task.item_end,
                DataItem.status != ItemStatus.PENDING,
            )
        )
    )
    response.reviewed_items = reviewed_result.scalar()

    return response


@router.post("/{task_id}/delegate", response_model=TaskResponse)
async def delegate_task(
    task_id: int,
    delegate_data: TaskDelegate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """委派任务"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")

    # 只有任务的被分配人可以委派
    if task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="只能委派自己的任务"
        )

    # 创建新任务
    new_task = Task(
        dataset_id=task.dataset_id,
        assigner_id=current_user.id,
        assignee_id=delegate_data.new_assignee_id,
        item_start=task.item_start,
        item_end=task.item_end,
        priority=task.priority,
        note=delegate_data.note or f"从任务 #{task.id} 委派",
        due_date=task.due_date,
        delegated_from_task_id=task.id,
    )
    db.add(new_task)

    # 更新原任务状态
    task.status = TaskStatus.DELEGATED

    # 更新语料分配
    await db.execute(
        DataItem.__table__.update()
        .where(
            and_(
                DataItem.dataset_id == task.dataset_id,
                DataItem.seq_num >= task.item_start,
                DataItem.seq_num <= task.item_end,
            )
        )
        .values(assigned_to=delegate_data.new_assignee_id)
    )

    await db.commit()
    await db.refresh(new_task)

    response = TaskResponse.model_validate(new_task)
    response.total_items = new_task.item_end - new_task.item_start + 1
    response.reviewed_items = 0

    return response


@router.post("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """完成任务"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")

    if task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="只能完成自己的任务"
        )

    task.status = TaskStatus.COMPLETED
    task.completed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(task)

    response = TaskResponse.model_validate(task)
    response.total_items = task.item_end - task.item_start + 1

    reviewed_result = await db.execute(
        select(func.count(DataItem.id)).where(
            and_(
                DataItem.dataset_id == task.dataset_id,
                DataItem.seq_num >= task.item_start,
                DataItem.seq_num <= task.item_end,
                DataItem.status != ItemStatus.PENDING,
            )
        )
    )
    response.reviewed_items = reviewed_result.scalar()

    return response


@router.get("/{task_id}/delegation-history")
async def get_delegation_history(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取任务委派历史链"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")

    # 向前追溯委派链
    history = []
    current_task = task

    while current_task:
        # 获取分配人和被分配人信息
        assigner_result = await db.execute(
            select(User).where(User.id == current_task.assigner_id)
        )
        assigner = assigner_result.scalar_one_or_none()

        assignee_result = await db.execute(
            select(User).where(User.id == current_task.assignee_id)
        )
        assignee = assignee_result.scalar_one_or_none()

        history.append(
            {
                "task_id": current_task.id,
                "assigner": (
                    {"id": assigner.id, "username": assigner.username}
                    if assigner
                    else None
                ),
                "assignee": (
                    {"id": assignee.id, "username": assignee.username}
                    if assignee
                    else None
                ),
                "status": current_task.status.value,
                "note": current_task.note,
                "created_at": current_task.created_at.isoformat(),
                "is_delegation": current_task.delegated_from_task_id is not None,
            }
        )

        if current_task.delegated_from_task_id:
            result = await db.execute(
                select(Task).where(Task.id == current_task.delegated_from_task_id)
            )
            current_task = result.scalar_one_or_none()
        else:
            current_task = None

    # 反转顺序，最早的在前
    history.reverse()

    return {"task_id": task_id, "history": history}


@router.get("/users/list")
async def list_users_for_delegation(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """获取可委派的用户列表"""
    result = await db.execute(
        select(User).where(User.is_active == True).where(User.id != current_user.id)
    )
    users = result.scalars().all()

    return [
        {"id": u.id, "username": u.username, "email": u.email, "role": u.role.value}
        for u in users
    ]
