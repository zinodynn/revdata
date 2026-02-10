"""
去重配置管理器 - 统一处理配置优先级和合并
支持三层配置结构：数据集级 > 系统级 > 内置默认
"""
from typing import Any, Dict, Optional

from app.core.config import settings


class DedupConfigManager:
    """
    去重配置管理器 - 处理三层配置的优先级和合并
    
    优先级：
    1. 数据集级配置（Dataset.dedup_config）
    2. 系统级配置（.env 文件）
    3. 内置默认值（代码中定义）
    """

    @staticmethod
    def get_system_embedding_config() -> Optional[Dict[str, Any]]:
        """
        从 .env 获取系统级 embedding 配置
        
        返回：
            如果配置了 EMBEDDING_API_URL，返回完整的 embedding 配置字典
            否则返回 None
        """
        if not settings.EMBEDDING_API_URL:
            return None

        return {
            "embedding_api_url": settings.EMBEDDING_API_URL,
            "embedding_api_key": settings.EMBEDDING_API_KEY,
            "embedding_model": settings.EMBEDDING_MODEL,
            "embedding_batch_size": settings.EMBEDDING_BATCH_SIZE,
            "embedding_concurrency": settings.EMBEDDING_CONCURRENCY,
        }

    @staticmethod
    def get_system_dedup_defaults() -> Dict[str, Any]:
        """
        从 .env 获取系统级去重默认值
        
        返回：
            包含系统级去重配置的字典
        """
        config = {
            "enabled": settings.DEDUP_ENABLED_BY_DEFAULT,
            "use_embedding": settings.DEDUP_USE_EMBEDDING_BY_DEFAULT,
            "similarity_threshold": settings.DEDUP_SIMILARITY_THRESHOLD,
            "query_field": settings.DEDUP_QUERY_FIELD,
        }

        # 如果启用了 embedding，添加 embedding 配置
        if config["use_embedding"]:
            embedding_cfg = DedupConfigManager.get_system_embedding_config()
            if embedding_cfg:
                config.update(embedding_cfg)

        return config

    @staticmethod
    def merge_configs(
        dataset_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        合并配置，按优先级应用
        
        优先级：
        1. 数据集配置中的非 None 值（最高）
        2. 系统配置（.env）
        3. 内置默认值（最低）
        
        参数：
            dataset_config: 数据集级的去重配置（来自 Dataset.dedup_config）
        
        返回：
            合并后的完整配置字典
        """
        # 开始使用系统级配置作为基础
        merged = DedupConfigManager.get_system_dedup_defaults()

        # 使用数据集配置覆盖系统配置（仅非 None 的值）
        if dataset_config:
            for key, value in dataset_config.items():
                if value is not None:
                    merged[key] = value

        # 确保关键字段都有值
        merged.setdefault("enabled", False)
        merged.setdefault("use_embedding", False)
        merged.setdefault("similarity_threshold", 0.8)
        merged.setdefault("query_field", "question")

        return merged

    @staticmethod
    def is_embedding_configured() -> bool:
        """检查系统是否配置了 embedding API"""
        return bool(settings.EMBEDDING_API_URL)

    @staticmethod
    def get_effective_config(
        dataset_config: Optional[Dict[str, Any]] = None,
        skip_duplicates: bool = True,
    ) -> Dict[str, Any]:
        """
        获取有效的去重配置
        
        参数：
            dataset_config: 数据集级配置
            skip_duplicates: 是否启用去重（用于控制整个去重流程）
        
        返回：
            如果不需要去重，返回 {"enabled": False}
            否则返回完整的合并配置
        """
        if not skip_duplicates:
            return {"enabled": False}

        # 检查数据集是否已配置去重
        if dataset_config and dataset_config.get("enabled"):
            return DedupConfigManager.merge_configs(dataset_config)

        # 如果数据集未启用，检查系统级默认配置
        if settings.DEDUP_ENABLED_BY_DEFAULT:
            return DedupConfigManager.get_system_dedup_defaults()

        # 都未启用时，使用最小默认值（文本去重）
        return {
            "enabled": True,  # 允许去重逻辑运行
            "use_embedding": False,
            "similarity_threshold": 0.8,
            "query_field": "question",
        }
