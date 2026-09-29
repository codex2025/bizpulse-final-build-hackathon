from typing import List
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class LocalEmbedder:
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LocalEmbedder, cls).__new__(cls)
            cls._instance._init_model()
        return cls._instance

    def _init_model(self):
        self._model = None
        self._initialized = False

    def _ensure_model(self):
        if not self._initialized:
            self._initialized = True
            try:
                from sentence_transformers import SentenceTransformer
                model_name = getattr(settings, "embedding_model", "sentence-transformers/all-MiniLM-L6-v2")
                logger.info(f"Loading local embedding model: {model_name}")
                self._model = SentenceTransformer(model_name)
            except Exception as e:
                logger.warning(f"SentenceTransformer not loaded ({e}). Using fallback embedding generation.")
                self._model = None

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        self._ensure_model()
        if self._model is not None:
            embeddings = self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
            return embeddings.tolist()
        # Fallback simple deterministic vector for dev/offline resilience if package missing
        return [self._fallback_embed(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        self._ensure_model()
        if self._model is not None:
            embedding = self._model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
            return embedding.tolist()
        return self._fallback_embed(text)

    def _fallback_embed(self, text: str) -> List[float]:
        import hashlib
        import math
        vec = [0.0] * 384
        for i, word in enumerate(text.lower().split()[:100]):
            h = int(hashlib.md5(word.encode()).hexdigest(), 16)
            idx = h % 384
            vec[idx] += 1.0 / math.sqrt(i + 1)
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        return [x / norm for x in vec]
