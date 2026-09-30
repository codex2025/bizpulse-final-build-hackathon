"""Workspace state is recoverable: a cold start / restart / different serverless instance must not
silently replace a user's chosen dataset, upload or fetched context with the default dataset.

The gateway persists the inputs and sends the fingerprint it expects; the ai-service refuses (409) to
answer from a state it does not hold and rebuilds it deterministically through /workspace/restore.
"""
import pytest
from fastapi.testclient import TestClient

from app.decision_forge.workspace import WorkspaceState, registry
from app.main import app

client = TestClient(app)
BASE = "/decision-forge"

CSV = (
    "Company,Opportunity ID,Deal Value,Win Probability,Stage,Last Contact,Notes\n"
    "Acme Metals,U1,120000,60,Proposal Review,2026-09-20,Asked for a demo\n"
    "Acme Metals,U2,,45,Qualified Lead,2026-06-01,\n"
    "Bolt Co,U3,50000,,Qualified Lead,2026-09-25,Intro call\n"
)


def H(workspace, state=None):
    headers = {"X-Workspace-Id": workspace}
    if state:
        headers["X-Workspace-State"] = state
    return headers


def reset(workspace, key):
    res = client.post(f"{BASE}/reset-demo", json={"dataset": key}, headers=H(workspace))
    assert res.status_code == 200
    return res.json()["state_fingerprint"]


def run(workspace, state=None):
    res = client.post(f"{BASE}/decide/run", headers=H(workspace, state))
    assert res.status_code == 200, res.text
    return res.json()


def scores(run_response):
    return [(r["opportunity_id"], r["priority_score"], r["confidence"]) for r in run_response["recommendations"]]


def cold_start(workspace):
    assert registry.evict(workspace)


# ---- the guarantee ---------------------------------------------------------------------------
def test_a_cold_instance_refuses_to_serve_state_it_does_not_hold():
    wid = "rec-cold"
    state = reset(wid, "synthetic")
    cold_start(wid)
    res = client.get(f"{BASE}/dataset", headers=H(wid, state))
    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "WORKSPACE_RESTORE_REQUIRED"
    # It must not have quietly loaded the default dataset in order to answer.
    assert registry.get(wid, autoload=False).opportunities == []


@pytest.mark.parametrize("endpoint", [
    ("get", "/dataset"), ("get", "/quality"), ("post", "/decide/run"), ("post", "/twin/simulate"),
    ("post", "/decisions/query"), ("post", "/ask"), ("get", "/analytics/get_pipeline_summary"),
    ("post", "/opportunities/whatever/fetch-context"),
], ids=lambda e: e[1])
def test_every_state_dependent_endpoint_enforces_the_expected_state(endpoint):
    method, path = endpoint
    wid = "rec-enforce"
    registry.evict(wid)
    body = {"question": "Which opportunities should we prioritize today?"} if path in ("/decisions/query", "/ask") else {}
    res = getattr(client, method)(f"{BASE}{path}", headers=H(wid, "ws-0000000000000000"),
                                  **({"json": body} if method == "post" else {}))
    assert res.status_code == 409, (path, res.status_code, res.text)
    assert res.json()["detail"]["code"] == "WORKSPACE_RESTORE_REQUIRED"


def test_a_loaded_workspace_in_a_different_state_is_also_refused():
    wid = "rec-other-state"
    reset(wid, "real")
    other = reset("rec-other-state-b", "synthetic")
    assert client.get(f"{BASE}/dataset", headers=H(wid, other)).status_code == 409


def test_matching_state_is_served_without_any_restore():
    wid = "rec-match"
    state = reset(wid, "synthetic")
    res = client.get(f"{BASE}/dataset", headers=H(wid, state))
    assert res.status_code == 200 and res.json()["dataset_key"] == "synthetic" and res.json()["count"] == 520


def test_without_the_header_behaviour_is_unchanged():
    wid = "rec-noheader"
    registry.evict(wid)
    res = client.get(f"{BASE}/dataset", headers=H(wid))
    assert res.status_code == 200 and res.json()["dataset_key"] == "real"


# ---- exact rebuild -----------------------------------------------------------------------------
@pytest.mark.parametrize("key", ["real", "synthetic", "legacy"])
def test_restore_rebuilds_a_preset_dataset_exactly(key):
    wid = f"rec-preset-{key}"
    state = reset(wid, key)
    before = run(wid, state)
    cold_start(wid)

    res = client.post(f"{BASE}/workspace/restore", json={"dataset_key": key, "expected_state": state}, headers=H(wid))
    assert res.status_code == 200
    assert res.json()["status"] == "restored" and res.json()["matches_expected"] is True
    assert res.json()["state_fingerprint"] == state

    after = run(wid, state)                       # the header now matches, so it is served
    assert after["snapshot_id"] == before["snapshot_id"]
    assert scores(after) == scores(before)


def test_restore_rebuilds_an_uploaded_dataset_exactly():
    wid = "rec-upload"
    upload = client.post(f"{BASE}/ingest/file", files={"file": ("leads.csv", CSV)}, headers=H(wid)).json()
    records = upload["normalized_records"]
    applied = client.post(f"{BASE}/ingest/apply-mapping", json={"records": records}, headers=H(wid)).json()
    assert applied["dataset_key"] == "custom" and applied["records_count"] == 3
    state = applied["state_fingerprint"]
    before = run(wid, state)
    cold_start(wid)

    res = client.post(f"{BASE}/workspace/restore",
                      json={"dataset_key": "custom", "records": records, "expected_state": state}, headers=H(wid))
    assert res.status_code == 200 and res.json()["matches_expected"] is True
    after = run(wid, state)
    assert after["dataset_key"] == "custom" and after["records_analyzed"] == 3
    assert after["snapshot_id"] == before["snapshot_id"]
    assert scores(after) == scores(before)


def test_restore_keeps_external_context_that_was_fetched():
    wid = "rec-fetched"
    state0 = reset(wid, "real")
    base = run(wid, state0)
    opp_id = base["recommendations"][0]["opportunity_id"]
    score0 = {r["opportunity_id"]: r["priority_score"] for r in base["recommendations"]}

    fetched = client.post(f"{BASE}/opportunities/{opp_id}/fetch-context", headers=H(wid, state0)).json()
    assert fetched["status"] == "fetched" and fetched["opportunity_id"] == opp_id
    state1 = fetched["state_fingerprint"]
    assert state1 != state0                                            # fetching changes the state
    after_fetch = run(wid, state1)
    score1 = {r["opportunity_id"]: r["priority_score"] for r in after_fetch["recommendations"]}
    assert score1[opp_id] != score0[opp_id]                            # ... and that opportunity's score

    cold_start(wid)
    res = client.post(f"{BASE}/workspace/restore", headers=H(wid),
                      json={"dataset_key": "real", "fetched_opportunity_ids": [opp_id], "expected_state": state1})
    assert res.json()["matches_expected"] is True and res.json()["fetched_count"] == 1
    assert scores(run(wid, state1)) == scores(after_fetch)

    # Without the fetched list the rebuilt state is honestly reported as different (score reverts).
    cold_start(wid)
    lossy = client.post(f"{BASE}/workspace/restore", json={"dataset_key": "real", "expected_state": state1}, headers=H(wid)).json()
    assert lossy["matches_expected"] is False and lossy["state_fingerprint"] == state0


def test_fetched_ids_that_are_unknown_or_have_no_signal_are_ignored():
    wid = "rec-unknown-ids"
    registry.evict(wid)
    res = client.post(f"{BASE}/workspace/restore", headers=H(wid),
                      json={"dataset_key": "real", "fetched_opportunity_ids": ["NOPE-1", "../../etc/passwd"]})
    assert res.status_code == 200 and res.json()["fetched_count"] == 0


def test_second_restore_with_the_current_state_does_not_rebuild():
    wid = "rec-idempotent"
    state = reset(wid, "synthetic")
    ws = registry.get(wid, autoload=False)
    marker = ws.opportunities                                           # same list object => no rebuild happened
    res = client.post(f"{BASE}/workspace/restore", json={"dataset_key": "synthetic", "expected_state": state}, headers=H(wid))
    assert res.json()["status"] == "already_current"
    assert registry.get(wid, autoload=False).opportunities is marker


def test_restoring_one_workspace_does_not_touch_another():
    a, b = "rec-iso-a", "rec-iso-b"
    reset(a, "synthetic")
    state_b = reset(b, "real")
    cold_start(a)
    client.post(f"{BASE}/workspace/restore", json={"dataset_key": "synthetic"}, headers=H(a))
    assert client.get(f"{BASE}/dataset", headers=H(b, state_b)).status_code == 200
    assert registry.get(b, autoload=False).dataset_key == "real"


def test_state_establishing_endpoints_ignore_a_stale_header():
    wid = "rec-stale-header"
    stale = "ws-deadbeefdeadbeef"
    assert client.post(f"{BASE}/reset-demo", json={"dataset": "synthetic"}, headers=H(wid, stale)).status_code == 200
    upload = client.post(f"{BASE}/ingest/file", files={"file": ("leads.csv", CSV)}, headers=H(wid, stale))
    assert upload.status_code == 200
    applied = client.post(f"{BASE}/ingest/apply-mapping", json={"records": upload.json()["normalized_records"]}, headers=H(wid, stale))
    assert applied.status_code == 200
    assert client.post(f"{BASE}/workspace/restore", json={"dataset_key": "real"}, headers=H(wid, stale)).status_code == 200


# ---- fingerprint -----------------------------------------------------------------------------
def test_fingerprint_is_stable_across_instances_and_sensitive_to_state():
    one, two = WorkspaceState("fp-1"), WorkspaceState("fp-2")
    assert one.state_fingerprint() == two.state_fingerprint() == "ws-empty"
    one.load("real")
    two.load("real")
    assert one.state_fingerprint() == two.state_fingerprint() != "ws-empty"     # same data => same fingerprint
    two.load("synthetic")
    assert one.state_fingerprint() != two.state_fingerprint()                    # different dataset
    opp = next(o for o in one.opportunities if one.engine.ext_gateway.has_signal(o["company_name"], embedded=o.get("external_signal")))
    before = one.state_fingerprint()
    one.engine.ext_gateway.mark_fetched(opp["company_name"])
    assert one.state_fingerprint() != before                                     # fetched context is part of the state
    one.load("real")                                                             # a reload clears fetch state
    assert one.state_fingerprint() == before


# ---- validation and security -------------------------------------------------------------------
@pytest.mark.parametrize("payload,status", [
    ({"dataset_key": "nope"}, 400),
    ({}, 400),
    ({"dataset_key": "custom"}, 400),
    ({"dataset_key": "custom", "records": []}, 400),
    ({"dataset_key": "custom", "records": ["not-an-object"]}, 400),
    ({"dataset_key": "custom", "records": [{"company_name": "X"}] * 5001}, 413),
    ({"dataset_key": "real", "fetched_opportunity_ids": "abc"}, 400),
    ({"dataset_key": "real", "fetched_opportunity_ids": [1, 2]}, 400),
    ({"dataset_key": "real", "fetched_opportunity_ids": ["x"] * 1001}, 400),
    ({"dataset_key": "real", "fetched_opportunity_ids": ["x" * 201]}, 400),
], ids=["unknown-dataset", "missing-dataset", "custom-no-records", "custom-empty", "custom-not-objects",
        "custom-too-many", "ids-not-list", "ids-not-strings", "ids-too-many", "id-too-long"])
def test_restore_validates_its_input(payload, status):
    res = client.post(f"{BASE}/workspace/restore", json=payload, headers=H("rec-validate"))
    assert res.status_code == status, res.text
    assert res.json()["detail"]


def test_restore_rejects_a_bad_workspace_id():
    res = client.post(f"{BASE}/workspace/restore", json={"dataset_key": "real"}, headers=H("../evil"))
    assert res.status_code == 400


def test_restore_requires_the_service_token_when_one_is_configured(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "s3cret-token")
    payload = {"dataset_key": "real"}
    assert client.post(f"{BASE}/workspace/restore", json=payload, headers=H("rec-token")).status_code == 401
    bad = {**H("rec-token"), "X-Internal-Token": "wrong"}
    assert client.post(f"{BASE}/workspace/restore", json=payload, headers=bad).status_code == 401
    good = {**H("rec-token"), "X-Internal-Token": "s3cret-token"}
    assert client.post(f"{BASE}/workspace/restore", json=payload, headers=good).status_code == 200
