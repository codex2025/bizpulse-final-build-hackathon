"""Phase 1-2: deterministic synthetic dataset and the data-quality engine / ingestion path."""
import hashlib
import io
import json
import re
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.decision_forge import quality_engine as qe
from app.decision_forge.synthetic import PLANTED_CASES, generate
from app.main import app

client = TestClient(app)
REF = datetime(2026, 9, 29, tzinfo=timezone.utc)


def _digest(data) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


@pytest.fixture(scope="module")
def syn():
    return generate()


# ---- dataset -------------------------------------------------------------------------------
def test_synthetic_is_deterministic():
    assert _digest(generate()) == _digest(generate())


def test_synthetic_meets_volume_targets(syn):
    assert len(syn["opportunities"]) >= 500
    assert len(syn["activities"]) >= 1000
    assert sum(len(o["notes"]) for o in syn["opportunities"]) >= 500
    assert len(syn["customers"]) >= 100
    assert len(syn["reps"]) >= 10


def test_synthetic_contains_no_urls_emails_or_real_names(syn):
    blob = json.dumps(syn)
    assert "http" not in blob and "@" not in blob
    assert all(o["contact_email"] is None for o in syn["opportunities"])
    assert all("role placeholder" in o["contact_name"] for o in syn["opportunities"])


def test_synthetic_correlations_hold(syn):
    opps = [o for o in syn["opportunities"] if not o.get("planted_case") and o["win_probability"] is not None]
    by_stage = {}
    for o in opps:
        by_stage.setdefault(o["stage"], []).append(o["win_probability"])
    avg = {k: sum(v) / len(v) for k, v in by_stage.items()}
    assert avg["Qualified Lead"] < avg["Technical Validation"] < avg["Proposal Review"] < avg["Contract Negotiation"]
    ordered = sorted(opps, key=lambda o: o["deal_value"])
    q = len(ordered) // 4
    low = sum(o["activity_count"] for o in ordered[:q]) / q
    high = sum(o["activity_count"] for o in ordered[-q:]) / q
    assert high > low


def test_all_planted_cases_present(syn):
    present = {o["planted_case"] for o in syn["opportunities"] if o.get("planted_case")}
    assert present == set(PLANTED_CASES)


# ---- quality engine ------------------------------------------------------------------------
def _by_id(syn, oid):
    return next(o for o in syn["opportunities"] if o["opportunity_id"] == oid)


def test_missing_probability_detected(syn):
    issues = qe.detect_record_issues(_by_id(syn, "SYN-D01"), REF)
    assert "MISSING_PROBABILITY" in {i["issue_type"] for i in issues}


def test_conflicting_and_invalid_values_detected(syn):
    assert "CONFLICTING_PROBABILITY" in {i["issue_type"] for i in qe.detect_record_issues(_by_id(syn, "SYN-G01"), REF)}
    assert "INVALID_DEAL_VALUE" in {i["issue_type"] for i in qe.detect_record_issues(_by_id(syn, "SYN-G02"), REF)}


def test_stale_detected_using_snapshot_not_wall_clock(syn):
    c = _by_id(syn, "SYN-C01")
    assert "STALE_CONTACT" in {i["issue_type"] for i in qe.detect_record_issues(c, REF)}
    # far in the past relative to the record: not stale
    early = datetime(2026, 7, 30, tzinfo=timezone.utc)
    assert "STALE_CONTACT" not in {i["issue_type"] for i in qe.detect_record_issues(c, early)}


def test_duplicates_marked_and_clean_records_have_no_issues(syn):
    opps = [dict(o) for o in syn["opportunities"]]
    qe.mark_duplicates(opps)
    dups = {o["opportunity_id"] for o in opps if o.get("duplicate_of")}
    assert "SYN-F02" in dups and "SYN-F01" not in dups
    clean = qe.detect_record_issues(_by_id(syn, "SYN-A01"), REF)
    assert clean == []


def test_scorecard_counts_match_planted_cases(syn):
    report = qe.DataQualityEngine().evaluate(syn["opportunities"], reference_time=REF)
    assert report["duplicate_count"] >= 1
    assert report["conflicting_probability_count"] >= 1
    assert report["missing_probability_count"] >= 1
    assert report["stale_record_count"] >= 1
    assert report["total_records"] == len(syn["opportunities"])
    assert len(report["issues"]) >= report["duplicate_count"]


# ---- ingestion (API) -----------------------------------------------------------------------
CSV_OK = (
    "Company,Opportunity ID,Deal Value,Win Probability,Stage,Last Contact,Notes\n"
    "Acme Metals,U1,120000,60,Proposal Review,2026-09-20,Asked for a demo\n"
    "Acme Metals,U2,,45,Qualified Lead,2026-06-01,\n"
    "Bolt Co,U3,50000,,Qualified Lead,2026-09-25,Intro call\n"
)


def _upload(name, data, ws="ing-a"):
    return client.post("/decision-forge/ingest/file", files={"file": (name, data)}, headers={"X-Workspace-Id": ws})


def test_valid_import_reports_quality():
    res = _upload("leads.csv", CSV_OK)
    assert res.status_code == 200
    body = res.json()
    v = body["validation_report"]
    assert v["records_parsed"] == 3
    assert v["missing_probability"] == 1          # blank cell is MISSING, never silently 0
    assert v["missing_or_invalid_value"] == 1
    assert v["stale_records"] == 1
    assert "win_probability" not in body["normalized_records"][2]


def test_apply_mapping_activates_only_the_callers_workspace():
    body = _upload("leads.csv", CSV_OK).json()
    res = client.post("/decision-forge/ingest/apply-mapping", json={"records": body["normalized_records"]},
                      headers={"X-Workspace-Id": "ing-a"})
    assert res.status_code == 200 and res.json()["records_count"] == 3
    other = client.get("/decision-forge/dataset", headers={"X-Workspace-Id": "ing-b"}).json()
    assert other["dataset_key"] == "real" and other["count"] == 12


@pytest.mark.parametrize("name,data,status", [
    ("data.xlsx", b"PK\x03\x04", 400),
    ("data.csv", b"a,b\n\x00\x01,2", 400),
    ("data.csv", b"", 400),
    ("data.csv", b"\xff\xfe\x00bad", 400),
    ("big.csv", b"a,b\n" + b"1,2\n" * (2 * 1024 * 1024), 413),
], ids=["wrong-extension", "binary-content", "empty-file", "not-utf8", "oversized"])
def test_invalid_uploads_are_rejected_with_actionable_errors(name, data, status):
    res = _upload(name, data)
    assert res.status_code == status
    assert res.json()["detail"]


def test_too_many_columns_rejected():
    header = ",".join(f"c{i}" for i in range(80))
    assert _upload("wide.csv", header + "\n" + ",".join("1" for _ in range(80))).status_code == 400
