"""Phase 10: the workflow evaluation runs in CI and each metric has its own floor (no blended score)."""
import json
import logging
import os

import pytest

from evals import run_eval
from app.decision_forge.query_pipeline import run_query


@pytest.fixture(scope="module")
def report():
    logging.disable(logging.CRITICAL)      # the outage cases log expected retrieval failures
    try:
        return run_eval.run()
    finally:
        logging.disable(logging.NOTSET)


def test_eval_set_meets_the_brief():
    spec = json.load(open(run_eval.CASES_PATH, encoding="utf-8"))
    cases = spec["cases"]
    assert len(cases) >= 20
    adversarial = {c["adversarial"] for c in cases if c.get("adversarial")}
    assert {"missing data", "contradictory records", "irrelevant notes", "prompt injection in note",
            "empty result", "malformed query", "unauthorized opportunity"} <= adversarial


@pytest.mark.parametrize("metric,floor", [
    ("task_success_rate", 1.0), ("tool_selection", 1.0), ("tool_arguments", 1.0),
    ("evidence_grounding", 1.0), ("citation_correctness", 1.0), ("decision_determinism", 1.0),
    ("data_accuracy", 1.0), ("failure_recovery", 1.0),
])
def test_metric_floor(report, metric, floor):
    assert report["metrics"][metric] >= floor, {r["id"]: r for r in report["cases"] if not r["task_success"]}


def test_no_hallucinated_numbers(report):
    assert report["metrics"]["hallucination_rate"] == 0.0
    assert all(not c["numbers_ungrounded"] for c in report["cases"])


def test_every_case_is_individually_successful(report):
    failed = [(c["id"], {k: v for k, v in c["checks"].items() if not v}) for c in report["cases"] if not c["task_success"]]
    assert not failed, failed


def test_latency_is_reported_and_reasonable(report):
    m = report["metrics"]
    assert 0 < m["latency_ms_p50"] < 2000 and m["latency_ms_p95"] < 8000    # brief targets: <2s structured, <8s full decision


def test_human_approval_rate_is_not_faked_offline(report):
    assert report["metrics"]["human_approval_rate"] is None


def test_the_grounding_check_actually_catches_a_fabricated_number():
    ws = run_eval.build_workspace("synthetic", "eval-selftest")
    res = run_query(ws, "Which customers have gone cold?")
    assert run_eval.numbers_ungrounded(res, ws) == []
    res["answer"] += " Revenue will increase by 18% and add $987,654 next quarter."
    bad = run_eval.numbers_ungrounded(res, ws)
    assert 18.0 in bad and 987654.0 in bad


def test_the_fact_checks_are_independent_of_the_code_under_test(report):
    assert all(f["ok"] for f in report["fact_checks"])
    assert {f["name"] for f in report["fact_checks"]} >= {"synthetic_pipeline_total", "real_weighted_ev", "real_stale_count"}
