"""
Executes a natural-language question end to end:

  question -> QueryPlan -> [analytics tools] -> [decision run] -> [RAG evidence] -> answer

Only the tools the plan calls for are executed. All numbers come from deterministic code; the
answer text is assembled from those structured results (an optional LLM never writes numbers or
facts). Every result carries a `trace` of the steps taken, used for observability and replay.
"""
import time
from typing import Any, Dict, List, Optional

from app.decision_forge import analytics, intent as intent_lexicon
from app.decision_forge.decision_twin import DecisionTwinSimulator
from app.decision_forge.planner import LLMClient, QueryPlan, plan_query
from app.decision_forge.qa import region_of
from app.decision_forge.scenario_parser import SUPPORTED_LEVERS_HELP, describe_params, parse_scenario
from app.decision_forge.schemas import PolicyWeights, SimulationInput
from app.decision_forge.workspace import WorkspaceState

BASIS = ("Computed from the active workspace's business records. Values labelled ESTIMATE/PREDICTION are analyst "
         "estimates; ANALYSIS is deterministic arithmetic; DECISION is the configured policy's output.")
UNSUPPORTED = ("I can't map that question to a supported analysis of this business data. Try asking which "
               "opportunities to prioritize, which are stale or cold, highest expected value, weakest region, "
               "buying intent, or why a specific opportunity (e.g. SYN-A01) ranks where it does.")
BUYING_INTENT_QUERY = "budget approved formal quote ready to sign purchase order signing this month"
SCENARIO_CONFIDENCE = 0.8   # capped below the 0.9 analytics default: a scenario rests on the Twin's stated assumptions
TWIN_DEFINITION = (
    "Decision Twin: baseline and scenario parameter sets run through the same capacity-limited model on a copy of the snapshot "
    "(coverage = highest expected value first, up to reps x contacts/day x 20 working days / 4 touchpoints per deal); the "
    "response-window and focus multipliers are stated assumptions, not measurements."
)
_twin = DecisionTwinSimulator()
# Every tool a QueryPlan may name: the read-only analytics tools plus the Decision Twin. The pipeline executes
# these and nothing else, whatever a planner (rules or LLM) says.
PLANNABLE_TOOLS = frozenset(analytics.TOOLS) | {"run_decision_twin"}


def _fmt(n: Optional[float]) -> str:
    return "n/a" if n is None else f"${round(n):,}"


class _Trace:
    def __init__(self) -> None:
        self.steps: List[Dict[str, Any]] = []

    def step(self, name: str, started: float, detail: Any = None) -> None:
        self.steps.append({"step": name, "latency_ms": round((time.perf_counter() - started) * 1000, 2), "detail": detail})


def _rec_brief(r) -> Dict[str, Any]:
    return {
        "opportunity_id": r.opportunity_id, "company_name": r.company_name, "priority_score": r.priority_score,
        "decision_class": r.decision_class, "deal_value": r.deal_value, "confidence": r.confidence,
        "review_required": r.review_required, "suggested_action": r.suggested_action, "warnings": r.warnings,
        "stale_data_warning": r.stale_data_warning,
    }


def run_query(ws: WorkspaceState, question: str, llm: Optional[LLMClient] = None,
              policy: Optional[PolicyWeights] = None) -> Dict[str, Any]:
    trace = _Trace()
    ws.ensure_loaded()
    ref = ws.reference_time
    opps, ds = ws.opportunities, ws.dataset_key

    t = time.perf_counter()
    plan: QueryPlan = plan_query(question, [o.get("opportunity_id", "") for o in opps], llm)
    trace.step("plan", t, plan.model_dump())

    analytics_out: List[Dict[str, Any]] = []
    rag: Dict[str, Any] = {"status": "not_required", "evidence": [], "message": ""}
    fallbacks: List[str] = []
    warnings: List[str] = []
    recs = []
    answer = UNSUPPORTED
    confidence = 0.9
    matched: List[Dict[str, Any]] = []
    stats: Dict[str, Any] = {"stale_threshold_days": 30}
    scenario: Optional[Dict[str, Any]] = None

    # ---- decision run (only when the plan needs ranked recommendations) ----------------------
    if plan.decision_run_required:
        t = time.perf_counter()
        run = ws.run(policy or PolicyWeights())
        recs = run.recommendations
        trace.step("decision_run", t, {"decision_run_id": run.decision_run_id, "policy_version": run.policy_version})

    def use(tool: str, **kw) -> Dict[str, Any]:
        t0 = time.perf_counter()
        env = analytics.TOOLS[tool](**kw)
        analytics_out.append(env)
        trace.step(f"analytics:{tool}", t0, {"records": env["source"]["records"]})
        return env

    intent = plan.intent
    if intent in ("prioritize_opportunities", "immediate_attention"):
        summary = use("get_pipeline_summary", opps=opps, ref=ref, dataset_key=ds)["result"]
        immediate = [r for r in recs if r.decision_class == "IMMEDIATE_ACTION"]
        picks = (immediate if (intent == "immediate_attention" or immediate) else recs)[:5]
        if not picks:
            answer = "No opportunities are loaded, so there is nothing to prioritize."
        else:
            listing = "; ".join(
                f"{r.company_name} ({r.priority_score}, {r.decision_class.replace('_', ' ').lower()}"
                f"{', REVIEW REQUIRED' if r.review_required else ''})" for r in picks)
            answer = (f"{len(picks)} opportunit{'y' if len(picks) == 1 else 'ies'} to work first under policy "
                      f"{ws.last_run.policy_version}: {listing}. Pipeline {_fmt(summary['total_pipeline_value'])}, "
                      f"weighted expected value {_fmt(summary['weighted_expected_value'])}.")
        matched = [_rec_brief(r) for r in picks]
        rag = {"status": "ok" if any(r.evidence_pack.get("rag_notes") for r in picks) else "insufficient_evidence",
               "evidence": [n for r in picks for n in r.evidence_pack.get("rag_notes", [])],
               "message": "" if picks else "Insufficient evidence."}
        confidence = min([r.confidence for r in picks] or [0.9])

    elif intent in ("cold_customers", "stale_opportunities"):
        env = use("get_stale_opportunities", opps=opps, ref=ref, dataset_key=ds)
        stale = env["result"]
        matched = stale
        stats["total_matches"] = len(stale)
        if stale:
            answer = (f"{len(stale)} opportunit{'y is' if len(stale) == 1 else 'ies are'} stale (>30 days since last contact): "
                      + "; ".join(f"{s['company_name']} ({s['days_since_last_contact']} days)" for s in stale[:10])
                      + ("; ..." if len(stale) > 10 else "") + ".")
        else:
            answer = "No opportunities are flagged stale; every account was contacted within the policy window."

    elif intent == "highest_expected_value":
        rows = [r for r in use("get_expected_value", opps=opps, ref=ref, dataset_key=ds)["result"] if r["expected_value"] is not None][:5]
        matched = rows
        answer = ("Highest expected value (deal value x probability): "
                  + ", ".join(f"{r['company_name']} ({_fmt(r['expected_value'])})" for r in rows) + "."
                  if rows else "Expected value cannot be computed: no record has a valid probability and deal value.")
        excl = analytics.get_pipeline_summary(opps, ref, ds)["result"]["excluded_from_expected_value"]
        if excl:
            warnings.append(f"{len(excl)} record(s) excluded from expected value (missing/invalid probability or deal value).")

    elif intent == "high_value_low_probability":
        rows = use("get_expected_value", opps=opps, ref=ref, dataset_key=ds)["result"]
        values = sorted(r["deal_value"] for r in rows if r["deal_value"] is not None and r["deal_value"] > 0)
        cutoff = values[int(0.75 * (len(values) - 1))] if values else 0.0
        hits = [r for r in rows if (r["deal_value"] or 0) >= cutoff and r["probability"] is not None and 0 <= r["probability"] < 0.5]
        hits.sort(key=lambda r: (-(r["deal_value"] or 0), str(r["opportunity_id"])))
        matched = [{**h, "probability_percent": round(h["probability"] * 100)} for h in hits[:10]]
        stats.update({"total_matches": len(hits), "value_cutoff": cutoff, "probability_ceiling_percent": 50})
        answer = (f"{len(hits)} high-value (top quartile, >= {_fmt(cutoff)}) opportunit{'y has' if len(hits) == 1 else 'ies have'} "
                  "a win probability below 50%: " + ", ".join(f"{h['company_name']} ({_fmt(h['deal_value'])}, {round(h['probability'] * 100)}%)" for h in hits[:5])
                  + "." if hits else f"No top-quartile (>= {_fmt(cutoff)}) opportunity has a win probability below 50%.")

    elif intent == "region_performance":
        summary_env = use("get_region_summary", opps=opps, ref=ref, dataset_key=ds)
        groups: Dict[str, list] = {}
        for r in recs:
            groups.setdefault(region_of(r.evidence_pack.get("structured_data", {}).get("location") or ""), []).append(r)
        ranked = sorted(groups.items(), key=lambda kv: (sum(x.priority_score for x in kv[1]) / len(kv[1]), kv[0]))
        top_region = summary_env["result"][0] if summary_env["result"] else None
        if ranked:
            name, members = ranked[0]
            avg = sum(x.priority_score for x in members) / len(members)
            answer = (f"{name} is the weakest region by average priority score ({avg:.1f} across {len(members)} opportunit"
                      f"{'y' if len(members) == 1 else 'ies'}: {', '.join(f'{x.company_name} ({x.opportunity_id})' for x in members[:5])}{'; ...' if len(members) > 5 else ''})."
                      + (f" Strongest pipeline by expected value: {top_region['region']} ({_fmt(top_region['expected_value'])})." if top_region else ""))
            matched = [_rec_brief(x) for x in members[:100]]
            stats["total_matches"] = len(members)
        else:
            answer = "No location data available to group by region."

    elif intent == "buying_intent":
        scored = []
        for o in opps:
            s = intent_lexicon.score_notes(o.get("notes") or o.get("sales_notes") or [])
            if s["score"] >= 40 and not s["negative"]:
                scored.append((s["score"], o, s))
        scored.sort(key=lambda t: (-t[0], str(t[1].get("opportunity_id"))))
        t0 = time.perf_counter()
        evidence: List[Dict[str, Any]] = []
        for _, o, s in scored[:8]:
            res = ws.engine.rag_service.retrieve(BUYING_INTENT_QUERY, opportunity_id=o.get("opportunity_id"), top_k=1, min_relevance=None)
            evidence += res["evidence"]
        trace.step("rag", t0, {"queried_opportunities": min(8, len(scored))})
        rag = {"status": "ok" if evidence else "insufficient_evidence", "evidence": evidence,
               "message": "" if evidence else "Insufficient evidence."}
        matched = [{"opportunity_id": o.get("opportunity_id"), "company_name": o.get("company_name"),
                    "intent_score": sc, "phrases": [h["phrase"] for h in s["strong"] + s["medium"]]} for sc, o, s in scored[:100]]
        stats["total_matches"] = len(scored)
        answer = (f"{len(scored)} opportunit{'y shows' if len(scored) == 1 else 'ies show'} strong buying intent in rep notes "
                  "(fixed phrase lexicon, no negative phrases): "
                  + ", ".join(f"{m['company_name']} ({m['intent_score']:.0f})" for m in matched[:5]) + "."
                  if scored else "Insufficient evidence: no rep note contains strong buying-intent language.")

    elif intent == "insufficient_data":
        flagged = [r for r in recs if r.data_quality_issues and any(i["issue_type"] in
                   ("MISSING_PROBABILITY", "CONFLICTING_PROBABILITY", "INVALID_DEAL_VALUE", "DUPLICATE") for i in r.data_quality_issues)]
        flagged.sort(key=lambda r: (r.confidence, r.opportunity_id))
        matched = [_rec_brief(r) for r in flagged[:100]]
        stats["total_matches"] = len(flagged)
        answer = (f"{len(flagged)} opportunit{'y has' if len(flagged) == 1 else 'ies have'} data problems that lower decision confidence: "
                  + "; ".join(f"{r.company_name} ({', '.join(sorted({i['issue_type'] for i in r.data_quality_issues if i['issue_type'] != 'MISSING_CONTACT'}))})" for r in flagged[:5])
                  + "." if flagged else "No opportunity has missing, conflicting, invalid or duplicate data.")

    elif intent == "explain_opportunity":
        rec = next((r for r in recs if r.opportunity_id.lower() == (plan.opportunity_id or "").lower()), None)
        if rec is None:
            answer = f"Opportunity {plan.opportunity_id} was not found in this workspace."
            confidence = 0.0
        else:
            use("get_opportunity_metrics", opps=opps, ref=ref, opportunity_id=rec.opportunity_id, dataset_key=ds)
            t0 = time.perf_counter()
            # The record's own notes are context for explaining it (metadata-filtered to this opportunity);
            # relevance only orders them. "Insufficient evidence" therefore means it has no notes at all.
            res = ws.engine.rag_service.retrieve(question, opportunity_id=rec.opportunity_id, top_k=2, min_relevance=None)
            trace.step("rag", t0, {"status": res["status"]})
            rag = res
            top_factors = sorted(rec.factors, key=lambda f: -f.weighted_contribution)[:3]
            answer = (f"{rec.company_name} ({rec.opportunity_id}) scores {rec.priority_score} ({rec.decision_class.replace('_', ' ').lower()}) under policy "
                      f"{ws.last_run.policy_version}. Biggest contributions: "
                      + ", ".join(f"{f.name} {f.weighted_contribution:+.1f}" for f in top_factors) + ". "
                      f"Confidence {rec.confidence}."
                      + (" Insufficient evidence from rep notes for this question." if res["status"] == "insufficient_evidence" else ""))
            matched = [{**_rec_brief(rec), "factors": [{"name": f.name, "weighted_contribution": f.weighted_contribution} for f in rec.factors]}]
            confidence = rec.confidence
            warnings += rec.warnings

    elif intent == "pipeline_summary":
        s = use("get_pipeline_summary", opps=opps, ref=ref, dataset_key=ds)["result"]
        answer = (f"{s['opportunity_count']} opportunities; pipeline {_fmt(s['total_pipeline_value'])}, weighted expected value "
                  f"{_fmt(s['weighted_expected_value'])}.")
        matched = [{"opportunity_count": s["opportunity_count"]}]

    elif intent == "rep_capacity":
        rows = use("get_sales_rep_capacity", opps=opps, reps=ws.reps, ref=ref, dataset_key=ds)["result"]
        over = [r for r in rows if r["utilization_percent"] > 100]
        matched = rows
        stats.update({"reps_analyzed": len(rows), "over_capacity": len(over), "capacity_threshold_percent": 100})
        answer = (f"{len(rows)} reps analysed; {len(over)} above 100% of monthly touchpoint capacity"
                  + (": " + ", ".join(f"{r['rep']} ({r['utilization_percent']}%)" for r in over[:5]) if over else "") + ".")

    elif intent == "scenario_simulation":
        # The numbers come from scenario_parser (regex + arithmetic on the question text), never from a model.
        t0 = time.perf_counter()
        req = parse_scenario(question)
        trace.step("scenario_parse", t0, req.to_dict())
        stats["scenario_levers"] = [lv.to_dict() for lv in req.levers]
        stats["scenario_problems"] = req.problem_details      # the numbers behind any blocking message
        scenario = {**req.to_dict(), "recognized": bool(req.levers), "baseline_params": req.baseline.model_dump(),
                    "scenario_params": None, "simulation": None}
        warnings += [f"Not applied: {u}" for u in req.unsupported] + req.notes
        if not req.runnable:
            confidence = 0.0
            if req.problems:
                answer = "I can't run that scenario as asked. " + " ".join(req.problems) + " " + SUPPORTED_LEVERS_HELP
            else:
                answer = ("This looks like a what-if question, but I couldn't find a lever I can simulate in it. "
                          + " ".join(req.unsupported + [SUPPORTED_LEVERS_HELP]))
            warnings.append("Scenario not simulated.")
        elif not opps:
            confidence = 0.0
            answer = "No opportunities are loaded, so there is nothing to simulate."
        else:
            scenario_p = req.scenario_params()
            t0 = time.perf_counter()
            # The Twin works on its own copy of the records: the workspace snapshot is never mutated.
            sim = _twin.simulate([dict(o) for o in opps], SimulationInput(**scenario_p.model_dump(), baseline=req.baseline))
            trace.step("analytics:run_decision_twin", t0, {"records": len(opps), "simulation_id": sim.simulation_id})
            analytics_out.append(analytics._envelope("run_decision_twin", sim.model_dump(), ref, ds, len(opps), TWIN_DEFINITION))
            base_s = sim.baseline_summary
            applied = "; ".join(lv.describe() for lv in req.levers)
            answer = (f"Scenario estimate (not a forecast): {applied}; every other setting stays at baseline "
                      f"({describe_params(req.baseline)}). Expected value of the opportunities the team can cover: "
                      f"{_fmt(sim.scenario_expected_value)} vs {_fmt(sim.baseline_expected_value)} at baseline "
                      f"({sim.delta_revenue_percent:+.1f}%). Coverage: {sim.opportunities_covered} of {sim.opportunities_in_scope} "
                      f"in-scope opportunities (baseline {base_s['covered']} of {base_s['in_scope']}); capacity utilization "
                      f"{sim.rep_capacity_utilization_percent}% (baseline {base_s['utilization_percent']}%)."
                      + (f" {sim.capacity_warning}" if sim.capacity_warning else ""))
            if sim.scenario_expected_value == sim.baseline_expected_value:
                # A flat result is a finding, not an error: say why so it does not look like a broken feature.
                answer += (" Expected value is unchanged: under the Twin's assumptions these settings do not change which "
                           "opportunities the team can cover or their modelled win probability.")
                if base_s["covered"] == base_s["in_scope"] and {lv.lever for lv in req.levers} & {"sales_reps_count", "contacts_per_day"}:
                    answer += " The baseline team already covers every in-scope opportunity, so extra capacity adds no coverage."
            elif abs(sim.scenario_expected_value_no_assumptions - base_s["expected_value_no_assumptions"]) < 0.005:
                # Same covered value before the multipliers, different value after: the change is the assumptions, not the data.
                answer += (" The whole change comes from the Twin's stated assumptions (response-window and focus multipliers): "
                           "the same opportunities are covered, so it is a modelled effect, not a measured one.")
            confidence = SCENARIO_CONFIDENCE
            scenario.update({"scenario_params": scenario_p.model_dump(), "simulation": sim.model_dump()})

    else:  # unknown
        confidence = 0.0
        warnings.append("Question could not be mapped to a supported analysis.")

    if plan.planner == "rules_fallback":
        fallbacks.append(f"LLM planner unavailable or invalid ({plan.planner_error}); used deterministic rules planner.")
    if rag["status"] == "unavailable":
        fallbacks.append("Evidence retrieval unavailable; answer uses structured data only.")

    return {
        "question": question,
        "plan": plan.model_dump(),
        "answer": answer,
        "intent": intent,
        "confidence": round(confidence, 2),
        "human_review_required": confidence < 0.5,
        "matched": matched,
        "matched_ids": [m.get("opportunity_id") for m in matched if isinstance(m, dict) and m.get("opportunity_id")],
        "matched_companies": [m.get("company_name") for m in matched if isinstance(m, dict) and m.get("company_name")],
        "stats": stats,
        "scenario": scenario,
        "analytics": analytics_out,
        "rag": rag,
        "recommendations": [r.model_dump() for r in recs[:10]] if recs else [],
        "decision_run_id": ws.last_run.decision_run_id if (plan.decision_run_required and ws.last_run) else None,
        "policy_version": ws.last_run.policy_version if (plan.decision_run_required and ws.last_run) else None,
        "run_summary": ({
            "records_analyzed": ws.last_run.records_analyzed,
            "recommendations_count": ws.last_run.recommendations_count,
            "pipeline_total_value": ws.last_run.pipeline_total_value,
            "weighted_pipeline_value": ws.last_run.weighted_pipeline_value,
            "high_priority_count": ws.last_run.high_priority_count,
            "stale_warning_count": ws.last_run.stale_warning_count,
            "policy_version": ws.last_run.policy_version,
            "policy": ws.last_run.policy,
        } if (plan.decision_run_required and ws.last_run) else None),
        "dataset_key": ds,
        "snapshot_id": ws.snapshot_id,
        "data_snapshot": ref.isoformat(),
        "warnings": warnings,
        "fallbacks": fallbacks,
        "labels": {"answer": "ANALYSIS", "recommendation": "DECISION", "external": "EXTERNAL", "estimates": "PREDICTION"},
        "basis": BASIS,
        "trace": trace.steps,
    }
