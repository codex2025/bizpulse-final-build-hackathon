import re
import json
import logging
import requests
from typing import Dict, Any, List
from concurrent.futures import ThreadPoolExecutor
from app.config import settings

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {
    "en": {"name": "English", "native": "English"},
    "hi": {"name": "Hindi", "native": "हिन्दी"},
    "ta": {"name": "Tamil", "native": "தமிழ்"},
    "te": {"name": "Telugu", "native": "తెలుగు"},
    "kn": {"name": "Kannada", "native": "ಕನ್ನಡ"},
    "mr": {"name": "Marathi", "native": "मराठी"},
    "bn": {"name": "Bengali", "native": "বাংলা"},
    "gu": {"name": "Gujarati", "native": "ગુજરાતી"},
}

# In-memory translation cache to guarantee instant subsequent requests
_TRANSLATION_CACHE: Dict[str, str] = {}

def dynamic_translate_text(text: str, target_lang: str) -> str:
    """
    Dynamically translates any arbitrary English sentence or paragraph 
    into the target Indian language using an online neural translation endpoint.
    """
    if not text or not isinstance(text, str) or target_lang == "en" or target_lang not in SUPPORTED_LANGUAGES:
        return text

    cache_key = f"{target_lang}:::{text.strip()}"
    if cache_key in _TRANSLATION_CACHE:
        return _TRANSLATION_CACHE[cache_key]

    try:
        url = "https://api.mymemory.translated.net/get"
        params = {"q": text.strip(), "langpair": f"en|{target_lang}"}
        resp = requests.get(url, params=params, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            translated = data.get("responseData", {}).get("translatedText")
            if translated and not translated.startswith("MYMEMORY WARNING"):
                _TRANSLATION_CACHE[cache_key] = translated
                return translated
    except Exception as e:
        logger.debug(f"Dynamic translation exception for '{text[:20]}': {e}")

    return text

class TranslationService:
    def __init__(self):
        self.llm = None
        if settings.openai_api_key and settings.openai_api_key.startswith("sk-"):
            try:
                from langchain_openai import ChatOpenAI
                self.llm = ChatOpenAI(
                    model=settings.model_name,
                    temperature=0,
                    api_key=settings.openai_api_key
                )
            except Exception as e:
                logger.warning(f"Could not initialize TranslationService LLM: {e}")
                self.llm = None

    def translate_contract_data(self, contract_data: Dict[str, Any], target_language: str = "en") -> Dict[str, Any]:
        """
        Dynamically translates every field in the contract analysis (executive summary, 
        decision verdict, reasons, and all clause fields) into the chosen Indian language.
        """
        if not target_language or target_language == "en" or target_language not in SUPPORTED_LANGUAGES:
            return contract_data

        target_meta = SUPPORTED_LANGUAGES[target_language]
        lang_name = target_meta["name"]
        native_name = target_meta["native"]

        # 1. Try LLM high-quality translation if configured and active
        if self.llm is not None:
            try:
                from langchain_core.prompts import ChatPromptTemplate
                prompt = ChatPromptTemplate.from_template("""
You are an expert bilingual financial and legal translator.
Translate the following contract analysis JSON from English into {target_lang} ({native_lang}).

Rules:
1. Translate executive summary points, decision reasons, clause simple explanations, financial impacts, and tips accurately into natural, clear {target_lang}.
2. Keep numbers, currencies (₹), percentages, and dates exact.
3. Keep original_text verbatim in English.
4. Return ONLY valid JSON with the exact same structure.

Input Data:
{data_json}
""")
                payload_subset = {
                    "executive_summary": contract_data.get("executive_summary", []),
                    "decision": contract_data.get("decision", {}),
                    "clauses": [
                        {
                            "clause_type": c.get("clause_type"),
                            "simple_explanation": c.get("simple_explanation"),
                            "financial_impact": c.get("financial_impact"),
                            "actionable_tip": c.get("actionable_tip"),
                            "red_flag_reason": c.get("red_flag_reason"),
                            "risk_level": c.get("risk_level"),
                            "is_red_flag": c.get("is_red_flag"),
                            "source_page": c.get("source_page"),
                            "original_text": c.get("original_text")
                        }
                        for c in contract_data.get("clauses", [])
                    ]
                }

                chain = prompt | self.llm
                result = chain.invoke({
                    "target_lang": lang_name,
                    "native_lang": native_name,
                    "data_json": json.dumps(payload_subset, ensure_ascii=False)
                })
                text = result.content.strip()
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                translated = json.loads(text.strip())

                translated_data = dict(contract_data)
                if "executive_summary" in translated:
                    translated_data["executive_summary"] = translated["executive_summary"]
                if "decision" in translated:
                    translated_data["decision"] = {**contract_data.get("decision", {}), **translated["decision"]}
                if "clauses" in translated:
                    translated_data["clauses"] = translated["clauses"]
                translated_data["active_language"] = target_language
                return translated_data
            except Exception as e:
                logger.warning(f"LLM translation failed ({e}). Using dynamic translation engine.")

        # 2. Fully Dynamic Parallel Neural Translation Engine
        translated_data = dict(contract_data)
        translated_data["active_language"] = target_language

        # Collect all dynamic texts that need translation
        raw_exec = contract_data.get("executive_summary", [])
        raw_decision = contract_data.get("decision", {})
        raw_reasons = raw_decision.get("reasons", [])
        raw_clauses = contract_data.get("clauses", [])

        # Build list of tasks for ThreadPoolExecutor for fast parallel translation
        texts_to_translate = []
        
        # Executive summary
        for pt in raw_exec:
            if pt: texts_to_translate.append(pt)

        # Decision texts
        if raw_decision.get("decision"): texts_to_translate.append(raw_decision["decision"])
        if raw_decision.get("action_headline"): texts_to_translate.append(raw_decision["action_headline"])
        if raw_decision.get("action_summary"): texts_to_translate.append(raw_decision["action_summary"])
        for r in raw_reasons:
            if r: texts_to_translate.append(r)

        # Clause texts
        for c in raw_clauses:
            if c.get("clause_type"): texts_to_translate.append(c["clause_type"])
            if c.get("simple_explanation"): texts_to_translate.append(c["simple_explanation"])
            if c.get("financial_impact"): texts_to_translate.append(c["financial_impact"])
            if c.get("actionable_tip"): texts_to_translate.append(c["actionable_tip"])
            if c.get("red_flag_reason"): texts_to_translate.append(c["red_flag_reason"])

        # Execute parallel translation
        unique_texts = list(set(texts_to_translate))
        with ThreadPoolExecutor(max_workers=8) as executor:
            translations = list(executor.map(
                lambda t: (t, dynamic_translate_text(t, target_language)),
                unique_texts
            ))
        trans_map = dict(translations)

        # Apply translations back to the output structure
        # Executive Summary
        translated_data["executive_summary"] = [
            trans_map.get(pt, pt) for pt in raw_exec
        ]

        # Decision
        new_decision = dict(raw_decision)
        if new_decision.get("decision"):
            new_decision["decision"] = trans_map.get(new_decision["decision"], new_decision["decision"])
        if new_decision.get("action_headline"):
            new_decision["action_headline"] = trans_map.get(new_decision["action_headline"], new_decision["action_headline"])
        if new_decision.get("action_summary"):
            new_decision["action_summary"] = trans_map.get(new_decision["action_summary"], new_decision["action_summary"])
        new_decision["reasons"] = [
            trans_map.get(r, r) for r in raw_reasons
        ]
        translated_data["decision"] = new_decision

        # Clauses
        new_clauses = []
        for c in raw_clauses:
            cl = dict(c)
            if cl.get("clause_type"):
                cl["clause_type"] = trans_map.get(cl["clause_type"], cl["clause_type"])
            if cl.get("simple_explanation"):
                cl["simple_explanation"] = trans_map.get(cl["simple_explanation"], cl["simple_explanation"])
            if cl.get("financial_impact"):
                cl["financial_impact"] = trans_map.get(cl["financial_impact"], cl["financial_impact"])
            if cl.get("actionable_tip"):
                cl["actionable_tip"] = trans_map.get(cl["actionable_tip"], cl["actionable_tip"])
            if cl.get("red_flag_reason"):
                cl["red_flag_reason"] = trans_map.get(cl["red_flag_reason"], cl["red_flag_reason"])
            new_clauses.append(cl)
        translated_data["clauses"] = new_clauses

        return translated_data

translation_service = TranslationService()
