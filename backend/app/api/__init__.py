from fastapi import APIRouter

from app.api import auth, auth_codes, datasets, export, folders, items, share, tasks, users

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["数据集"])
api_router.include_router(folders.router, prefix="/folders", tags=["目录"])
api_router.include_router(items.router, prefix="/items", tags=["语料"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["任务"])
api_router.include_router(share.router, prefix="/share", tags=["分享"])
api_router.include_router(export.router, prefix="/export", tags=["导出"])
api_router.include_router(users.router)
api_router.include_router(auth_codes.router)
