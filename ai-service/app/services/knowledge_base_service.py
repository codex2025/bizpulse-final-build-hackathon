import os
import json
import logging
import re
from typing import List, Dict, Any
from app.services.vector_store import ChromaVectorStore

logger = logging.getLogger(__name__)

class KnowledgeBaseService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(KnowledgeBaseService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.vector_store = ChromaVectorStore()
        self.glossary: List[Dict[str, Any]] = []
        self.red_flags: List[Dict[str, Any]] = []
        self._load_knowledge_base()
        self._index_into_chroma()
        self._initialized = True

    def _load_knowledge_base(self):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        glossary_path = os.path.join(base_dir, "knowledge_base", "glossary.json")
        red_flags_path = os.path.join(base_dir, "knowledge_base", "red_flags.json")

        if os.path.exists(glossary_path):
            with open(glossary_path, "r", encoding="utf-8") as f:
                self.glossary = json.load(f)
            logger.info(f"Loaded {len(self.glossary)} glossary terms from {glossary_path}")

        if os.path.exists(red_flags_path):
            with open(red_flags_path, "r", encoding="utf-8") as f:
                self.red_flags = json.load(f)
            logger.info(f"Loaded {len(self.red_flags)} red flag patterns from {red_flags_path}")

    def _index_into_chroma(self):
        try:
            # 1. Index Glossary
            if self.glossary:
                collection = self.vector_store._client.get_or_create_collection(
                    name="kb_glossary",
                    metadata={"hnsw:space": "cosine"}
                )
                if collection.count() < len(self.glossary):
                    texts = [f"{item['term']}: {item['plain_definition']}" for item in self.glossary]
                    ids = [f"glossary_{i}" for i in range(len(self.glossary))]
                    metadatas = [{"term": item["term"], "category": item.get("category", "General"), "definition": item["plain_definition"]} for item in self.glossary]
                    embeddings = self.vector_store.embedder.embed_documents(texts)
                    collection.upsert(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)
                    logger.info("Successfully indexed glossary into ChromaDB (kb_glossary)")

            # 2. Index Red Flags
            if self.red_flags:
                rf_collection = self.vector_store._client.get_or_create_collection(
                    name="kb_red_flags",
                    metadata={"hnsw:space": "cosine"}
                )
                if rf_collection.count() < len(self.red_flags):
                    texts = [f"{item['pattern_name']} - {item['pattern_description']} (Why risky: {item['why_risky']})" for item in self.red_flags]
                    ids = [f"rf_{item.get('id', i)}" for i, item in enumerate(self.red_flags)]
                    metadatas = [{
                        "pattern_id": item.get("id", str(i)),
                        "pattern_name": item["pattern_name"],
                        "severity": item.get("severity", "Medium"),
                        "why_risky": item.get("why_risky", ""),
                        "mitigation_tip": item.get("mitigation_tip", "")
                    } for i, item in enumerate(self.red_flags)]
                    embeddings = self.vector_store.embedder.embed_documents(texts)
                    rf_collection.upsert(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)
                    logger.info("Successfully indexed red flags into ChromaDB (kb_red_flags)")
        except Exception as e:
            logger.warning(f"Could not index knowledge bases into ChromaDB: {e}")

    def get_full_glossary(self) -> List[Dict[str, Any]]:
        return self.glossary

    def get_all_red_flags(self) -> List[Dict[str, Any]]:
        return self.red_flags

    def detect_glossary_terms_in_text(self, text: str) -> List[Dict[str, Any]]:
        """
        Scans text and returns matched glossary definitions.
        Uses exact/regex term matching first, then semantic lookup.
        """
        matched = []
        seen_terms = set()
        text_lower = text.lower()

        # Exact and partial word boundary match
        for item in self.glossary:
            term_clean = item["term"].lower()
            # If term has slash or parenthesis (e.g. "Prepayment Penalty / Foreclosure Charge")
            sub_terms = re.split(r'[/()]', term_clean)
            for sub in sub_terms:
                sub = sub.strip()
                if len(sub) > 2 and re.search(r'\b' + re.escape(sub) + r'\b', text_lower):
                    if item["term"] not in seen_terms:
                        seen_terms.add(item["term"])
                        matched.append({
                            "term": item["term"],
                            "definition": item["plain_definition"],
                            "category": item.get("category", "General")
                        })
                    break

        return matched

    def detect_red_flags_in_text(self, text: str) -> List[Dict[str, Any]]:
        """
        Matches red flags by keyword triggers and semantic similarity.
        """
        detected = []
        text_lower = text.lower()

        for pattern in self.red_flags:
            keywords = pattern.get("keywords", [])
            matches = [kw for kw in keywords if kw.lower() in text_lower]
            if matches:
                detected.append({
                    "id": pattern.get("id"),
                    "pattern_name": pattern["pattern_name"],
                    "severity": pattern.get("severity", "Medium"),
                    "why_risky": pattern.get("why_risky"),
                    "mitigation_tip": pattern.get("mitigation_tip"),
                    "matched_trigger": matches[0]
                })

        return detected
