"""
Lightweight in-memory vector store, API-compatible with the small slice of the
ChromaDB client surface this project actually uses (get_or_create_collection,
upsert, query, get, count).

Why this exists: the real chromadb client, with no embedding_function passed in,
downloads its own ~90MB ONNX embedding model on first use. That's a bad fit for a
serverless deploy (slow/unreliable cold start, no guarantee /tmp survives between
invocations) and unnecessary for a hackathon-scale corpus (a handful of notes or
one contract's chunks). This module gives identical call signatures and behavior
(embeds text when none is supplied, cosine-similarity search) using only the
existing local fallback embedder (see embedder.py) and the standard library.

Collections are held in a process-wide dict, so they behave like chromadb's
PersistentClient for the lifetime of one running instance -- rebuilt from source
data on each cold start, exactly like the real client already needed to be for a
serverless filesystem.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Sequence


def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a)) or 1.0
    norm_b = math.sqrt(sum(x * x for x in b)) or 1.0
    return dot / (norm_a * norm_b)


class _Collection:
    def __init__(self, name: str, embed_fn):
        self.name = name
        self._embed_fn = embed_fn
        self._ids: List[str] = []
        self._embeddings: List[List[float]] = []
        self._documents: List[str] = []
        self._metadatas: List[Dict[str, Any]] = []

    def upsert(
        self,
        ids: List[str],
        documents: Optional[List[str]] = None,
        embeddings: Optional[List[List[float]]] = None,
        metadatas: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        documents = documents or [""] * len(ids)
        metadatas = metadatas or [{} for _ in ids]
        embeddings = embeddings if embeddings is not None else self._embed_fn(documents)

        for doc_id, doc, emb, meta in zip(ids, documents, embeddings, metadatas):
            if doc_id in self._ids:
                idx = self._ids.index(doc_id)
                self._documents[idx] = doc
                self._embeddings[idx] = emb
                self._metadatas[idx] = meta
            else:
                self._ids.append(doc_id)
                self._documents.append(doc)
                self._embeddings.append(emb)
                self._metadatas.append(meta)

    def count(self) -> int:
        return len(self._ids)

    def query(
        self,
        query_texts: Optional[List[str]] = None,
        query_embeddings: Optional[List[List[float]]] = None,
        n_results: int = 3,
        where: Optional[Dict[str, Any]] = None,
        include: Optional[List[str]] = None,
    ) -> Dict[str, List[List[Any]]]:
        if query_embeddings is not None:
            query_vecs = query_embeddings
        else:
            query_vecs = self._embed_fn(query_texts or [""])

        candidate_idx = [
            i
            for i in range(len(self._ids))
            if not where or all(self._metadatas[i].get(k) == v for k, v in where.items())
        ]

        docs_out, metas_out, dists_out = [], [], []
        for qvec in query_vecs:
            scored = sorted(
                ((_cosine(qvec, self._embeddings[i]), i) for i in candidate_idx),
                key=lambda t: t[0],
                reverse=True,
            )[: max(0, n_results)]
            docs_out.append([self._documents[i] for _, i in scored])
            metas_out.append([self._metadatas[i] for _, i in scored])
            # Chroma reports a distance (lower = closer); mirror that from cosine similarity.
            dists_out.append([1.0 - score for score, _ in scored])

        return {"documents": docs_out, "metadatas": metas_out, "distances": dists_out}

    def get(self, include: Optional[List[str]] = None) -> Dict[str, List[Any]]:
        return {"ids": list(self._ids), "documents": list(self._documents), "metadatas": list(self._metadatas)}


class LiteVectorClient:
    """Drop-in stand-in for chromadb's PersistentClient/EphemeralClient."""

    def __init__(self, embed_fn, path: Optional[str] = None):
        self._embed_fn = embed_fn
        self._collections: Dict[str, _Collection] = {}

    def get_or_create_collection(self, name: str, metadata: Optional[Dict[str, Any]] = None) -> _Collection:
        if name not in self._collections:
            self._collections[name] = _Collection(name, self._embed_fn)
        return self._collections[name]
