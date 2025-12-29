import logging
from typing import Optional

from app.core.database import get_db
from app.core.security import decode_token, oauth2_scheme, oauth2_scheme_optional
from app.models.auth_code import AuthCode, AuthCodeSession
from app.models.user import User, UserRole
from fastapi import Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> User:
    """获取当前登录用户"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    # 确保 user_id 是整数
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="用户已被禁用"
        )

    return user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """获取当前管理员用户"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")
    return current_user


async def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """可选的用户认证 - 不强制要求登录"""
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload is None:
            return None
        user_id = int(payload.get("sub"))
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    except Exception:
        return None


async def verify_session_token(
    session_token: str = Query(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[AuthCodeSession]:
    """验证授权码session_token"""
    if not session_token:
        return None

    result = await db.execute(
        select(AuthCodeSession).where(AuthCodeSession.session_token == session_token)
    )
    session = result.scalar_one_or_none()
    if logger.isEnabledFor(logging.DEBUG):
        logger.debug(
            "verify_session_token lookup",
            extra={
                "session_token": session_token,
                "found": bool(session),
                "is_left": getattr(session, "is_left", None),
                "expires_at": getattr(session, "expires_at", None),
            },
        )

    if not session or session.is_left:
        if session and session.is_left:
            logger.debug(
                "verify_session_token: session already left",
                extra={"session_token": session_token},
            )
        return None

    return session


async def get_auth_code_from_session(
    session: Optional[AuthCodeSession] = Depends(verify_session_token),
    db: AsyncSession = Depends(get_db),
) -> Optional[AuthCode]:
    """从session获取授权码"""
    if not session:
        return None

    result = await db.execute(
        select(AuthCode).where(AuthCode.id == session.auth_code_id)
    )
    return result.scalar_one_or_none()
