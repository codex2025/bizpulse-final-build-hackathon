"""
Workflow-level evaluation of the DecisionForge query pipeline (no server, no network, no LLM key).

Scores the whole trajectory -- plan, tool choice, tool arguments, retrieved evidence, answer -- and
reports SEPARATE metrics (there is deliberately no single blended "AI score"):

  task_success_rate        intent + required records + required/forbidden answer text all correct
  tool_selection           the plan chose exactly the expected analytics tools
  tool_arguments           the plan carried the right opportunity id (or none)
  evidence_grounding       every cited note exists verbatim in that record's stored notes
  citation_correctness     every cited note belongs to a record the answer is actually about
  hallucination_rate       share of numbers in answers that cannot be traced to structured results
  decision_determinism     the same question twice gives identical answers/records
  data_accuracy            headline figures equal an independent recomputation from the raw data
  failure_recovery         answers still returned (with the fallback disclosed) when RAG/LLM fail
  latency_ms               p50 / p95 per query

Human approval rate is measured from the gateway's approvals table at runtime (not offline).

Usage:  python evals/run_eval.py [--write]      (from ai-service/)
"""
import json
import os
import re
import statistics
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.decision_forge.query_pipeline import run_query  # noqa: E402
from app.decision_forge.scenario_parser import SUPPORTED_LEVERS_HELP  # noqa: E402
from app.decision_forge.workspace import WorkspaceState  # noqa: E402

CASES_PATH = os.path.join(ROOT, "evals", "cases.json")
FRESH_RECORDS = [
    {"opportunity_id": "F1", "company_name": "Fresh One", "deal_value": 100000, "win_probability": 0.6,
     "engagement_score": 70, "last_contact_date": "2026-09-28T00:00:00Z", "stage": "Proposal Review", "sales_notes": ["Kickoff call held."]},
    {"opportunity_id": "F2", "company_name": "Fresh Two", "deal_value": 50000, "win_probability": 0.4,
     "engagement_score": 60, "last_contact_date": "2026-09-27T00:00:00Z", "stage": "Qualified Lead", "sales_notes": ["Intro email sent."]},
]


def build_workspace(kind: str, wid: str) -> WorkspaceState:
    ws = WorkspaceState(wid)
    if kind == "fresh":
        ws.apply_records(FRESH_RECORDS)
    else:
        ws.load(kind)
    return ws


# ---- independent recomputation (never calls the analytics module) --------------------------
def raw_metrics(ws: WorkspaceState) -> Dict[str, Any]:
    opps = ws.opportunities
    ref = ws.reference_time
    valid = [o for o in opps if isinstance(o.get("win_probability"), (int, float)) and 0 <= o["win_probability"] <= 1
             and isinstance(o.get("deal_value"), (int, float)) and o["deal_value"] >= 0]
    stale = set()
    for o in opps:
        last = datetime.strptime(o["last_contact_date"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        if (ref - last).days > 30:
            stale.add(o["opportunity_id"])
    return {
        "total": sum(max(0, o["deal_value"]) for o in opps if isinstance(o.get("deal_value"), (int, float))),
        "weighted": sum(o["deal_value"] * o["win_probability"] for o in valid),
        "stale": stale,
        "top_ev": max(valid, key=lambda o: (o["deal_value"] * o["win_probability"], -ord(o["opportunity_id"][-1])))["opportunity_id"],
    }


def independent_twin(opps: List[Dict[str, Any]], p: Dict[str, Any]) -> Dict[str, Any]:
    """The Decision Twin's documented arithmetic re-implemented from the raw records (does not import decision_twin):
    scope = valid deals >= minimum value with priority proxy >= cutoff; capacity = reps x contacts/day x 20 working days;
    reachable = capacity // 4 touchpoints per deal; coverage = highest expected value first; value applies the stated
    response-window and focus multipliers, capped at 0.95."""
    valid = [o for o in opps if isinstance(o.get("win_probability"), (int, float)) and 0 <= o["win_probability"] <= 1
             and isinstance(o.get("deal_value"), (int, float)) and o["deal_value"] >= 0]
    proxy = lambda o: 0.5 * min(100, o["deal_value"] / 500000 * 100) + 0.5 * min(100, max(0, o["win_probability"] * 100))
    scope = [o for o in valid if o["deal_value"] >= p["min_deal_value"] and proxy(o) >= p["priority_threshold"]]
    scope.sort(key=lambda o: (-o["deal_value"] * o["win_probability"], o["opportunity_id"]))
    covered = scope[: p["sales_reps_count"] * p["contacts_per_day"] * 20 // 4]
    days = p["followup_window_days"]
    speed = 1.18 if days <= 3 else 1.05 if days <= 7 else 0.85 if days > 14 else 1.0
    focus = 1.08 if p["min_deal_value"] >= 100000 else 1.0
    return {"in_scope": len(scope), "covered": len(covered),
            "value": round(sum(o["deal_value"] * min(0.95, o["win_probability"] * speed * focus) for o in covered), 2)}


NUM_RE = re.compile(r"\$?\d[\d,]*(?:\.\d+)?")


def _numbers(text: str) -> List[float]:
    out = []
    for m in NUM_RE.findall(text):
        try:
            out.append(float(m.replace("$", "").replace(",", "")))
        except ValueError:
            pass
    return out


def _allowed_numbers(res: Dict[str, Any]) -> set:
    """Every number that legitimately appears in the structured result behind an answer."""
    allowed: set = set()

    def walk(x: Any) -> None:
        if isinstance(x, bool):
            return
        if isinstance(x, (int, float)):
            # The number extractor reads magnitudes ("-51.1%" -> 51.1), so compare magnitudes.
            v = abs(float(x))
            allowed.update({round(v, 0), round(v, 1), v})
        elif isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)

    for key in ("matched", "analytics", "recommendations", "run_summary", "plan", "stats"):
        walk(res.get(key))
    # Numbers the user typed themselves and the answer echoes back ("2 reps", "$500,000") are not claims about the data.
    for n in _numbers(res.get("question", "")):
        allowed.update({round(n, 0), round(n, 1), n})
    # A count word in the answer ("2 opportunities ...") is the length of a list in the structured result.
    allowed.update({float(len(res.get("matched", []))), float(len(res.get("matched_ids", [])))})
    return allowed


def _claims_text(answer: str) -> str:
    """The part of an answer that can make numeric claims about the data. Record ids (SYN-0071, OPP-R03) contain
    digits that are labels, and the static 'what I can simulate' guidance contains illustrative example numbers;
    neither is a claim about the business data."""
    text = answer.replace(SUPPORTED_LEVERS_HELP, "")
    return re.sub(r"\b(?:SYN|OPP|REC|DR)-[A-Za-z0-9-]+\b", "", text)


def numbers_ungrounded(res: Dict[str, Any], ws: WorkspaceState) -> List[float]:
    allowed = _allowed_numbers(res)
    allowed.update(float(len(ws.opportunities)) for _ in [0])
    text = _claims_text(res["answer"])
    bad = []
    for n in _numbers(text):
        if not any(abs(n - a) <= max(1.0, abs(a) * 0.001) for a in allowed):
            bad.append(n)
    return bad


def note_texts(ws: WorkspaceState, opp_id: str) -> List[str]:
    for o in ws.opportunities:
        if o["opportunity_id"] == opp_id:
            if o.get("notes"):
                return [n["text"] for n in o["notes"]]
            return [str(n) for n in o.get("sales_notes", [])]
    return []


# ---- scoring one case ----------------------------------------------------------------------
def evaluate_case(case: Dict[str, Any], ws: WorkspaceState) -> Dict[str, Any]:
    t0 = time.perf_counter()
    res = run_query(ws, case["question"])
    latency = (time.perf_counter() - t0) * 1000
    res2 = run_query(ws, case["question"])
    plan = res["plan"]
    answer = res["answer"]
    ids = res["matched_ids"]
    out: Dict[str, Any] = {"id": case["id"], "question": case["question"], "adversarial": case.get("adversarial"), "latency_ms": round(latency, 1)}

    checks: Dict[str, bool] = {
        "intent": plan["intent"] == case["intent"],
        "include_ids": all(i in ids for i in case.get("include_ids", [])),
        "answer_contains": all(s in answer for s in case.get("answer_contains", [])),
        "answer_forbids": not any(s in answer for s in case.get("answer_forbids", [])),
        "low_confidence": (res["human_review_required"] or res["confidence"] < 0.5) if case.get("low_confidence") else True,
        "warning": all(any(w in ww for ww in res["warnings"] + [answer]) for w in [case["warning_contains"]] if isinstance(case.get("warning_contains"), str)) if case.get("warning_contains") else True,
    }
    raw = raw_metrics(ws)
    named = case.get("check")
    if named == "top_expected_value":
        checks["check"] = bool(ids) and ids[0] == raw["top_ev"]
    elif named == "stale_set":
        checks["check"] = set(ids) == raw["stale"]
    elif named == "pipeline_totals":
        checks["check"] = f"${round(raw['total']):,}" in answer and f"${round(raw['weighted']):,}" in answer
    elif named == "injection_not_top":
        run = ws.run()
        checks["check"] = [r.opportunity_id for r in run.recommendations].index(case["opportunity_id"]) > 100
    elif named == "scenario_independent":
        sc = res.get("scenario") or {}
        sim, sp = sc.get("simulation"), sc.get("scenario_params")
        if sim and sp:
            base, scen = independent_twin(ws.opportunities, sc["baseline_params"]), independent_twin(ws.opportunities, sp)
            checks["check"] = ((sim["opportunities_in_scope"], sim["opportunities_covered"]) == (scen["in_scope"], scen["covered"])
                               and abs(sim["scenario_expected_value"] - scen["value"]) <= 0.01
                               and abs(sim["baseline_expected_value"] - base["value"]) <= 0.01)
        else:
            checks["check"] = False
    if "expect_params" in case:      # the levers read from the question, checked against what the case says they must be
        sp = (res.get("scenario") or {}).get("scenario_params") or {}
        checks["scenario_params"] = all(sp.get(k) == v for k, v in case["expect_params"].items())
    if case.get("expect_no_simulation"):
        checks["no_simulation"] = (res.get("scenario") or {}).get("simulation") is None and not any(
            a["tool"] == "run_decision_twin" for a in res["analytics"])
    out["checks"] = checks
    out["task_success"] = all(checks.values())

    out["tool_selection"] = sorted(plan["analytics_tools"]) == sorted(case.get("tools", []))
    out["tool_arguments"] = (plan["opportunity_id"] or None) == (case.get("opportunity_id") or None)

    evidence = res["rag"]["evidence"] if res["rag"]["status"] == "ok" else []
    if case.get("rag") and not evidence:
        out["evidence_grounding"] = 0.0
        out["citation_correctness"] = 0.0
    elif evidence:
        grounded = sum(1 for e in evidence if e["doc_id"] and e["record_id"] and e["text"] in " ".join(note_texts(ws, e["record_id"])))
        out["evidence_grounding"] = grounded / len(evidence)
        about = set(ids) | ({case["opportunity_id"]} if case.get("opportunity_id") else set())
        # cited notes must belong to a record the answer is about (top-listed records or the one asked about)
        rec_ids = {r["opportunity_id"] for r in res.get("recommendations", [])}
        out["citation_correctness"] = sum(1 for e in evidence if e["record_id"] in (about | rec_ids)) / len(evidence)
    else:
        out["evidence_grounding"] = out["citation_correctness"] = None

    bad_numbers = numbers_ungrounded(res, ws)
    out["numbers_total"] = len(_numbers(_claims_text(answer)))
    out["numbers_ungrounded"] = bad_numbers
    out["deterministic"] = res["answer"] == res2["answer"] and res["matched_ids"] == res2["matched_ids"]
    return out


# ---- fact checks and failure recovery ------------------------------------------------------
def fact_checks(cache: Dict[str, WorkspaceState]) -> List[Dict[str, Any]]:
    from app.decision_forge import analytics
    rows = []
    for kind in ("synthetic", "real"):
        ws = cache[kind]
        raw = raw_metrics(ws)
        s = analytics.get_pipeline_summary(ws.opportunities, ws.reference_time)["result"]
        run = ws.run()
        rows += [
            {"name": f"{kind}_pipeline_total", "expected": raw["total"], "actual": s["total_pipeline_value"], "run_actual": run.pipeline_total_value},
            {"name": f"{kind}_weighted_ev", "expected": round(raw["weighted"], 2), "actual": s["weighted_expected_value"], "run_actual": run.weighted_pipeline_value},
            {"name": f"{kind}_stale_count", "expected": len(raw["stale"]), "actual": len(analytics.get_stale_opportunities(ws.opportunities, ws.reference_time)["result"]), "run_actual": run.stale_warning_count},
        ]
    for r in rows:
        r["ok"] = abs(r["expected"] - r["actual"]) <= 0.01 and abs(r["expected"] - r["run_actual"]) <= 0.01
    return rows


class _Scripted:
    def __init__(self, *replies):
        self.replies = list(replies)

    def complete(self, system, user):
        r = self.replies.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def failure_recovery(cache: Dict[str, WorkspaceState]) -> List[Dict[str, Any]]:
    ws = cache["synthetic"]
    q = "Which customers have gone cold?"
    results = []

    # RAG outage: an explain query still answers from structured data and discloses the outage
    coll = ws.engine.rag_service.collection
    original = coll.query

    def boom(**kw):
        raise RuntimeError("rag down")
    coll.query = boom  # type: ignore[assignment]
    try:
        r = run_query(ws, "Why is SYN-A01 ranked highly?")
        results.append({"name": "rag_outage", "ok": bool(r["answer"]) and r["rag"]["status"] == "unavailable" and any("unavailable" in f for f in r["fallbacks"])})
    finally:
        coll.query = original  # type: ignore[assignment]

    for name, llm in (
        ("llm_timeout", _Scripted(TimeoutError("slow"))),
        ("llm_invalid_twice", _Scripted("garbage", "still garbage")),
        ("llm_unknown_intent", _Scripted('{"intent": "wire_money"}', '{"intent": "wire_money"}')),
    ):
        r = run_query(ws, q, llm=llm)
        results.append({"name": name, "ok": r["plan"]["planner"] == "rules_fallback" and r["intent"] == "cold_customers" and bool(r["answer"]) and bool(r["fallbacks"])})
    return results


def percentile(values: List[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(p * (len(ordered) - 1))))]


def run() -> Dict[str, Any]:
    spec = json.load(open(CASES_PATH, encoding="utf-8"))
    cache: Dict[str, WorkspaceState] = {}
    for kind in ("synthetic", "real", "fresh"):
        cache[kind] = build_workspace(kind, f"eval-{kind}")

    rows = [evaluate_case(c, cache[c["dataset"]]) for c in spec["cases"]]
    facts = fact_checks(cache)
    recovery = failure_recovery(cache)

    def rate(key: str) -> float:
        vals = [r[key] for r in rows if r.get(key) is not None]
        return round(sum(float(v) for v in vals) / len(vals), 4) if vals else 1.0

    total_numbers = sum(r["numbers_total"] for r in rows)
    ungrounded = sum(len(r["numbers_ungrounded"]) for r in rows)
    latencies = [r["latency_ms"] for r in rows]
    metrics = {
        "cases": len(rows),
        "task_success_rate": rate("task_success"),
        "tool_selection": rate("tool_selection"),
        "tool_arguments": rate("tool_arguments"),
        "evidence_grounding": rate("evidence_grounding"),
        "citation_correctness": rate("citation_correctness"),
        "hallucination_rate": round(ungrounded / total_numbers, 4) if total_numbers else 0.0,
        "decision_determinism": rate("deterministic"),
        "data_accuracy": round(sum(1 for f in facts if f["ok"]) / len(facts), 4),
        "failure_recovery": round(sum(1 for f in recovery if f["ok"]) / len(recovery), 4),
        "latency_ms_p50": round(statistics.median(latencies), 1),
        "latency_ms_p95": round(percentile(latencies, 0.95), 1),
        "human_approval_rate": None,
    }
    return {"metrics": metrics, "cases": rows, "fact_checks": facts, "failure_recovery": recovery}


def main() -> int:
    report = run()
    m = report["metrics"]
    print("DecisionForge workflow evaluation")
    print("-" * 46)
    for k, v in m.items():
        print(f"{k:24s} {'n/a (runtime, from approvals table)' if v is None else v}")
    failed = [r for r in report["cases"] if not r["task_success"]]
    print("-" * 46)
    print(f"failed cases: {[r['id'] for r in failed] or 'none'}")
    for r in failed:
        print("  ", r["id"], {k: v for k, v in r["checks"].items() if not v})
    if "--write" in sys.argv:
        path = os.path.join(ROOT, "evals", "last_report.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, default=str)
        print("wrote", path)
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
