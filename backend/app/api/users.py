import secrets
import string
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.dataset import Dataset
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

ROLE_HIERARCHY = {
    UserRole.SUPER_ADMIN: 4,
    UserRole.ADMIN: 3,
    UserRole.REVIEWER: 2,
    UserRole.VIEWER: 1,
}


@router.get("", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """获取用户列表"""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """获取用户详情"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.post("", response_model=UserResponse)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """创建用户"""
    # 检查用户名是否存在
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")

    # 检查邮箱是否存在
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="邮箱已存在")

    # 检查角色权限：只能创建比自己角色等级低的用户
    if current_user.role != UserRole.SUPER_ADMIN:
        if ROLE_HIERARCHY.get(data.role, 0) >= ROLE_HIERARCHY.get(current_user.role, 0):
            raise HTTPException(status_code=403, detail="无权创建同级或更高权限的用户")

    user = User(
        username=data.username,
        email=data.email,
        password_hash=get_password_hash(data.password),
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """更新用户"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 检查角色权限：普通管理员不能修改同级或更高权限的用户（除非是修改自己）
    if current_user.role != UserRole.SUPER_ADMIN and user.id != current_user.id:
        if ROLE_HIERARCHY.get(user.role, 0) >= ROLE_HIERARCHY.get(current_user.role, 0):
            raise HTTPException(status_code=403, detail="无权修改同级或更高权限的用户")

    if data.username is not None:
        user.username = data.username
    if data.email is not None:
        user.email = data.email
    if data.role is not None:
        # 检查角色设置权限
        if current_user.role != UserRole.SUPER_ADMIN:
            # 不能设置成比自己更高或同级的角色
            if ROLE_HIERARCHY.get(data.role, 0) >= ROLE_HIERARCHY.get(
                current_user.role, 0
            ):
                if data.role != user.role:  # 如果角色发生了变化
                    raise HTTPException(
                        status_code=403, detail="无权设置同级或更高权限的角色"
                    )
        user.role = data.role

    if data.is_active is not None:
        user.is_active = data.is_active

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """禁用用户"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能禁用自己")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 检查角色权限：普通管理员不能禁用同级或更高权限的用户
    if current_user.role != UserRole.SUPER_ADMIN:
        if ROLE_HIERARCHY.get(user.role, 0) >= ROLE_HIERARCHY.get(current_user.role, 0):
            raise HTTPException(status_code=403, detail="无权禁用同级或更高权限的用户")

    # 检查是否拥有数据集，如果有则不允许禁用，必须先转移所有权
    dataset_check = await db.execute(select(Dataset).where(Dataset.owner_id == user_id))
    if dataset_check.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="该用户拥有数据集，请先转移数据集所有权后再禁用"
        )

    user.is_active = False
    await db.commit()
    return {"message": "用户已禁用"}


@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """重置用户密码"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 检查角色权限：普通管理员不能重置同级或更高权限用户的密码（除非是自己）
    if current_user.role != UserRole.SUPER_ADMIN and user.id != current_user.id:
        if ROLE_HIERARCHY.get(user.role, 0) >= ROLE_HIERARCHY.get(current_user.role, 0):
            raise HTTPException(
                status_code=403, detail="无权重置同级或更高权限用户的密码"
            )

    # 生成随机密码
    new_password = "".join(
        secrets.choice(string.ascii_letters + string.digits) for _ in range(12)
    )
    user.password_hash = get_password_hash(new_password)

    await db.commit()
    return {"new_password": new_password}
