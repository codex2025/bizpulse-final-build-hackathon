"""
RAG over business notes.

Pipeline: note -> sentence-aware chunks -> embed -> in-memory vector store -> metadata-filtered
candidate retrieval -> hybrid rerank (embedding cosine + lexical query coverage) -> relevance
threshold -> evidence with full source references.

Every returned item carries doc id, record id, source type, created_at, text and a relevance
score, and there is an explicit "insufficient evidence" outcome instead of padding results with
weak matches. Notes are DATA: they are indexed and quoted, never executed as instructions.

The vector store is in-memory (see lite_vector_store.py) and *per NotesRagService instance*, so a
workspace that owns its own instance can never retrieve another workspace's notes.
"""
import logging
import re
from typing import List, Dict, Any, Optional
from app.services.embedder import LocalEmbedder
from app.services.lite_vector_store import LiteVectorClient

logger = logging.getLogger(__name__)

DEFAULT_MIN_RELEVANCE = 0.18
MAX_CHUNK_CHARS = 300
CANDIDATE_POOL = 12
INSUFFICIENT_EVIDENCE = "Insufficient evidence."

_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was", "were", "with", "at",
    "by", "it", "this", "that", "which", "what", "who", "how", "we", "our", "should", "do", "does", "has",
    "have", "had", "be", "as", "from", "about", "any", "me", "us", "you", "your", "their", "its",
}


def tokenize(text: str) -> List[str]:
    return [t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if t not in _STOPWORDS and len(t) > 1]


def chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> List[str]:
    """Greedy sentence packing; a single over-long sentence becomes its own chunk."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", (text or "").strip()) if s.strip()]
    chunks: List[str] = []
    current = ""
    for s in sentences:
        if current and len(current) + 1 + len(s) > max_chars:
            chunks.append(current)
            current = s
        else:
            current = f"{current} {s}".strip()
    if current:
        chunks.append(current)
    return chunks


def _lexical_coverage(query_tokens: List[str], doc_tokens: List[str]) -> float:
    if not query_tokens:
        return 0.0
    doc_set = set(doc_tokens)
    return sum(1 for t in set(query_tokens) if t in doc_set) / len(set(query_tokens))


def normalized_notes(opp: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Structured notes if the record has them, else wrap the plain `sales_notes` strings.
    No created_at is invented for plain notes."""
    opp_id = opp.get("opportunity_id", "")
    structured = opp.get("notes")
    if structured:
        return [
            {"id": n.get("id", f"{opp_id}_note_{i}"), "text": n.get("text") or n.get("note_text") or "",
             "created_at": n.get("created_at"), "author": n.get("author_id")}
            for i, n in enumerate(structured)
        ]
    return [
        {"id": f"{opp_id}_note_{i}", "text": str(t), "created_at": None, "author": None}
        for i, t in enumerate(opp.get("sales_notes") or [])
    ]


class NotesRagService:
    def __init__(self, collection_name: str = "crm_sales_notes"):
        self.embedder = LocalEmbedder()
        self.client = LiteVectorClient(embed_fn=self.embedder.embed_documents)
        self.collection_name = collection_name
        self.collection = self.client.get_or_create_collection(name=self.collection_name)

    def reset(self) -> None:
        """Drops every indexed document (a fresh dataset load must not leave old notes behind)."""
        self.client = LiteVectorClient(embed_fn=self.embedder.embed_documents)
        self.collection = self.client.get_or_create_collection(name=self.collection_name)

    def index_opportunities(self, opportunities: List[Dict[str, Any]]) -> int:
        ids, documents, metadatas = [], [], []
        for opp in opportunities:
            opp_id = opp.get("opportunity_id", "")
            comp = opp.get("company_name", "")
            for note in normalized_notes(opp):
                for k, chunk in enumerate(chunk_text(note["text"])):
                    ids.append(f"{note['id']}#c{k}")
                    documents.append(f"Company: {comp}. Note: {chunk}")
                    metadatas.append({
                        "doc_id": f"{note['id']}#c{k}",
                        "note_id": note["id"],
                        "opportunity_id": opp_id,
                        "customer_id": opp.get("customer_id", ""),
                        "company_name": comp,
                        "stage": opp.get("stage", ""),
                        "source_type": "sales_note",
                        "created_at": note["created_at"] or "",
                        "text": chunk,
                    })
        if ids:
            try:
                self.collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
            except Exception as e:
                logger.warning("RAG index notice: %s", e)
        return len(ids)

    def retrieve(
        self,
        query: str,
        opportunity_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        top_k: int = 3,
        min_relevance: Optional[float] = DEFAULT_MIN_RELEVANCE,
    ) -> Dict[str, Any]:
        """Returns {"status": "ok"|"insufficient_evidence"|"unavailable", "evidence": [...], "message"}.
        Never returns an item without its source reference."""
        where: Dict[str, Any] = {}
        if opportunity_id:
            where["opportunity_id"] = opportunity_id
        if customer_id:
            where["customer_id"] = customer_id
        try:
            res = self.collection.query(query_texts=[query], n_results=CANDIDATE_POOL, where=where or None)
        except Exception as e:
            logger.warning("RAG retrieve notice: %s", e)
            return {"status": "unavailable", "evidence": [], "message": "Evidence retrieval unavailable."}

        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        dists = (res.get("distances") or [[]])[0]
        q_tokens = tokenize(query)
        scored = []
        for doc, meta, dist in zip(docs, metas, dists):
            cosine = max(0.0, 1.0 - float(dist))
            lexical = _lexical_coverage(q_tokens, tokenize(meta.get("text", doc)))
            relevance = round(0.5 * cosine + 0.5 * lexical, 4)
            scored.append((relevance, doc, meta))
        # Stable order: relevance desc, then doc id, so ties never reorder between runs.
        scored.sort(key=lambda t: (-t[0], t[2].get("doc_id", "")))

        evidence = []
        for relevance, doc, meta in scored:
            if min_relevance is not None and relevance < min_relevance:
                continue
            evidence.append({
                "doc_id": meta.get("doc_id", ""),
                "record_id": meta.get("opportunity_id", ""),
                "opportunity_id": meta.get("opportunity_id", ""),
                "customer_id": meta.get("customer_id", ""),
                "source_type": meta.get("source_type", "sales_note"),
                "created_at": meta.get("created_at") or None,
                "company_name": meta.get("company_name", ""),
                "text": meta.get("text", doc),
                "snippet": meta.get("text", doc),
                "relevance": relevance,
            })
            if len(evidence) >= top_k:
                break
        if not evidence:
            return {"status": "insufficient_evidence", "evidence": [], "message": INSUFFICIENT_EVIDENCE}
        return {"status": "ok", "evidence": evidence, "message": ""}

    def retrieve_evidence(
        self,
        query: str,
        opportunity_id: Optional[str] = None,
        top_k: int = 3,
        min_relevance: Optional[float] = None,
        customer_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List form used by the decision engine for a record's OWN notes. The metadata filter
        already guarantees they belong to that opportunity, so no relevance floor applies
        unless the caller sets one."""
        return self.retrieve(query, opportunity_id, customer_id, top_k, min_relevance)["evidence"]
