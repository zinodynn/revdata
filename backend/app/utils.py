from typing import Any

# Invisible/control characters often appearing in uploaded files
INVISIBLE_CHARS = ["\ufeff", "\u200b", "\u200e", "\u200f", "\u00a0"]


def _strip_invisible(s: str) -> str:
    """Remove common invisible/control characters and trim whitespace."""
    if not isinstance(s, str):
        return s
    out = s
    for c in INVISIBLE_CHARS:
        out = out.replace(c, "")
    # trim common leading/trailing whitespace after removal
    out = out.strip()
    return out


def normalize_json_keys(obj: Any) -> Any:
    """Recursively normalize dict keys and string values by removing common invisible characters.

    - For dicts: create a new dict with keys stripped of invisible chars and values normalized.
    - For lists/tuples: normalize each element.
    - For strings: remove invisible chars.
    - Other types: returned unchanged.
    """
    if isinstance(obj, dict):
        new = {}
        for k, v in obj.items():
            nk = k
            if isinstance(k, str):
                nk = _strip_invisible(k)
            new[nk] = normalize_json_keys(v)
        return new

    if isinstance(obj, list):
        return [normalize_json_keys(v) for v in obj]

    if isinstance(obj, tuple):
        return tuple(normalize_json_keys(v) for v in obj)

    if isinstance(obj, str):
        return _strip_invisible(obj)

    return obj

"""
字段检测和格式分析工具 - 支持更完整的字段扫描和格式冲突检测
"""
from typing import Any, Dict, List, Optional, Set, Tuple
import json
from collections import Counter


class FieldDetectionUtils:
    """字段检测工具类"""

    # 字段类型映射
    QUESTION_FIELD_KEYS = [
        "instruction",
        "question",
        "prompt",
        "input",
        "query",
        "user",
        "human",
        "q",
    ]
    ANSWER_FIELD_KEYS = [
        "output",
        "answer",
        "completion",
        "response",
        "assistant",
        "bot",
        "reply",
        "a",
    ]
    THINKING_FIELD_KEYS = [
        "thinking",
        "reasoning",
        "thought",
        "chain_of_thought",
        "cot",
        "rationale",
    ]
    CONTEXT_FIELD_KEYS = ["system", "system_prompt", "context", "instruction_prefix"]
    MESSAGES_FIELD_KEYS = ["messages", "conversations", "dialogue", "chat", "turns"]
    IMAGE_FIELD_KEYS = ["image", "images", "img", "imgs", "picture", "pictures"]

    @staticmethod
    def scan_all_fields(
        items: List[dict], sample_size: Optional[int] = None
    ) -> Set[str]:
        """
        扫描所有数据项的所有字段，而不是只检查前几条
        
        参数：
            items: 数据项列表
            sample_size: 最大扫描条数（None 表示扫描全部）
        
        返回：
            所有出现过的字段名集合
        """
        all_fields = set()
        
        if sample_size is None:
            sample_size = len(items)
        
        for item in items[:sample_size]:
            if isinstance(item, dict):
                all_fields.update(item.keys())
        
        return all_fields

    @staticmethod
    def detect_format_type(items: List[dict]) -> Dict[str, Any]:
        """
        检测数据的格式类型
        
        返回：
            {
                'format_type': 'multi_turn' | 'single_turn' | 'qa_pair' | 'plain',
                'format_hints': [...],  # 格式线索
                'confidence': 0.0-1.0,  # 置信度
                'format_distribution': {...}  # 各种格式的分布统计
            }
        """
        if not items:
            return {
                "format_type": "plain",
                "format_hints": [],
                "confidence": 0.0,
                "format_distribution": {},
            }

        format_indicators = Counter()
        format_hints = []

        for item in items:
            if not isinstance(item, dict):
                continue

            # 检测多轮对话格式
            if "messages" in item or "conversations" in item:
                messages_key = "messages" if "messages" in item else "conversations"
                value = item.get(messages_key)
                if isinstance(value, list) and len(value) > 1:
                    format_indicators["multi_turn"] += 1
                    if "multi_turn" not in format_hints:
                        format_hints.append(
                            f"检测到多轮对话格式（{messages_key} 字段有多条消息）"
                        )

            # 检测单轮对话格式
            if "question" in item or "instruction" in item or "prompt" in item:
                if "answer" in item or "output" in item or "response" in item:
                    format_indicators["single_turn"] += 1
                    if "single_turn" not in format_hints:
                        format_hints.append("检测到单轮对话格式（question+answer）")

            # 检测 QA Pair 格式
            if (
                "qa_pairs" in item
                or "qas" in item
                or "qa" in item
            ):
                qa_value = item.get("qa_pairs") or item.get("qas") or item.get("qa")
                if isinstance(qa_value, list):
                    format_indicators["qa_pair"] += 1
                    if "qa_pair" not in format_hints:
                        format_hints.append("检测到 QA Pair 列表格式")

        # 确定主要格式
        if format_indicators:
            dominant_format = format_indicators.most_common(1)[0]
            format_type = dominant_format[0]
            confidence = dominant_format[1] / len(items)
        else:
            format_type = "plain"
            confidence = 0.0

        return {
            "format_type": format_type,
            "format_hints": format_hints,
            "confidence": min(confidence, 1.0),
            "format_distribution": dict(format_indicators),
        }

    @staticmethod
    def check_field_consistency(items: List[dict]) -> Dict[str, Any]:
        """
        检查字段一致性，识别潜在的格式冲突
        
        返回：
            {
                'is_consistent': bool,
                'conflicts': [...],  # 发现的冲突
                'field_coverage': {...},  # 各字段覆盖率
                'recommendations': [...]  # 建议
            }
        """
        if not items:
            return {
                "is_consistent": True,
                "conflicts": [],
                "field_coverage": {},
                "recommendations": [],
            }

        # 统计每个字段出现的次数
        field_stats = {}
        total_items = len(items)

        for item in items:
            if not isinstance(item, dict):
                continue
            for key in item.keys():
                if key not in field_stats:
                    field_stats[key] = 0
                field_stats[key] += 1

        # 计算字段覆盖率
        field_coverage = {
            key: stats / total_items for key, stats in field_stats.items()
        }

        conflicts = []
        recommendations = []

        # 检测冲突：多个同义字段同时存在
        question_fields = [
            f for f in field_coverage.keys() if f in FieldDetectionUtils.QUESTION_FIELD_KEYS
        ]
        if len(question_fields) > 1:
            conflicts.append(
                f"检测到多个问题字段: {question_fields}（建议只使用一个）"
            )
            recommendations.append(f"统一使用其中一个问题字段：{question_fields[0]}")

        answer_fields = [
            f for f in field_coverage.keys() if f in FieldDetectionUtils.ANSWER_FIELD_KEYS
        ]
        if len(answer_fields) > 1:
            conflicts.append(f"检测到多个回答字段: {answer_fields}（建议只使用一个）")
            recommendations.append(f"统一使用其中一个回答字段：{answer_fields[0]}")

        # 检测覆盖率低的字段
        for key, coverage in field_coverage.items():
            if coverage < 0.5:
                conflicts.append(
                    f"字段 '{key}' 的覆盖率很低（{coverage*100:.1f}%），某些数据可能缺少此字段"
                )
            elif coverage < 0.9:
                recommendations.append(
                    f"字段 '{key}' 在部分数据中缺失（覆盖率 {coverage*100:.1f}%）"
                )

        is_consistent = len(conflicts) == 0

        return {
            "is_consistent": is_consistent,
            "conflicts": conflicts,
            "field_coverage": field_coverage,
            "recommendations": recommendations,
        }

    @staticmethod
    def analyze_multifile_format(
        all_items_by_file: Dict[str, List[dict]]
    ) -> Dict[str, Any]:
        """
        分析多个文件的格式是否一致
        
        参数：
            all_items_by_file: {'file1.jsonl': [...], 'file2.jsonl': [...]}
        
        返回：
            {
                'formats_by_file': {'file1.jsonl': {...}},
                'is_consistent': bool,
                'conflicts': [...],
                'recommendations': [...]
            }
        """
        formats_by_file = {}
        all_formats = []

        for filename, items in all_items_by_file.items():
            format_info = FieldDetectionUtils.detect_format_type(items)
            formats_by_file[filename] = format_info
            all_formats.append(format_info["format_type"])

        # 检查格式一致性
        unique_formats = set(all_formats)
        is_consistent = len(unique_formats) == 1

        conflicts = []
        recommendations = []

        if not is_consistent:
            conflicts.append(
                f"发现格式不一致！不同文件有不同的数据格式：{dict(zip(all_items_by_file.keys(), all_formats))}"
            )
            recommendations.append(
                "建议：\n"
                "1. 检查是否需要分开处理不同格式的数据\n"
                "2. 或者统一数据格式后再上传\n"
                "3. 或者使用「平面」模式显示所有数据"
            )

        return {
            "formats_by_file": formats_by_file,
            "is_consistent": is_consistent,
            "conflicts": conflicts,
            "recommendations": recommendations,
        }
