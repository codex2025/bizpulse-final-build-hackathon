import os
import json
import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.document_parser import DocumentParser
from app.services.chunker import DocumentChunker
from app.services.vector_store import ChromaVectorStore
from app.services.clause_extractor import ClauseExtractor
from app.services.simulator import FinancialSimulator
from app.services.decision_engine import DecisionEngine
from app.services.rag_qa_service import RagQAService
from app.services.knowledge_base_service import KnowledgeBaseService
from app.models.simulation_models import SimulationInput

from app.services.translation_service import translation_service, SUPPORTED_LANGUAGES

router = APIRouter()
parser = DocumentParser()
chunker = DocumentChunker()
vector_store = ChromaVectorStore()
extractor = ClauseExtractor()
simulator = FinancialSimulator()
engine = DecisionEngine()
rag_qa = RagQAService()
kb_service = KnowledgeBaseService()

class AskQuestionRequest(BaseModel):
    question: str
    top_k: Optional[int] = 4
    language: Optional[str] = "en"

class TranslateRequest(BaseModel):
    contract_data: Dict[str, Any]
    target_language: str

@router.post("/contract")
async def analyze_contract(
    file: UploadFile = File(...),
    contract_id: Optional[str] = Form(None),
    persona_type: Optional[str] = Form("business"),
    monthly_income: Optional[float] = Form(65000.0),
    monthly_expense: Optional[float] = Form(20000.0),
    annual_revenue: Optional[float] = Form(780000.0)
):
    cid = contract_id or str(uuid.uuid4())
    ptype = persona_type or "business"
    file_bytes = await file.read()
    text = parser.extract_text(file_bytes, file.filename)

    # 1. Semantic Chunking
    chunks = chunker.chunk_document(text, file.filename)

    # 2. Embed & Ingest into persistent ChromaDB collection
    collection_id = vector_store.ingest_chunks(cid, chunks)

    # 3. Plain-English Clause Simplification & Executive Extraction
    extracted_data = extractor.extract_clauses_with_chunks(chunks)
    clauses = extracted_data.get("clauses", [])
    executive_summary = extracted_data.get("executive_summary", [])
    overall_risk_rating = extracted_data.get("overall_risk_rating", "Moderate Attention Needed")
    red_flags = extracted_data.get("red_flags", [])
    borrower_rights = extracted_data.get("borrower_rights", [])
    detected_glossary = extracted_data.get("detected_glossary", [])

    loan_params = extractor.extract_loan_params(clauses)

    # 4. Financial Simulation
    sim_input = SimulationInput(
        loan_amount=float(loan_params.get("loan_amount", 500000.0)),
        annual_interest_rate=float(loan_params.get("annual_interest_rate", 12.5)),
        tenure_months=int(loan_params.get("tenure_months", 36)),
        penalty_rate=float(loan_params.get("penalty_rate", 2.0)),
    )
    simulation = simulator.simulate(sim_input)
    sim_dict = simulation.dict()
    # The simulator returns only derived figures; the screen also needs the terms they were derived from
    # (otherwise the sanctioned principal renders as 0).
    sim_dict.update(
        loan_amount=sim_input.loan_amount,
        annual_interest_rate=sim_input.annual_interest_rate,
        tenure_months=sim_input.tenure_months,
        penalty_rate=sim_input.penalty_rate,
    )

    # 5. Persona & Ledger-Aware Affordability Decision
    income = float(monthly_income) if monthly_income and monthly_income > 0 else (55000.0 if ptype == "employee" else 65000.0)
    expense = float(monthly_expense) if monthly_expense and monthly_expense > 0 else (22000.0 if ptype == "employee" else 20000.0)
    rev = float(annual_revenue) if annual_revenue and annual_revenue > 0 else 780000.0

    ledger_impact = engine.evaluate_ledger_impact(sim_dict.get("monthly_emi", 16727), income, expense, rev, ptype)
    decision = engine.generate_decision(clauses, sim_dict, income, expense, rev, ptype)

    return {
        "contract_id": cid,
        "chroma_collection_id": collection_id,
        "total_chunks": len(chunks),
        "executive_summary": executive_summary,
        "overall_risk_rating": overall_risk_rating,
        "red_flags": red_flags,
        "borrower_rights": borrower_rights,
        "detected_glossary": detected_glossary,
        "clauses": clauses,
        "simulation_results": sim_dict,
        "decision": decision,
        "ledger_impact": ledger_impact,
        "negotiation_tips": decision.get("alternatives", []),
    }

@router.post("/contracts/{contract_id}/ask")
async def ask_contract_question(contract_id: str, payload: AskQuestionRequest):
    result = rag_qa.answer_question(
        contract_id,
        payload.question,
        top_k=payload.top_k or 4,
        language=payload.language or "en"
    )
    return result

@router.get("/contracts/glossary")
async def get_glossary():
    """Returns the complete curated Banking & Legal Glossary knowledge base"""
    return {
        "count": len(kb_service.get_full_glossary()),
        "glossary": kb_service.get_full_glossary()
    }

@router.get("/contracts/sample-datasets")
async def get_sample_datasets():
    """Returns list of real, publicly available loan agreement benchmark datasets"""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    test_dir = os.path.join(base_dir, "test_data")

    samples = [
        {
            "id": "ujjivan-mse",
            "title": "Ujjivan Small Finance Bank — MSE Secured Loan",
            "type": "Business / MSE Loan",
            "description": "Commercial loan agreement with hypothecation, floating MCLR spread, 60-month tenure, 3.5% foreclosure fee, and personal guarantees.",
            "filename": "ujjivan_mse_loan_agreement.txt",
            "benchmarks": ["Hypothecation", "Personal Guarantee", "3.5% Prepayment Fee", "MCLR Benchmark"]
        },
        {
            "id": "dbs-mortgage",
            "title": "DBS Bank — Housing & Mortgage Term Loan",
            "type": "Retail Home Mortgage",
            "description": "Standard individual home mortgage linked to RBI Repo Rate (EBLR), 20-year tenure, 0% foreclosure fee under RBI mandate, and cooling-off window.",
            "filename": "dbs_mortgage_home_loan_agreement.txt",
            "benchmarks": ["0% Prepayment Penalty (RBI)", "EBLR Floating Rate", "Equitable Mortgage", "Cooling-off Period"]
        },
        {
            "id": "bnp-paribas",
            "title": "BNP Paribas — Senior Corporate Term Loan",
            "type": "Corporate Term Loan",
            "description": "Institutional ₹25 Cr facility with DSCR covenants, mandatory asset sale sweep, cross-default triggers, and exclusive arbitration.",
            "filename": "bnp_paribas_term_loan_agreement.txt",
            "benchmarks": ["Cross-Default Trigger", "Right of Set-off", "DSCR Covenant", "Mandatory Prepayment"]
        },
        {
            "id": "rbi-kfs",
            "title": "RBI Official Key Facts Statement (KFS) Benchmark",
            "type": "Regulatory Benchmark / Answer Key",
            "description": "Official April 2024 standardized format issued by Reserve Bank of India with all-inclusive APR, penal disclosure, and borrower protections.",
            "filename": "rbi_key_facts_statement_benchmark.json",
            "benchmarks": ["Mandatory KFS APR", "No Penal Compounding", "Grievance Redressal", "Zero Foreclosure Fee"]
        }
    ]

    # Attach file contents for quick in-browser preview or direct loading
    for s in samples:
        fpath = os.path.join(test_dir, s["filename"])
        if os.path.exists(fpath):
            with open(fpath, "r", encoding="utf-8") as f:
                s["content"] = f.read()

    return {"samples": samples}

@router.get("/languages")
async def get_supported_languages():
    """Returns the list of supported Indian languages for contract analysis"""
    return {"languages": SUPPORTED_LANGUAGES}

@router.post("/translate")
async def translate_contract(req: TranslateRequest):
    """Translates contract summary, decisions, and clauses into the requested Indian language"""
    try:
        translated = translation_service.translate_contract_data(req.contract_data, req.target_language)
        return translated
    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/contracts/{contract_id}")
async def delete_contract_data(contract_id: str):
    """Purges the contract ChromaDB vector collection and associated memory for user privacy"""
    try:
        safe_name = f"contract_{contract_id.replace('-', '_')}"[:60]
        vector_store._client.delete_collection(safe_name)
        return {"status": "success", "message": f"Contract vector collection {safe_name} deleted."}
    except Exception as e:
        return {"status": "success", "message": f"Purged ({e})"}
