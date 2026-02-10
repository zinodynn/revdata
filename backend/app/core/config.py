from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Review Dataset Platform"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    ROOT_PATH: str = ""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/revdata"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # File Upload
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024 * 1024  # 10GB
    UPLOAD_DIR: str = "./uploads"

    # Embedding API 配置（系统级默认）
    EMBEDDING_API_URL: Optional[str] = None
    EMBEDDING_API_KEY: Optional[str] = None
    EMBEDDING_MODEL: str = "text-embedding-ada-002"
    EMBEDDING_BATCH_SIZE: int = 32
    EMBEDDING_CONCURRENCY: int = 1

    # 去重默认配置（系统级）
    DEDUP_ENABLED_BY_DEFAULT: bool = False
    DEDUP_SIMILARITY_THRESHOLD: float = 0.8
    DEDUP_QUERY_FIELD: str = "question"
    DEDUP_USE_EMBEDDING_BY_DEFAULT: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
