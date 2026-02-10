"""
去重服务模块
支持两种去重策略:
1. Embedding API 语义去重 (使用 faiss-cpu 向量库)
2. 文本相似度去重 (Jaccard / SimHash)
"""

import hashlib
import os
import pickle
import re
from abc import ABC, abstractmethod
from typing import List, Optional, Tuple

import httpx
import numpy as np


class BaseDeduplicator(ABC):
    """去重器基类"""

    @abstractmethod
    async def build_index(self, existing_texts: List[str]) -> None:
        """基于现有文本构建索引"""
        pass

    @abstractmethod
    async def check_duplicates(
        self, new_texts: List[str], threshold: float = 0.8
    ) -> List[bool]:
        """
        检查新文本列表中哪些是重复的
        返回: bool 列表, True 表示重复
        """
        pass

    @abstractmethod
    async def add_to_index(self, texts: List[str]) -> None:
        """将非重复文本追加到索引中"""
        pass

    @abstractmethod
    def save_index(self, path: str) -> None:
        """持久化索引到文件"""
        pass

    @abstractmethod
    def load_index(self, path: str) -> bool:
        """从文件加载索引, 返回是否成功"""
        pass


class TextSimilarityDeduplicator(BaseDeduplicator):
    """基于文本相似度的去重器 (Jaccard)"""

    def __init__(self):
        self._existing_shingles: List[set] = []
        self._existing_texts: List[str] = []

    @staticmethod
    def _tokenize(text: str) -> set:
        """将文本分为 n-gram shingles"""
        text = re.sub(r"\s+", " ", text.strip().lower())
        n = 3
        if len(text) < n:
            return {text}
        return {text[i : i + n] for i in range(len(text) - n + 1)}

    @staticmethod
    def _jaccard(s1: set, s2: set) -> float:
        if not s1 or not s2:
            return 0.0
        intersection = len(s1 & s2)
        union = len(s1 | s2)
        return intersection / union if union > 0 else 0.0

    async def build_index(self, existing_texts: List[str]) -> None:
        self._existing_texts = list(existing_texts)
        self._existing_shingles = [self._tokenize(t) for t in self._existing_texts]

    async def check_duplicates(
        self, new_texts: List[str], threshold: float = 0.8
    ) -> List[bool]:
        results = []
        for text in new_texts:
            shingles = self._tokenize(text)
            is_dup = False
            for existing in self._existing_shingles:
                if self._jaccard(shingles, existing) >= threshold:
                    is_dup = True
                    break
            results.append(is_dup)
        return results

    async def add_to_index(self, texts: List[str]) -> None:
        for text in texts:
            self._existing_texts.append(text)
            self._existing_shingles.append(self._tokenize(text))

    def save_index(self, path: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(
                {
                    "texts": self._existing_texts,
                    "shingles": self._existing_shingles,
                },
                f,
            )

    def load_index(self, path: str) -> bool:
        if not os.path.exists(path):
            return False
        try:
            with open(path, "rb") as f:
                data = pickle.load(f)
            self._existing_texts = data["texts"]
            self._existing_shingles = data["shingles"]
            return True
        except Exception:
            return False


class EmbeddingDeduplicator(BaseDeduplicator):
    """基于 Embedding API + FAISS 向量库的语义去重器"""

    def __init__(
        self,
        api_url: str,
        api_key: Optional[str] = None,
        model: str = "text-embedding-ada-002",
        batch_size: int = 32,
        concurrency: int = 1,
    ):
        self.api_url = api_url
        self.api_key = api_key
        self.model = model
        self.batch_size = batch_size
        self.concurrency = concurrency
        self._index = None  # faiss index
        self._dimension: Optional[int] = None
        self._count: int = 0

    async def _get_embeddings(self, texts: List[str]) -> np.ndarray:
        """调用 Embedding API 获取向量"""
        all_embeddings = []
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async with httpx.AsyncClient(timeout=120) as client:
            for i in range(0, len(texts), self.batch_size):
                batch = texts[i : i + self.batch_size]
                # 兼容 OpenAI 格式的 Embedding API
                payload = {"input": batch, "model": self.model}
                resp = await client.post(
                    self.api_url, json=payload, headers=headers
                )
                resp.raise_for_status()
                data = resp.json()

                # 解析响应: 支持 OpenAI 格式
                if "data" in data:
                    batch_embs = [item["embedding"] for item in data["data"]]
                elif "embeddings" in data:
                    batch_embs = data["embeddings"]
                else:
                    raise ValueError(
                        f"Unexpected embedding response format: {list(data.keys())}"
                    )

                all_embeddings.extend(batch_embs)

        return np.array(all_embeddings, dtype=np.float32)

    def _ensure_index(self, dimension: int):
        """确保 FAISS 索引已创建"""
        if self._index is None:
            try:
                import faiss
            except ImportError:
                raise ImportError(
                    "faiss-cpu is required for embedding dedup. "
                    "Install it with: pip install faiss-cpu"
                )
            self._dimension = dimension
            self._index = faiss.IndexFlatIP(dimension)  # 内积相似度

    @staticmethod
    def _normalize(vectors: np.ndarray) -> np.ndarray:
        """L2 归一化, 使内积等于余弦相似度"""
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return vectors / norms

    async def build_index(self, existing_texts: List[str]) -> None:
        if not existing_texts:
            return
        embeddings = await self._get_embeddings(existing_texts)
        embeddings = self._normalize(embeddings)
        self._ensure_index(embeddings.shape[1])
        self._index.add(embeddings)
        self._count = len(existing_texts)

    async def check_duplicates(
        self, new_texts: List[str], threshold: float = 0.8
    ) -> List[bool]:
        if not new_texts:
            return []
        if self._index is None or self._count == 0:
            return [False] * len(new_texts)

        embeddings = await self._get_embeddings(new_texts)
        embeddings = self._normalize(embeddings)

        # 搜索最近邻
        scores, _ = self._index.search(embeddings, 1)
        results = []
        for score in scores:
            # score[0] 是最高相似度
            results.append(float(score[0]) >= threshold)
        return results

    async def add_to_index(self, texts: List[str]) -> None:
        if not texts:
            return
        embeddings = await self._get_embeddings(texts)
        embeddings = self._normalize(embeddings)
        self._ensure_index(embeddings.shape[1])
        self._index.add(embeddings)
        self._count += len(texts)

    def save_index(self, path: str) -> None:
        if self._index is None:
            return
        try:
            import faiss

            os.makedirs(os.path.dirname(path), exist_ok=True)
            faiss.write_index(self._index, path)
            # 同时保存元数据
            meta_path = path + ".meta"
            with open(meta_path, "wb") as f:
                pickle.dump(
                    {"dimension": self._dimension, "count": self._count}, f
                )
        except ImportError:
            pass

    def load_index(self, path: str) -> bool:
        if not os.path.exists(path):
            return False
        try:
            import faiss

            self._index = faiss.read_index(path)
            meta_path = path + ".meta"
            if os.path.exists(meta_path):
                with open(meta_path, "rb") as f:
                    meta = pickle.load(f)
                self._dimension = meta.get("dimension")
                self._count = meta.get("count", 0)
            else:
                self._count = self._index.ntotal
                self._dimension = self._index.d
            return True
        except Exception:
            return False


def get_dedup_index_path(dataset_id: int, use_embedding: bool) -> str:
    """获取去重索引文件路径"""
    suffix = "faiss" if use_embedding else "jaccard.pkl"
    return os.path.join("uploads", "dedup_index", f"dataset_{dataset_id}.{suffix}")


def extract_query_text(item: dict, query_field: str) -> str:
    """从数据项中提取用于去重比较的文本"""
    if query_field in item:
        val = item[query_field]
        if isinstance(val, str):
            return val
        return str(val)

    # 如果是 messages 格式, 提取第一个 user 消息
    messages = item.get("messages", [])
    if isinstance(messages, list):
        for msg in messages:
            if isinstance(msg, dict) and msg.get("role") == "user":
                return str(msg.get("content", ""))

    # fallback: 拼接所有字符串值
    parts = []
    for v in item.values():
        if isinstance(v, str):
            parts.append(v)
    return " ".join(parts)


async def create_deduplicator(
    dedup_config: dict,
) -> BaseDeduplicator:
    """根据配置创建去重器"""
    use_embedding = dedup_config.get("use_embedding", False)
    embedding_api_url = dedup_config.get("embedding_api_url")

    if use_embedding and embedding_api_url:
        return EmbeddingDeduplicator(
            api_url=embedding_api_url,
            api_key=dedup_config.get("embedding_api_key"),
            model=dedup_config.get("embedding_model", "text-embedding-ada-002"),
            batch_size=dedup_config.get("embedding_batch_size", 32),
            concurrency=dedup_config.get("embedding_concurrency", 1),
        )
    else:
        return TextSimilarityDeduplicator()
