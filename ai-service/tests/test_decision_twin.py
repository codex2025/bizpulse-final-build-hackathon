"""Phase 8: Decision Twin baseline/scenario math, capacity limits, non-mutation, honesty."""
import hashlib
import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.decision_forge import analytics
from app.decision_forge.decision_twin import DecisionTwinSimulator
from app.decision_forge.schemas import ScenarioParams, SimulationInput
from app.decision_forge.workspace import WorkspaceState
from app.main import app

REF = datetime(2026, 9, 29, 12, tzinfo=timezone.utc)
twin = DecisionTwinSimulator()
client = TestClient(app)


@pytest.fixture(scope="module")
def opps():
    ws = WorkspaceState("twin")
    ws.load("synthetic")
    return ws.opportunities


def _digest(x):
    return hashlib.sha256(json.dumps(x, sort_keys=True, default=str).encode()).hexdigest()


def _manual(opps, reps, calls, min_deal, days, cutoff):
    """Independent re-implementation of the documented arithmetic (does not call the twin)."""
    valid = [o for o in opps if isinstance(o.get("win_probability"), (int, float)) and 0 <= o["win_probability"] <= 1
             and isinstance(o.get("deal_value"), (int, float)) and o["deal_value"] >= 0]
    proxy = lambda o: 0.5 * min(100, o["deal_value"] / 500000 * 100) + 0.5 * min(100, max(0, o["win_probability"] * 100))
    scope = [o for o in valid if o["deal_value"] >= min_deal and proxy(o) >= cutoff]
    reachable = reps * calls * 20 // 4
    scope.sort(key=lambda o: (-o["deal_value"] * o["win_probability"], o["opportunity_id"]))
    covered = scope[:reachable]
    speed = 1.18 if days <= 3 else 1.05 if days <= 7 else 0.85 if days > 14 else 1.0
    focus = 1.08 if min_deal >= 100000 else 1.0
    value = sum(o["deal_value"] * min(0.95, o["win_probability"] * speed * focus) for o in covered)
    return len(scope), len(covered), round(value, 2)


def test_full_pipeline_reference_matches_the_analytics_tool(opps):
    res = twin.simulate(opps, SimulationInput())
    weighted = analytics.get_pipeline_summary(opps, REF)["result"]["weighted_expected_value"]
    assert res.full_pipeline_expected_value == pytest.approx(weighted, abs=0.01)


def test_baseline_and_scenario_use_the_same_model_so_identical_levers_mean_no_change(opps):
    same = SimulationInput(contacts_per_day=20, min_deal_value=50000, sales_reps_count=4, followup_window_days=3, priority_threshold=60)
    res = twin.simulate(opps, same)
    assert res.delta_revenue_percent == 0.0
    assert res.baseline_expected_value == res.scenario_expected_value
    assert res.baseline_summary == res.scenario_summary
    assert res.baseline_params == res.scenario_params


@pytest.mark.parametrize("reps,calls,min_deal,days,cutoff", [
    (2, 12, 100000, 7, 60),     # the brief's own scenario
    (1, 5, 0, 7, 0),            # capacity-starved
    (10, 50, 0, 1, 0),          # everything reachable, fastest response
    (4, 20, 250000, 14, 30),
])
def test_scenario_and_baseline_match_an_independent_calculation(opps, reps, calls, min_deal, days, cutoff):
    res = twin.simulate(opps, SimulationInput(sales_reps_count=reps, contacts_per_day=calls, min_deal_value=min_deal,
                                              followup_window_days=days, priority_threshold=cutoff))
    scope, covered, value = _manual(opps, reps, calls, min_deal, days, cutoff)
    assert (res.opportunities_in_scope, res.opportunities_covered) == (scope, covered)
    assert res.scenario_expected_value == pytest.approx(value, abs=0.01)
    b_scope, b_covered, b_value = _manual(opps, 4, 20, 50000, 3, 60)          # default baseline strategy
    assert (res.baseline_summary["in_scope"], res.baseline_summary["covered"]) == (b_scope, b_covered)
    assert res.baseline_expected_value == pytest.approx(b_value, abs=0.01)


def test_baseline_can_be_overridden(opps):
    inputs = SimulationInput(sales_reps_count=2, contacts_per_day=10, min_deal_value=0, priority_threshold=0)
    default_base = twin.simulate(opps, inputs)
    custom = twin.simulate(opps, inputs.model_copy(update={"baseline": ScenarioParams(sales_reps_count=1, contacts_per_day=5, min_deal_value=0, priority_threshold=0, followup_window_days=7)}))
    assert custom.baseline_params["sales_reps_count"] == 1
    assert custom.baseline_expected_value != default_base.baseline_expected_value
    assert custom.scenario_expected_value == default_base.scenario_expected_value


def test_scenario_does_not_mutate_source_records(opps):
    before = _digest(opps)
    twin.simulate(opps, SimulationInput(sales_reps_count=2, contacts_per_day=12, min_deal_value=100000, followup_window_days=7))
    assert _digest(opps) == before


def test_reducing_capacity_reduces_coverage_and_raises_missed_value(opps):
    base = twin.simulate(opps, SimulationInput(sales_reps_count=4, contacts_per_day=20, min_deal_value=0, priority_threshold=0))
    small = twin.simulate(opps, SimulationInput(sales_reps_count=2, contacts_per_day=12, min_deal_value=0, priority_threshold=0))
    assert small.opportunities_covered < base.opportunities_covered
    assert small.missed_expected_value > base.missed_expected_value
    assert small.opportunities_covered == (2 * 12 * 20) // 4          # capacity / touchpoints per deal
    assert small.capacity_warning and "top" in small.capacity_warning


def test_coverage_takes_highest_expected_value_first(opps):
    res = twin.simulate(opps, SimulationInput(sales_reps_count=1, contacts_per_day=1, min_deal_value=0, priority_threshold=0))
    assert res.opportunities_covered == (1 * 1 * 20) // 4
    top = [r for r in analytics.get_expected_value(opps, REF)["result"] if r["expected_value"] is not None][:5]
    covered_ev = res.scenario_expected_value_no_assumptions
    assert covered_ev == pytest.approx(sum(r["expected_value"] for r in top), abs=0.01)


def test_delta_is_scenario_minus_baseline(opps):
    res = twin.simulate(opps, SimulationInput(min_deal_value=100000))
    expected = round((res.scenario_expected_value - res.baseline_expected_value) / res.baseline_expected_value * 100, 1)
    assert res.delta_revenue_percent == expected


def test_min_deal_value_filters_scope(opps):
    wide = twin.simulate(opps, SimulationInput(min_deal_value=0, priority_threshold=0))
    narrow = twin.simulate(opps, SimulationInput(min_deal_value=400000, priority_threshold=0))
    assert narrow.opportunities_in_scope < wide.opportunities_in_scope


def test_assumptions_are_stated_and_sensitivity_is_computed(opps):
    res = twin.simulate(opps, SimulationInput(followup_window_days=2, min_deal_value=100000))
    assert res.label == "Scenario estimate" and "guaranteed" in res.disclaimer
    assert any("Response window" in a for a in res.assumptions)
    assert res.scenario_expected_value > res.scenario_expected_value_no_assumptions
    assert res.uncertainty_band_percent > 0
    slow = twin.simulate(opps, SimulationInput(followup_window_days=21, min_deal_value=0))
    assert slow.scenario_expected_value < slow.scenario_expected_value_no_assumptions


def test_invalid_records_are_excluded_not_defaulted(opps):
    res = twin.simulate(opps, SimulationInput())
    excluded = len(analytics.get_pipeline_summary(opps, REF)["result"]["excluded_from_expected_value"])
    assert res.excluded_invalid_records == excluded and excluded >= 3
    assert any(f"{excluded} record(s)" in a for a in res.assumptions)


def test_simulation_id_is_deterministic_and_input_sensitive(opps):
    a = twin.simulate(opps, SimulationInput(sales_reps_count=2))
    b = twin.simulate(opps, SimulationInput(sales_reps_count=2))
    c = twin.simulate(opps, SimulationInput(sales_reps_count=3))
    assert a.simulation_id == b.simulation_id != c.simulation_id


def test_empty_dataset_is_handled():
    assert twin.simulate([], SimulationInput()).simulation_id == "SIM-EMPTY"


def test_api_simulation_leaves_the_workspace_snapshot_unchanged():
    h = {"X-Workspace-Id": "twin-api"}
    client.post("/decision-forge/reset-demo", json={"dataset": "synthetic"}, headers=h)
    before = client.get("/decision-forge/dataset", headers=h).json()["snapshot_id"]
    res = client.post("/decision-forge/twin/simulate", json={"sales_reps_count": 2, "contacts_per_day": 12}, headers=h)
    assert res.status_code == 200 and res.json()["opportunities_covered"] > 0
    assert client.get("/decision-forge/dataset", headers=h).json()["snapshot_id"] == before


def test_input_validation_rejects_out_of_range_values():
    assert client.post("/decision-forge/twin/simulate", json={"sales_reps_count": 0}).status_code == 422
    assert client.post("/decision-forge/twin/simulate", json={"contacts_per_day": 10000}).status_code == 422
