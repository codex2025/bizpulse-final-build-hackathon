"""
Decision Twin Scenario Simulator.

Lets a decision-maker test "what-if" strategies before acting. The workflow is:
  BASELINE -> COPY SCENARIO -> CHANGE PARAMETERS -> RECALCULATE -> COMPARE.

The baseline and the scenario are two parameter sets run through the SAME model on a COPY of the
workspace snapshot (source records are never modified), so the comparison is like for like. The
baseline defaults to the current strategy in the tab's opening levers (4 reps, 20 contacts/day,
$50,000 minimum deal, 3-day response, priority cutoff 60) and can be overridden.

Transparent arithmetic, per parameter set:

  scope             valid opportunities with deal_value >= minimum and twin priority proxy >= cutoff
  capacity          reps x contacts/day x working days           (touchpoints per month)
  reachable deals   floor(capacity / touchpoints per deal)
  coverage          the highest-expected-value in-scope deals, up to the reachable count
  expected value    sum(deal_value x adjusted probability) over covered deals
  workload          in-scope deals x touchpoints per deal / capacity
  missed            every valid opportunity NOT covered (filtered out or beyond capacity)
  delta             scenario metric - baseline metric

Records with a missing/invalid probability or deal value are excluded from every figure and counted.

The response-time and focus multipliers are ASSUMPTIONS, not measurements. They are returned in
`assumptions`, and `scenario_expected_value_no_assumptions` shows the covered value without them
so the reader can see how much of the estimate rests on them. Output is a "scenario estimate",
never a forecast or a guaranteed result.
"""
import hashlib
from typing import List, Dict, Any
from app.decision_forge import analytics
from app.decision_forge.schemas import (
    ScenarioComparison,
    ScenarioParams,
    SimulationInput,
    SimulationResponse,
)

WORKING_DAYS_PER_MONTH = 20
TOUCHPOINTS_PER_DEAL = 4

# Scenario assumptions (stated in every response).
FAST_RESPONSE_DAYS, FAST_RESPONSE_FACTOR = 3, 1.18
STANDARD_RESPONSE_DAYS, STANDARD_RESPONSE_FACTOR = 7, 1.05
SLOW_RESPONSE_DAYS, SLOW_RESPONSE_FACTOR = 14, 0.85
FOCUS_MIN_DEAL, FOCUS_FACTOR = 100000, 1.08
PROBABILITY_CAP = 0.95
OVERLOAD_UTILIZATION = 115.0
UNDERUSE_UTILIZATION = 45.0


def _composite_priority_proxy(o: Dict[str, Any]) -> float:
    """A twin-local stand-in for the full priority score. The Twin intentionally does NOT read the
    configured policy weights (that would blur "simulate a strategy" with "change the scoring
    policy"); a simple deal-size/win-probability blend lets the priority-cutoff lever filter
    opportunities in a visible, explainable way."""
    deal_val = float(o.get("deal_value") or 0)
    win_prob = float(o.get("win_probability") if o.get("win_probability") is not None else 0.5)
    deal_score = min(100.0, (deal_val / 500000.0) * 100.0)
    prob_score = min(100.0, max(0.0, win_prob * 100.0))
    return (deal_score * 0.5) + (prob_score * 0.5)


def _speed_factor(days: int) -> float:
    if days <= FAST_RESPONSE_DAYS:
        return FAST_RESPONSE_FACTOR
    if days <= STANDARD_RESPONSE_DAYS:
        return STANDARD_RESPONSE_FACTOR
    if days > SLOW_RESPONSE_DAYS:
        return SLOW_RESPONSE_FACTOR
    return 1.0


def _evaluate(valid: List[Dict[str, Any]], ev: Dict[int, float], p: ScenarioParams) -> Dict[str, Any]:
    """Runs the model for one parameter set."""
    in_scope = [
        o for o in valid
        if float(o.get("deal_value") or 0) >= p.min_deal_value and _composite_priority_proxy(o) >= p.priority_threshold
    ]
    capacity = p.sales_reps_count * p.contacts_per_day * WORKING_DAYS_PER_MONTH
    reachable = capacity // TOUCHPOINTS_PER_DEAL
    ranked = sorted(in_scope, key=lambda o: (-ev[id(o)], str(o.get("opportunity_id", ""))))
    covered = ranked[:reachable]
    covered_ids = {id(o) for o in covered}
    missed = [o for o in valid if id(o) not in covered_ids]

    speed = _speed_factor(p.followup_window_days)
    focus = FOCUS_FACTOR if p.min_deal_value >= FOCUS_MIN_DEAL else 1.0

    def adjusted(o: Dict[str, Any]) -> float:
        return min(PROBABILITY_CAP, float(o["win_probability"]) * speed * focus)

    expected = sum(float(o["deal_value"]) * adjusted(o) for o in covered)
    return {
        "in_scope": len(in_scope),
        "covered": len(covered),
        "missed": len(missed),
        "missed_expected_value": round(sum(ev[id(o)] for o in missed), 2),
        "capacity_touchpoints": capacity,
        "reachable_deals": reachable,
        "utilization_percent": round((len(in_scope) * TOUCHPOINTS_PER_DEAL / max(1, capacity)) * 100.0, 1),
        "expected_value": round(expected, 2),
        "expected_value_no_assumptions": round(sum(ev[id(o)] for o in covered), 2),
        "expected_deals": round(sum(adjusted(o) for o in covered)),
        "avg_deal_size": round(sum(float(o.get("deal_value") or 0) for o in covered) / max(1, len(covered)), 2) if covered else 0.0,
        "speed_factor": speed,
        "focus_factor": focus,
    }


def _money(n: float) -> str:
    return f"${n:,.0f}"


def _pct_delta(new: float, old: float) -> float:
    return round(((new - old) / old) * 100.0, 1) if old > 0 else 0.0


class DecisionTwinSimulator:
    def simulate(self, opportunities: List[Dict[str, Any]], user_inputs: SimulationInput) -> SimulationResponse:
        snapshot = [dict(o) for o in opportunities]  # scenario works on a copy; sources are never touched
        total_opps = len(snapshot)
        if total_opps == 0:
            return SimulationResponse(
                simulation_id="SIM-EMPTY", baseline_expected_value=0.0, scenario_expected_value=0.0,
                delta_revenue_percent=0.0, rep_capacity_utilization_percent=0.0,
                expected_closed_deals=0, comparisons=[],
            )

        ev = {id(o): analytics.expected_value(o) for o in snapshot}
        valid = [o for o in snapshot if ev[id(o)] is not None]
        invalid_count = total_opps - len(valid)

        scenario_p = ScenarioParams(
            contacts_per_day=user_inputs.contacts_per_day, min_deal_value=user_inputs.min_deal_value,
            sales_reps_count=user_inputs.sales_reps_count, followup_window_days=user_inputs.followup_window_days,
            priority_threshold=user_inputs.priority_threshold,
        )
        baseline_p = user_inputs.baseline or ScenarioParams()

        base = _evaluate(valid, ev, baseline_p)
        scen = _evaluate(valid, ev, scenario_p)
        full_pipeline_ev = round(sum(ev[id(o)] for o in valid), 2)

        utilization = scen["utilization_percent"]
        capacity_warning = None
        if utilization > OVERLOAD_UTILIZATION:
            capacity_warning = (f"Warning: workload ({utilization}%) exceeds team capacity; only the top {scen['covered']} of "
                                f"{scen['in_scope']} in-scope opportunities (by expected value) can be reached.")
        elif utilization < UNDERUSE_UTILIZATION:
            capacity_warning = (f"Notice: sales capacity is underutilized ({utilization}%). Consider lowering the minimum "
                                "deal value or priority cutoff to capture more volume.")

        delta_percent = _pct_delta(scen["expected_value"], base["expected_value"])
        sensitivity = 0.0
        if scen["expected_value_no_assumptions"] > 0:
            sensitivity = round(abs(scen["expected_value"] - scen["expected_value_no_assumptions"])
                                / scen["expected_value_no_assumptions"] * 100.0, 1)

        def row(parameter: str, b: float, s: float, unit: str, better_when_higher: bool = True, fmt=str, delta_fmt=None) -> ScenarioComparison:
            d = s - b
            impact = "neutral"
            if d != 0:
                impact = "positive" if (d > 0) == better_when_higher else "negative"
            return ScenarioComparison(parameter=parameter, baseline=fmt(b), scenario=fmt(s),
                                      delta=delta_fmt(d) if delta_fmt else f"{d:+,.0f}", unit=unit, impact=impact)

        signed_money = lambda d: f"{'+' if d >= 0 else '-'}${abs(d):,.0f}"
        comparisons = [
            row("Expected Value of Covered Opportunities", base["expected_value"], scen["expected_value"], "USD",
                fmt=_money, delta_fmt=lambda d: f"{'+' if d >= 0 else '-'}{abs(delta_percent)}%"),
            row("Opportunities In Scope", base["in_scope"], scen["in_scope"], "Opportunities"),
            row("Opportunities Covered (within capacity)", base["covered"], scen["covered"], "Opportunities"),
            row("Sales Rep Capacity Utilization", base["utilization_percent"], scen["utilization_percent"], "Percentage",
                better_when_higher=False, fmt=lambda v: f"{v}%", delta_fmt=lambda d: f"{d:+.1f}%"),
            row("Expected Closed Deals (probability-weighted)", base["expected_deals"], scen["expected_deals"], "Deals"),
            row("Expected Value Not Covered", base["missed_expected_value"], scen["missed_expected_value"], "USD",
                better_when_higher=False, fmt=_money, delta_fmt=signed_money),
            row("Average Deal Size in Focus", base["avg_deal_size"], scen["avg_deal_size"], "USD", fmt=_money, delta_fmt=signed_money),
        ]

        assumptions = [
            f"Response window multiplies win probability (assumed: <= {FAST_RESPONSE_DAYS}d x{FAST_RESPONSE_FACTOR}, "
            f"<= {STANDARD_RESPONSE_DAYS}d x{STANDARD_RESPONSE_FACTOR}, > {SLOW_RESPONSE_DAYS}d x{SLOW_RESPONSE_FACTOR}, otherwise x1.0). "
            f"Baseline {baseline_p.followup_window_days}d = x{base['speed_factor']}; scenario {scenario_p.followup_window_days}d = x{scen['speed_factor']}.",
            f"Minimum deal value >= ${FOCUS_MIN_DEAL:,} multiplies win probability by {FOCUS_FACTOR} (assumed focus benefit). "
            f"Baseline x{base['focus_factor']}; scenario x{scen['focus_factor']}.",
            f"Each deal needs {TOUCHPOINTS_PER_DEAL} touchpoints; a rep works {WORKING_DAYS_PER_MONTH} days/month. "
            f"Baseline capacity {base['capacity_touchpoints']:,} touchpoints ({baseline_p.sales_reps_count} reps x {baseline_p.contacts_per_day}/day); "
            f"scenario {scen['capacity_touchpoints']:,} ({scenario_p.sales_reps_count} x {scenario_p.contacts_per_day}/day).",
            f"Adjusted probability is capped at {PROBABILITY_CAP}.",
            f"{invalid_count} record(s) with a missing/invalid probability or deal value are excluded from every figure.",
        ]
        digest = hashlib.sha256((user_inputs.model_dump_json() + "|" + baseline_p.model_dump_json() + "|"
                                 + ",".join(sorted(str(o.get('opportunity_id', '')) for o in snapshot))).encode()).hexdigest()[:10]

        return SimulationResponse(
            simulation_id=f"SIM-{digest}",
            baseline_expected_value=base["expected_value"],
            scenario_expected_value=scen["expected_value"],
            delta_revenue_percent=delta_percent,
            rep_capacity_utilization_percent=utilization,
            capacity_warning=capacity_warning,
            expected_closed_deals=scen["expected_deals"],
            comparisons=comparisons,
            uncertainty_band_percent=sensitivity,
            opportunities_total=total_opps,
            opportunities_in_scope=scen["in_scope"],
            opportunities_covered=scen["covered"],
            opportunities_missed=scen["missed"],
            missed_expected_value=scen["missed_expected_value"],
            excluded_invalid_records=invalid_count,
            scenario_expected_value_no_assumptions=scen["expected_value_no_assumptions"],
            baseline_params=baseline_p.model_dump(),
            scenario_params=scenario_p.model_dump(),
            baseline_summary=base,
            scenario_summary=scen,
            full_pipeline_expected_value=full_pipeline_ev,
            assumptions=assumptions,
        )
