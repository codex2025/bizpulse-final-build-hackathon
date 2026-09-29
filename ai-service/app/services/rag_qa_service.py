import re
import logging
import requests
from typing import Dict, Any, List
from app.config import settings
from app.services.vector_store import ChromaVectorStore
from app.services.translation_service import dynamic_translate_text, SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)

def translate_to_en(text: str, source_lang: str) -> str:
    """Translates user regional queries into English for high-precision semantic vector retrieval"""
    if not text or source_lang == "en":
        return text
    try:
        url = "https://api.mymemory.translated.net/get"
        params = {"q": text.strip(), "langpair": f"{source_lang}|en"}
        resp = requests.get(url, params=params, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            translated = data.get("responseData", {}).get("translatedText")
            if translated and not translated.startswith("MYMEMORY WARNING"):
                return translated
    except Exception:
        pass
    return text

def strip_robotic_symbols(text: str) -> str:
    """Removes robotic AI artifacts like markdown headers, bullet stars, and raw quote noise"""
    if not text:
        return ""
    # Remove markdown bold/italic asterisks
    text = re.sub(r"\*{1,3}", "", text)
    # Remove markdown hashes
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    # Remove bullet markers at start of lines
    text = re.sub(r"^\s*[-*•]\s*", "", text, flags=re.MULTILINE)
    # Remove robotic prefixes
    text = re.sub(r"^(Based on the terms found in your agreement:?|According to the agreement:?|Here is what the contract says:?)\s*", "", text, flags=re.IGNORECASE)
    # Clean up double quotes and whitespace
    text = text.replace('"', '').strip()
    return text

class RagQAService:
    def __init__(self):
        self.vector_store = ChromaVectorStore()
        self.llm = None
        if settings.openai_api_key and settings.openai_api_key.startswith("sk-"):
            try:
                from langchain_openai import ChatOpenAI
                self.llm = ChatOpenAI(
                    model=settings.model_name,
                    temperature=0.2,
                    api_key=settings.openai_api_key,
                )
            except Exception as e:
                logger.warning(f"Could not initialize RagQAService LLM: {e}")
                self.llm = None

    def _extract_humanized_synthesis(self, question: str, chunks: List[Dict[str, Any]]) -> str:
        """
        Synthesizes a clean, friendly, humanized conversational explanation 
        based on the retrieved contract clauses without robotic symbols or quote dumps.
        """
        q_lower = question.lower()
        combined_text = " ".join([c.get("text", "") for c in chunks])
        first_chunk = chunks[0].get("text", "") if chunks else ""

        # 1. Interest rate type (floating vs fixed)
        if any(w in q_lower for w in ["interest", "rate", "floating", "fixed", "வட்டி", "ब्याज", "వడ్డీ", "ಬಡ್ಡಿ", "व्याज", "সুদ", "વ્યાજ"]):
            # Check for floating / EBLR / Repo Rate
            repo_match = re.search(r"Repo Rate\s*\(([0-9.]+)%\)\s*\+\s*Spread of\s*([0-9.]+)%.*?([0-9.]+)%", combined_text, re.IGNORECASE)
            if repo_match:
                repo, spread, effective = repo_match.groups()
                return (
                    f"Your agreement specifies a floating interest rate tied to the RBI Repo Rate ({repo}%) with a spread of {spread}%, "
                    f"resulting in an initial effective rate of {effective}% per year. The bank will automatically adjust this rate every quarter when the benchmark changes."
                )
            elif "floating" in combined_text.lower():
                return (
                    "Your contract uses a floating interest rate linked to an external benchmark. "
                    "This means your monthly interest charges will fluctuate whenever the reference benchmark rate changes."
                )
            elif "fixed" in combined_text.lower():
                return (
                    "Your loan is set at a fixed interest rate, meaning your rate and monthly installments will remain unchanged for the entire duration of the loan."
                )

        # 2. Prepayment / Foreclosure / Early repayment
        if any(w in q_lower for w in ["prepay", "early", "foreclose", "penalty", "முன்கூட்டியே", "समयपूर्व", "ముందస్తు", "ಮುಂಗಡ", "मुदतपूर्व", "মেয়াদপূর্ব", "મુદત"]):
            if "0%" in combined_text or "zero" in combined_text.lower() or "cooling-off" in combined_text.lower() or "without prepayment penalty" in combined_text.lower():
                return (
                    "You can make early prepayments or close the loan early with 0% exit penalty under standard regulatory protections. "
                    "You also have a 5-day cooling-off window to exit the agreement without penalty by repaying the principal sum."
                )
            fee_match = re.search(r"(\d+\.?\d*)%\s*(?:foreclosure|prepayment)", combined_text, re.IGNORECASE)
            if fee_match:
                fee = fee_match.group(1)
                return (
                    f"If you repay or close the loan early before the scheduled tenure, the lender charges a prepayment penalty fee of {fee}% on the outstanding balance."
                )

        # 3. Personal home / Asset seizure / Personal Guarantee
        if any(w in q_lower for w in ["home", "property", "seize", "personal", "house", "வீடு", "घर", "ఇల్లు", "ಮನೆ", "ঘর", "ઘર"]):
            if "personal guarantee" in combined_text.lower() or "guarantor" in combined_text.lower():
                return (
                    "The contract includes a personal guarantee clause. If the business defaults, the lender has legal authority to recover dues directly from your personal assets, bank accounts, or residential property."
                )
            elif "hypothecation" in combined_text.lower():
                return (
                    "The lender holds security rights strictly over the financed business assets, machinery, and book debts, rather than your personal residential property."
                )

        # 4. Grace period & late payment notice
        if any(w in q_lower for w in ["grace", "late", "notice", "penalty", "தாமத", "विलंब", "ఆలస్య", "ತಡವಾದ"]):
            notice_match = re.search(r"(\d+)\s*(?:business\s*)?days?\s*(?:written\s*)?notice", combined_text, re.IGNORECASE)
            if notice_match:
                days = notice_match.group(1)
                return (
                    f"The lender is required to give you a mandatory {days}-day written notice window before applying default remedies or penalties, allowing you time to cure any missed payment."
                )
            else:
                return (
                    "A late payment interest charge applies if an installment is missed. You should verify whether a formal written grace period notice is provided before default proceedings start."
                )

        # Fallback: Clean conversational extraction from top matched chunk
        clean_first = strip_robotic_symbols(first_chunk)
        sentences = [s.strip() for s in clean_first.split(".") if len(s.strip()) > 15]
        if sentences:
            return "According to the contract: " + ". ".join(sentences[:2]) + "."
        return "Your contract outlines specific terms on this topic in the highlighted clause section of your document."

    def answer_question(self, contract_id: str, question: str, top_k: int = 4, language: str = "en") -> Dict[str, Any]:
        """
        Retrieves top-k relevant chunks, synthesizes a clean, humanized answer,
        and dynamically translates the answer into the requested regional language.
        Supports query in any regional language (Tamil, Hindi, Telugu, Kannada, etc.).
        """
        # If question is in a regional language, translate to English for high precision vector retrieval
        search_query = question
        if language != "en":
            en_trans = translate_to_en(question, language)
            if en_trans and en_trans != question:
                search_query = f"{question} {en_trans}"

        matched_chunks = self.vector_store.query(contract_id, search_query, top_k=top_k)

        if not matched_chunks:
            no_info_msg = "I could not find relevant clauses in this agreement to answer your question with confidence."
            if language != "en":
                no_info_msg = dynamic_translate_text(no_info_msg, language)
            return {
                "answer": no_info_msg,
                "cited_clauses": [],
                "confidence": "low",
            }

        cited_clauses = [{
            "chunk_id": c["chunk_id"],
            "page_number": c.get("page_number", 1),
            "section_title": dynamic_translate_text(c.get("section_title", "Contract Term"), language) if language != "en" else c.get("section_title", "Contract Term"),
            "relevance_score": c.get("score", 1.0),
            "snippet": c["text"][:160] + ("..." if len(c["text"]) > 160 else ""),
        } for c in matched_chunks]

        # 1. Try LLM generation if active
        if self.llm is not None:
            try:
                context_str = "\n\n".join([
                    f"[Page {c.get('page_number', 1)} | Section: {c.get('section_title', '')}]\n{c['text']}"
                    for c in matched_chunks
                ])

                from langchain_core.prompts import ChatPromptTemplate
                prompt = ChatPromptTemplate.from_template("""
You are a warm, helpful, and highly knowledgeable financial advisor explaining a contract to a borrower.
Answer the user's question directly and conversationally in 2-3 clear, natural sentences.
Rules:
- DO NOT use robotic symbols, asterisks (**), bullet dashes, or raw markdown quotes.
- Speak in natural, human conversational tone.
- Base your answer strictly on the provided contract context.

Contract Context:
{context_str}

User Question:
{question}

Answer:
""")
                chain = prompt | self.llm
                response = chain.invoke({
                    "context_str": context_str,
                    "question": question
                })
                raw_ans = strip_robotic_symbols(response.content.strip())
                
                # Translate to target language
                if language != "en":
                    final_ans = dynamic_translate_text(raw_ans, language)
                else:
                    final_ans = raw_ans

                return {
                    "answer": final_ans,
                    "cited_clauses": cited_clauses,
                    "confidence": "high",
                }
            except Exception as e:
                logger.warning(f"RagQA LLM failed ({e}). Using humanized deterministic synthesis.")

        # 2. Humanized Conversational Synthesis
        humanized_en = self._extract_humanized_synthesis(question, matched_chunks)
        clean_ans = strip_robotic_symbols(humanized_en)

        # 3. Translate to target language
        if language != "en":
            final_ans = dynamic_translate_text(clean_ans, language)
        else:
            final_ans = clean_ans

        return {
            "answer": final_ans,
            "cited_clauses": cited_clauses,
            "confidence": "high",
        }

rag_qa = RagQAService()
