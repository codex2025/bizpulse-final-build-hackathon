"""Non-loan documents (MSA, SLA, NDA) must be read from their own wording: no invented lender, principal or EMI."""
from fastapi.testclient import TestClient

from app.main import app
from app.services.general_extractor import extract_general_clauses, is_lending_document

client = TestClient(app)

MSA = """MASTER SERVICES AGREEMENT (SAMPLE)
1. PAYMENT. The Client shall pay each invoice within thirty (30) days. Late payments accrue interest at 1.5% per month.
2. LIABILITY. The Provider's total liability shall not exceed Rs. 25,00,000. Uncapped indemnity applies to IP claims.
3. TERMINATION. Either party may terminate on ninety (90) days notice; an early termination fee of 10% applies.
4. GOVERNING LAW. This Agreement is governed by the laws of India.
"""


def test_msa_is_not_a_lending_document():
    assert not is_lending_document(MSA)
    assert is_lending_document("The Borrower shall repay the loan in EMI instalments to the Lender.")


def test_general_extraction_uses_only_the_documents_own_text():
    out = extract_general_clauses(MSA)
    assert out["document_type"] == "general"
    names = [c["clause_type"] for c in out["clauses"]]
    assert names == ["Payment", "Liability", "Termination", "Governing Law"]
    by = {c["clause_type"]: c for c in out["clauses"]}
    assert by["Liability"]["risk_level"] == "High" and by["Liability"]["is_red_flag"]
    assert "25,00,000" in by["Liability"]["original_text"]
    assert "1.5% per month" in by["Payment"]["financial_impact"]
    assert by["Governing Law"]["risk_level"] == "Low"
    # Nothing loan-shaped is created.
    blob = " ".join(f"{c['clause_type']} {c['original_text']} {c['simple_explanation']} {c['financial_impact']}" for c in out["clauses"]).lower()
    assert "lender" not in blob and "principal" not in blob and "loan" not in blob


def test_api_returns_no_simulation_for_a_non_loan():
    res = client.post(
        "/analyze/contract",
        files={"file": ("msa.txt", MSA.encode(), "text/plain")},
        data={"contract_id": "test-general-msa", "persona_type": "business"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["document_type"] == "general"
    assert body["simulation_results"] is None
    assert body["ledger_impact"] is None
    assert body["decision"]["decision_type"] == "REVIEW"
    assert len(body["clauses"]) == 4


def test_loans_still_get_the_loan_analysis():
    sample = (__import__("pathlib").Path(__file__).resolve().parents[2] / "sample_contract.txt").read_bytes()
    res = client.post("/analyze/contract", files={"file": ("sample_contract.txt", sample, "text/plain")}, data={"contract_id": "test-loan-still"})
    body = res.json()
    assert res.status_code == 200
    assert body.get("document_type", "loan") == "loan"
    assert body["simulation_results"]["loan_amount"] > 0
