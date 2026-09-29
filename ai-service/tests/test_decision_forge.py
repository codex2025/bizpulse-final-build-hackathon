import copy
import json
import re

from app.decision_forge.qa import SUGGESTED_QUESTIONS, answer_question
from app.decision_forge.schema_mapper import load_dataset
from app.decision_forge.schemas import PolicyWeights

BANNED = "example" + ".com"  # fake-citation domain; built dynamically so a repo-wide grep stays clean
DATE_RE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")


# 1. Provenance integrity -----------------------------------------------------------
def test_every_record_has_valid_provenance(raw_dataset):
    records = raw_dataset["opportunities"]
    assert len(records) == 12
    for rec in records:
        prov = rec["provenance"]
        assert len(prov) >= 1, rec["company_name"]
        for p in prov:
            assert p["url"].startswith("https://"), p
            assert p["publisher"].strip(), p
            assert DATE_RE.match(p["published_date"]), p
            assert DATE_RE.match(p["retrieved_date"]), p


def test_no_example_com_anywhere_in_dataset_or_signals(raw_dataset, opportunities):
    assert BANNED not in json.dumps(raw_dataset).lower()
    for o in opportunities:
        assert BANNED not in json.dumps(o).lower()
        assert BANNED not in json.dumps(o["external_signal"]).lower()


# 2. Determinism --------------------------------------------------------------------
def test_engine_is_deterministic(run_all):
    first = [(r.opportunity_id, r.priority_score, r.decision_class) for r in run_all()]
    second = [(r.opportunity_id, r.priority_score, r.decision_class) for r in run_all()]
    assert first == second


# 3. Sourced / modeled separation ---------------------------------------------------
def test_modeled_fields_never_emitted_without_basis(run_all):
    for rec in run_all():
        pack = rec.evidence_pack
        assert pack["field_origin"]["deal_value"] == "estimated"
        assert pack["field_origin"]["win_probability"] == "estimated"
        for field in ("deal_value", "win_probability"):
            assert pack["modeled_basis"].get(field, "").strip(), (rec.company_name, field)
        # Estimated numbers must not leak into the sourced block.
        assert "deal_value" not in pack["sourced_facts"]
        assert "win_probability" not in pack["sourced_facts"]


def test_mapper_flattens_modeled_and_keeps_sourced(raw_dataset):
    loaded = load_dataset(raw_dataset)
    assert loaded["meta"]["dataset_name"] == "real_industrial_crm"
    first = loaded["opportunities"][0]
    assert first["deal_value"] == raw_dataset["opportunities"][0]["modeled"]["deal_value"]
    assert first["sourced"] == raw_dataset["opportunities"][0]["sourced"]
    assert first["provenance"]


def test_mapper_still_loads_legacy_flat_format():
    legacy = [{"opportunity_id": "X1", "company_name": "Legacy Co", "deal_value": 1000}]
    loaded = load_dataset(legacy)
    assert loaded["meta"] is None
    assert loaded["opportunities"] == legacy


# 4. Score spread -------------------------------------------------------------------
def test_scores_span_multiple_decision_classes(run_all):
    recs = run_all()
    assert len({r.decision_class for r in recs}) > 1
    assert len({r.priority_score for r in recs}) > 3


# 5. Stale detection ----------------------------------------------------------------
def test_exactly_the_two_old_contacts_are_stale(run_all):
    stale = {r.company_name for r in run_all() if r.stale_data_warning}
    assert stale == {"Pirelli", "Toyotetsu Mid America"}


# 6. Q&A ----------------------------------------------------------------------------
def test_suggested_questions_return_grounded_answers(run_all):
    recs = run_all()
    company_names = {r.company_name for r in recs}
    for q in SUGGESTED_QUESTIONS:
        res = answer_question(q, recs)
        assert res["answer"].strip()
        assert res["matched_companies"], q
        assert set(res["matched_companies"]) <= company_names
        assert any(name in res["answer"] for name in res["matched_companies"])


def test_cold_question_matches_stale_detection(run_all):
    recs = run_all()
    res = answer_question("Which customers have gone cold?", recs)
    assert set(res["matched_companies"]) == {"Pirelli", "Toyotetsu Mid America"}


# 7. Graceful degradation -----------------------------------------------------------
def test_missing_sourced_and_provenance_does_not_crash(run_all, opportunities):
    degraded = copy.deepcopy(opportunities[:3])
    degraded[0]["sourced"] = {}
    degraded[1].pop("sourced")
    degraded[1]["provenance"] = []
    degraded[2].pop("provenance")
    degraded[2].pop("external_signal")
    recs = run_all(degraded)
    assert len(recs) == 3
    for r in recs:
        assert r.evidence_pack["provenance"] == [] or isinstance(r.evidence_pack["provenance"], list)
        assert isinstance(r.evidence_pack["sourced_facts"], dict)


def test_raw_record_with_empty_modeled_block_maps_and_scores(engine):
    loaded = load_dataset({"dataset_meta": {}, "opportunities": [
        {"opportunity_id": "E1", "company_name": "Empty Co", "sourced": {}, "modeled": {}, "provenance": []}
    ]})
    rec = engine.evaluate_opportunity(loaded["opportunities"][0], PolicyWeights())
    assert rec.company_name == "Empty Co"
    assert 0 <= rec.priority_score <= 100


def test_pipeline_totals_equal_sum_of_records(opportunities):
    total = sum(o["deal_value"] for o in opportunities)
    weighted = sum(o["deal_value"] * o["win_probability"] for o in opportunities)
    assert total == 6715000
    assert round(weighted, 2) == 4341150.0
