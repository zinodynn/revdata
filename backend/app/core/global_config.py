"""
全局配置管理 - 用于存储和读取全局默认设置
"""
import json
import os
from typing import Any, Dict, Optional

from app.core.config import settings


GLOBAL_CONFIG_FILE = os.path.join(settings.UPLOAD_DIR, "global_config.json")


def get_global_config(key: str, default: Any = None) -> Any:
    """读取全局配置值"""
    if not os.path.exists(GLOBAL_CONFIG_FILE):
        return default
    
    try:
        with open(GLOBAL_CONFIG_FILE, "r", encoding="utf-8") as f:
            config = json.load(f)
            return config.get(key, default)
    except Exception:
        return default


def set_global_config(key: str, value: Any) -> None:
    """设置全局配置值"""
    # 确保 UPLOAD_DIR 存在
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    config = {}
    if os.path.exists(GLOBAL_CONFIG_FILE):
        try:
            with open(GLOBAL_CONFIG_FILE, "r", encoding="utf-8") as f:
                config = json.load(f)
        except Exception:
            config = {}
    
    config[key] = value
    
    with open(GLOBAL_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def get_dedup_defaults() -> Optional[Dict[str, Any]]:
    """获取去重默认配置"""
    return get_global_config("dedup_defaults")


def set_dedup_defaults(config: Dict[str, Any]) -> None:
    """设置去重默认配置"""
    set_global_config("dedup_defaults", config)
