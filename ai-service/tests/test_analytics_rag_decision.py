"""Phase 3-6: analytics tools, RAG, deterministic decision engine and its explanations."""
import copy
from datetime import datetime, timezone

import pytest

from app.decision_forge import analytics
from app.decision_forge.decision_engine import DeterministicDecisionEngine
from app.decision_forge.policies import PRESETS, factor_weight_sum, get_preset
from app.decision_forge.rag_service import NotesRagService, chunk_text
from app.decision_forge.schemas import PolicyWeights
from app.decision_forge.workspace import WorkspaceState, compute_reference_time

REF = datetime(2026, 9, 29, 12, tzinfo=timezone.utc)


@pytest.fixture(scope="module")
def ws_syn():
    ws = WorkspaceState("test-syn")
    ws.load("synthetic")
    return ws


def _opp(**kw):
    base = {"opportunity_id": "T1", "company_name": "Test Co", "deal_value": 100000, "win_probability": 0.5,
            "engagement_score": 60, "last_contact_date": "2026-09-28T00:00:00Z", "stage": "Proposal Review",
            "sales_notes": ["Discussed line throughput."]}
    base.update(kw)
    return base


# ---- analytics -----------------------------------------------------------------------------
def test_expected_value_is_value_times_probability():
    assert analytics.expected_value({"deal_value": 680000, "win_probability": 0.91}) == pytest.approx(618800)


@pytest.mark.parametrize("opp", [
    {"deal_value": 1000, "win_probability": None},
    {"deal_value": 1000, "win_probability": 1.4},
    {"deal_value": -5, "win_probability": 0.5},
])
def test_expected_value_never_invented_for_bad_inputs(opp):
    assert analytics.expected_value(opp) is None


def test_pipeline_totals_and_exclusions(ws_syn):
    env = analytics.get_pipeline_summary(ws_syn.opportunities, REF, "synthetic")
    r = env["result"]
    manual_total = sum(max(0, o["deal_value"]) for o in ws_syn.opportunities)
    manual_weighted = sum(o["deal_value"] * o["win_probability"] for o in ws_syn.opportunities
                          if o["win_probability"] is not None and 0 <= o["win_probability"] <= 1 and o["deal_value"] >= 0)
    assert r["total_pipeline_value"] == pytest.approx(manual_total)
    assert r["weighted_expected_value"] == pytest.approx(manual_weighted, abs=0.01)
    excluded = {e["opportunity_id"] for e in r["excluded_from_expected_value"]}
    assert {"SYN-D01", "SYN-G01", "SYN-G02"} <= excluded
    assert sum(v["count"] for v in r["by_stage"].values()) == len(ws_syn.opportunities)


def test_every_tool_result_has_source_timestamp_definition(ws_syn):
    for env in (
        analytics.get_pipeline_summary(ws_syn.opportunities, REF),
        analytics.get_expected_value(ws_syn.opportunities, REF),
        analytics.get_stale_opportunities(ws_syn.opportunities, REF),
        analytics.get_activity_metrics(ws_syn.opportunities, ws_syn.activities, REF),
        analytics.get_sales_rep_capacity(ws_syn.opportunities, ws_syn.reps, REF),
        analytics.get_region_summary(ws_syn.opportunities, REF),
    ):
        assert env["source"] and env["timestamp"] == REF.isoformat() and env["definition"]


def test_stale_filter_and_sorting(ws_syn):
    stale = analytics.get_stale_opportunities(ws_syn.opportunities, REF, 30)["result"]
    assert "SYN-C01" in {s["opportunity_id"] for s in stale}
    assert all(s["days_since_last_contact"] > 30 for s in stale)
    days = [s["days_since_last_contact"] for s in stale]
    assert days == sorted(days, reverse=True)
    tighter = analytics.get_stale_opportunities(ws_syn.opportunities, REF, 10)["result"]
    assert len(tighter) > len(stale)


def test_expected_value_sorted_descending(ws_syn):
    rows = [r["expected_value"] for r in analytics.get_expected_value(ws_syn.opportunities, REF)["result"] if r["expected_value"] is not None]
    assert rows == sorted(rows, reverse=True)


def test_activity_metrics_empty_dataset_is_explicit():
    res = analytics.get_activity_metrics([], [], REF)["result"]
    assert res["total_activities"] == 0 and res["note"]


# ---- RAG -----------------------------------------------------------------------------------
def _rag_with(opps):
    rag = NotesRagService()
    rag.index_opportunities(opps)
    return rag


def test_relevant_note_retrieved_with_full_source_metadata():
    rag = _rag_with([
        _opp(opportunity_id="A", sales_notes=["Procurement confirmed budget approved and asked for a formal quote."]),
        _opp(opportunity_id="B", sales_notes=["Reviewed floor layout constraints for the packaging area."]),
    ])
    res = rag.retrieve("budget approved formal quote", top_k=1)
    assert res["status"] == "ok"
    ev = res["evidence"][0]
    assert ev["record_id"] == "A" and ev["source_type"] == "sales_note" and ev["doc_id"]
    assert ev["text"] and isinstance(ev["relevance"], float) and "created_at" in ev


def test_irrelevant_query_yields_insufficient_evidence_not_a_forced_match():
    rag = _rag_with([_opp(opportunity_id="A", sales_notes=["Discussed conveyor throughput and maintenance."])])
    res = rag.retrieve("quarterly headcount attrition percentage for the finance department", top_k=3)
    assert res["status"] == "insufficient_evidence" and res["evidence"] == []
    assert res["message"] == "Insufficient evidence."


def test_never_cites_another_opportunitys_note():
    rag = _rag_with([
        _opp(opportunity_id="A", sales_notes=["Budget approved; formal quote requested."]),
        _opp(opportunity_id="B", sales_notes=["Budget approved; formal quote requested, signing this month."]),
    ])
    res = rag.retrieve("budget approved quote", opportunity_id="A", top_k=5, min_relevance=None)
    assert res["evidence"] and {e["record_id"] for e in res["evidence"]} == {"A"}


def test_no_notes_means_no_evidence():
    rag = _rag_with([_opp(opportunity_id="A", sales_notes=[])])
    assert rag.retrieve("anything", opportunity_id="A")["status"] == "insufficient_evidence"


def test_retrieval_failure_is_reported_not_raised(monkeypatch):
    rag = _rag_with([_opp()])
    monkeypatch.setattr(rag.collection, "query", lambda **kw: (_ for _ in ()).throw(RuntimeError("boom")))
    assert rag.retrieve("x")["status"] == "unavailable"


def test_long_notes_are_chunked_on_sentence_boundaries():
    text = " ".join(f"Sentence number {i} about the line upgrade." for i in range(30))
    chunks = chunk_text(text, 120)
    assert len(chunks) > 3 and all(len(c) <= 160 for c in chunks)
    assert " ".join(chunks).split() == text.split()


def test_reindex_after_reset_leaves_no_stale_notes():
    rag = _rag_with([_opp(opportunity_id="OLD", sales_notes=["old note about budget"])])
    rag.reset()
    rag.index_opportunities([_opp(opportunity_id="NEW", sales_notes=["new note about budget"])])
    ids = {e["record_id"] for e in rag.retrieve("budget", top_k=5, min_relevance=None)["evidence"]}
    assert ids == {"NEW"}


# ---- decision engine -----------------------------------------------------------------------
def _score(opp, policy=None, engine=None):
    engine = engine or DeterministicDecisionEngine()
    return engine.evaluate_opportunity(opp, policy or PolicyWeights(), reference_time=REF, decision_run_id="T")


def test_score_equals_sum_of_factor_contributions_minus_penalty():
    for policy in (PolicyWeights(), get_preset("sales_priority_v1_1")):
        rec = _score(_opp(win_probability=None), policy)
        total = sum(f.weighted_contribution for f in rec.factors)
        assert rec.priority_score == pytest.approx(max(0.0, total), abs=0.11)


def test_clean_record_has_no_penalty_factor_and_full_confidence():
    rec = _score(_opp())
    assert "Data Quality Penalty" not in [f.name for f in rec.factors]
    assert rec.confidence == 0.9 and not rec.review_required and rec.warnings == []


def test_missing_probability_lowers_score_and_confidence_with_explicit_warning():
    clean, missing = _score(_opp()), _score(_opp(win_probability=None))
    assert missing.priority_score < clean.priority_score
    assert missing.confidence < clean.confidence
    assert "Decision confidence reduced because CRM probability is missing." in missing.warnings
    pen = next(f for f in missing.factors if f.name == "Data Quality Penalty")
    assert pen.weighted_contribution == -8.0


def test_low_confidence_flags_human_review():
    rec = _score(_opp(win_probability=None, deal_value=-1, last_contact_date="2026-05-01T00:00:00Z"))
    assert rec.review_required and rec.confidence < 0.5
    assert any("Human review required" in w for w in rec.warnings)


def test_policy_thresholds_drive_classification():
    opp = _opp(deal_value=300000, win_probability=0.8, engagement_score=90)
    loose = _score(opp, PolicyWeights(high_priority_threshold=1.0, medium_priority_threshold=0.5))
    strict = _score(opp, PolicyWeights(high_priority_threshold=101.0, medium_priority_threshold=100.0))
    assert loose.decision_class == "IMMEDIATE_ACTION" and strict.decision_class == "NURTURE_MONITOR"


def test_all_policy_presets_sum_to_one():
    for name, p in PRESETS.items():
        assert factor_weight_sum(p) == pytest.approx(1.0), name
        assert p.policy_version == name


def test_buying_intent_only_counts_when_policy_weights_it():
    hidden = _opp(win_probability=0.35, sales_notes=["Procurement confirmed budget approved and asked for a formal quote; signing targeted this month."])
    plain, with_intent = _score(hidden), _score(hidden, get_preset("sales_priority_v1_1"))
    assert "Buying Intent (rep notes)" not in [f.name for f in plain.factors]
    assert "Buying Intent (rep notes)" in [f.name for f in with_intent.factors]
    assert with_intent.evidence_pack["buying_intent"]["score"] == 100


def test_run_is_deterministic_and_stamped_with_policy_and_snapshot(ws_syn):
    pol = get_preset("sales_priority_v1_1")
    a, b = ws_syn.run(pol), ws_syn.run(pol)
    assert [(r.opportunity_id, r.priority_score) for r in a.recommendations] == \
           [(r.opportunity_id, r.priority_score) for r in b.recommendations]
    assert a.policy_version == "sales_priority_v1_1" and a.policy["buying_intent_weight"] == 0.15
    assert a.snapshot_id == b.snapshot_id and a.snapshot_id.startswith("snap-")


def test_planted_cases_behave_as_designed(ws_syn):
    run = ws_syn.run(get_preset("sales_priority_v1_1"))
    rank = {r.opportunity_id: i for i, r in enumerate(run.recommendations, 1)}
    by = {r.opportunity_id: r for r in run.recommendations}
    assert rank["SYN-A01"] == 1                                             # A: high value + engagement + recent
    assert by["SYN-B01"].decision_class == "NURTURE_MONITOR"                # B: low value, high activity
    assert by["SYN-C01"].stale_data_warning and by["SYN-C01"].confidence < 0.9   # C: high value but stale
    assert any(i["issue_type"] == "MISSING_PROBABILITY" for i in by["SYN-D01"].data_quality_issues)   # D
    plain_rank = {r.opportunity_id: i for i, r in enumerate(ws_syn.run().recommendations, 1)}
    assert by["SYN-E01"].evidence_pack["buying_intent"]["strong"]                                     # E: hidden intent
    assert rank["SYN-E01"] < plain_rank["SYN-E01"] and rank["SYN-E01"] <= len(rank) // 4              # ...lifts it into the top quartile
    assert any(i["issue_type"] == "DUPLICATE" for i in by["SYN-F02"].data_quality_issues)             # F
    assert by["SYN-G01"].confidence < 0.9 and by["SYN-G02"].confidence < 0.9                          # G


def test_evidence_pack_is_fully_labelled_and_sourced(ws_syn):
    rec = ws_syn.run().recommendations[0]
    pack = rec.evidence_pack
    assert pack["labels"]["priority_score"] == "DECISION" and pack["labels"]["factor_scores"] == "ANALYSIS"
    assert pack["rag_notes"] and all(n["doc_id"] and n["record_id"] and n["source_type"] for n in pack["rag_notes"])
    assert "definition" in pack["buying_intent"]


def test_engine_never_mutates_the_input_record():
    opp = _opp(win_probability=None)
    before = copy.deepcopy(opp)
    _score(opp)
    assert opp == before


def test_reference_time_is_snapshot_not_wall_clock(ws_syn):
    assert compute_reference_time(ws_syn.opportunities).year == 2026


def test_factor_text_claims_only_what_the_data_supports():
    """No 'historical close rate', 'team target' or 'rep-logged interaction' claims; estimated and
    synthetic values must say so in the real-account dataset."""
    real = WorkspaceState("wording-real")
    real.load("real")
    for rec in real.run().recommendations:
        text = " ".join(f.description for f in rec.factors)
        for banned in ("yields", "team target", "rep-logged"):
            assert banned not in text, (rec.company_name, banned)
        # "historical close rate" may only appear inside the disclaimer that says it is NOT one
        assert text.count("historical close rate") == text.count("not a historical close rate"), rec.company_name
        by = {f.name: f.description for f in rec.factors}
        assert "estimate" in by["Win Likelihood"].lower()
        assert "synthetic" in by["Account Engagement"].lower()
        assert "reference ceiling" in by["Deal Size Impact"] and "Analyst estimate" in by["Deal Size Impact"]
        assert "days) before the data snapshot" in by["Recency & Momentum"] or "day(s) before the data snapshot" in by["Recency & Momentum"]


def test_missing_probability_factor_explains_the_neutral_value(ws_syn):
    by = {r.opportunity_id: r for r in ws_syn.run().recommendations}
    factor = next(f for f in by["SYN-D01"].factors if f.name == "Win Likelihood")
    assert "missing" in factor.description.lower() and "neutral 50%" in factor.description
