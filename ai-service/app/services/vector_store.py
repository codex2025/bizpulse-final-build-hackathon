import os
import logging
from typing import List, Dict, Any, Optional
from app.services.lite_vector_store import LiteVectorClient
from app.config import settings
from app.services.embedder import LocalEmbedder

logger = logging.getLogger(__name__)

class ChromaVectorStore:
    _instance = None
    _client = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ChromaVectorStore, cls).__new__(cls)
            cls._instance._init_client()
        return cls._instance

    def _init_client(self):
        # In-memory vector store (see lite_vector_store.py) instead of a real ChromaDB
        # client: this project always supplies its own precomputed embeddings (below),
        # so a persistent on-disk database buys nothing here and is a poor fit for a
        # serverless filesystem. Collections are rebuilt from source documents on each
        # cold start regardless of which store backs them.
        self.embedder = LocalEmbedder()
        self._client = LiteVectorClient(embed_fn=self.embedder.embed_documents)
        logger.info("Initialized in-memory vector store")

    def get_or_create_collection(self, contract_id: str):
        # Collection names must be 3-63 characters, alphanumeric, underscores or hyphens
        safe_name = f"contract_{contract_id.replace('-', '_')}"[:60]
        return self._client.get_or_create_collection(
            name=safe_name,
            metadata={"hnsw:space": "cosine"}
        )

    def ingest_chunks(self, contract_id: str, chunks: List[Dict[str, Any]]) -> str:
        if not chunks:
            return ""

        collection = self.get_or_create_collection(contract_id)
        
        texts = [c["text"] for c in chunks]
        embeddings = self.embedder.embed_documents(texts)
        ids = [f"{contract_id}_{c['chunk_id']}" for c in chunks]
        metadatas = [{
            "chunk_id": c["chunk_id"],
            "chunk_index": c["chunk_index"],
            "page_number": c["page_number"],
            "section_title": c.get("section_title", ""),
        } for c in chunks]

        # Upsert into ChromaDB collection
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )
        return collection.name

    def query(self, contract_id: str, query_text: str, top_k: int = 4) -> List[Dict[str, Any]]:
        collection = self.get_or_create_collection(contract_id)
        query_embedding = self.embedder.embed_query(query_text)

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, max(1, collection.count())),
            include=["documents", "metadatas", "distances"]
        )

        matched_chunks = []
        if results and results.get("documents") and len(results["documents"]) > 0:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
            dists = results["distances"][0] if results.get("distances") else [0.0] * len(docs)

            for doc, meta, dist in zip(docs, metas, dists):
                matched_chunks.append({
                    "text": doc,
                    "chunk_id": meta.get("chunk_id", ""),
                    "page_number": meta.get("page_number", 1),
                    "section_title": meta.get("section_title", ""),
                    "score": round(1.0 - float(dist), 4),
                })
        return matched_chunks

    def get_all_chunks(self, contract_id: str) -> List[Dict[str, Any]]:
        collection = self.get_or_create_collection(contract_id)
        results = collection.get(include=["documents", "metadatas"])
        chunks = []
        if results and results.get("documents"):
            for doc, meta in zip(results["documents"], results["metadatas"]):
                chunks.append({
                    "text": doc,
                    "chunk_id": meta.get("chunk_id", ""),
                    "page_number": meta.get("page_number", 1),
                    "section_title": meta.get("section_title", ""),
                })
        return chunks
