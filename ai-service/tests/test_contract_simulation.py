"""The contract screen needs the loan terms back alongside the simulated figures (it showed a ₹0 principal)."""
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
SAMPLE = Path(__file__).resolve().parents[1] / "test_data" / "sample_contract.txt"


def test_simulation_results_echo_the_terms_they_were_derived_from():
    res = client.post(
        "/analyze/contract",
        files={"file": ("sample_contract.txt", SAMPLE.read_bytes(), "text/plain")},
        data={"contract_id": "test-sim-echo", "persona_type": "business"},
    )
    assert res.status_code == 200, res.text
    sim = res.json()["simulation_results"]
    # Derived figures are still there ...
    assert sim["monthly_emi"] > 0 and sim["total_repayment"] >= sim["monthly_emi"]
    # ... and so are the terms, so the UI never renders a zero principal for a loan that has an EMI.
    assert sim["loan_amount"] > 0
    assert sim["annual_interest_rate"] > 0
    assert sim["tenure_months"] > 0
    # Internal consistency: repayment = EMI x tenure (rounded to paise).
    assert abs(sim["monthly_emi"] * sim["tenure_months"] - sim["total_repayment"]) < sim["tenure_months"] * 0.01 + 1
