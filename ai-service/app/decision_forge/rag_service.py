"""
RAG Semantic Notes Service using ChromaDB.
Indexes rep activity notes and retrieves evidence quotes to support decisions.
"""
from typing import List, Dict, Any, Optional
from app.services.embedder import LocalEmbedder
from app.services.lite_vector_store import LiteVectorClient

# In-memory vector store (see lite_vector_store.py), not a persistent ChromaDB
# database: the corpus here is re-indexed from the active dataset on every load
# (index_opportunities), so nothing is lost by rebuilding it on each cold start,
# and this avoids a real chromadb client's ~90MB default-embedding-model download
# on first use -- a poor fit for a serverless deployment.

class NotesRagService:
    def __init__(self):
        self.embedder = LocalEmbedder()
        self.client = LiteVectorClient(embed_fn=self.embedder.embed_documents)
        self.collection_name = "crm_sales_notes"
        self.collection = self.client.get_or_create_collection(name=self.collection_name)

    def index_opportunities(self, opportunities: List[Dict[str, Any]]):
        ids = []
        documents = []
        metadatas = []

        for opp in opportunities:
            opp_id = opp.get("opportunity_id", "")
            comp = opp.get("company_name", "")
            notes = opp.get("sales_notes", [])
            
            for idx, note in enumerate(notes):
                doc_id = f"{opp_id}_note_{idx}"
                ids.append(doc_id)
                documents.append(f"Company: {comp}. Note: {note}")
                metadatas.append({
                    "opportunity_id": opp_id,
                    "company_name": comp,
                    "stage": opp.get("stage", ""),
                    "note_index": idx
                })

        if ids:
            try:
                self.collection.upsert(
                    ids=ids,
                    documents=documents,
                    metadatas=metadatas
                )
            except Exception as e:
                print(f"[RAG] ChromaDB upsert notice: {e}")

    def retrieve_evidence(self, query: str, opportunity_id: Optional[str] = None, top_k: int = 3) -> List[Dict[str, Any]]:
        where_clause = {"opportunity_id": opportunity_id} if opportunity_id else None
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=top_k,
                where=where_clause
            )
            
            snippets = []
            if results and "documents" in results and results["documents"]:
                docs = results["documents"][0]
                metas = results["metadatas"][0] if "metadatas" in results else [{}] * len(docs)
                for doc, meta in zip(docs, metas):
                    snippets.append({
                        "snippet": doc,
                        "company_name": meta.get("company_name", ""),
                        "opportunity_id": meta.get("opportunity_id", "")
                    })
            return snippets
        except Exception as e:
            print(f"[RAG] Retrieve notice: {e}")
            return []
