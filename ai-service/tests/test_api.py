"""End-to-end checks through the mounted FastAPI app (real dataset, real router state)."""
import pytest
from fastapi.testclient import TestClient

from app.decision_forge.qa import SUGGESTED_QUESTIONS
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _fresh_dataset():
    client.post("/decision-forge/reset-demo")


def _run():
    res = client.post("/decision-forge/decide/run")
    assert res.status_code == 200
    return res.json()


def test_decision_run_returns_twelve_cited_companies():
    body = _run()
    assert body["records_analyzed"] == 12
    for rec in body["recommendations"]:
        prov = rec["evidence_pack"]["provenance"]
        assert prov and all(p["url"].startswith("https://") for p in prov)


def test_summary_totals_equal_sum_of_records():
    body = _run()
    recs = body["recommendations"]
    assert body["pipeline_total_value"] == sum(r["deal_value"] for r in recs)
    assert round(body["weighted_pipeline_value"], 2) == round(sum(r["deal_value"] * r["win_probability"] for r in recs), 2)
    assert body["stale_warning_count"] == sum(1 for r in recs if r["stale_data_warning"])


def test_ask_endpoint_answers_all_suggested_questions():
    for q in SUGGESTED_QUESTIONS:
        res = client.post("/decision-forge/ask", json={"question": q})
        assert res.status_code == 200
        assert res.json()["answer"].strip() and res.json()["matched_companies"]


def test_ask_rejects_empty_question():
    assert client.post("/decision-forge/ask", json={"question": "  "}).status_code == 400


def test_fetch_gating_and_honest_label():
    before = {r["opportunity_id"]: r for r in _run()["recommendations"]}["OPP-R01"]
    assert before["external_context_available"] and not before["external_context_fetched"]
    assert before["evidence_pack"]["external_signal"] is None
    sig = client.post("/decision-forge/opportunities/OPP-R01/fetch-context").json()["signal"]
    assert sig["freshness_status"] == "Cached validated snapshot (not a live web crawl)"
    assert sig["url"].startswith("https://") and sig["source"]
    after = {r["opportunity_id"]: r for r in _run()["recommendations"]}["OPP-R01"]
    assert after["external_context_fetched"]


def test_dataset_endpoint_exposes_meta():
    body = client.get("/decision-forge/dataset").json()
    assert body["count"] == 12
    assert "data_honesty_statement" in body["dataset_meta"]
