"""
Decision Twin Scenario Simulator.
Empowers decision-makers to test "What-If" strategic hypotheses before approving actions.
Simulates alternative outreach volumes, rep capacities, and deal thresholds against historical conversion curves.
"""
from typing import List, Dict, Any
from app.decision_forge.schemas import SimulationInput, SimulationResponse, ScenarioComparison

# Baseline assumptions the scenario is compared against (matches SimulationInput defaults).
BASELINE_CONTACTS_PER_DAY = 15
BASELINE_SALES_REPS = 3
WORKING_DAYS_PER_MONTH = 20
TOUCHPOINTS_PER_DEAL = 4


def _composite_priority_proxy(o: Dict[str, Any]) -> float:
    """A lightweight, twin-local stand-in for the full deterministic priority score.
    The Decision Twin intentionally does NOT read the configured policy weights (that
    would blur "simulate a strategy" with "change the scoring policy" -- see Decision
    Policy instead); it uses a simple deal-size/win-probability blend purely to let the
    "Scenario Priority Cutoff" lever filter opportunities in a visible, explainable way.
    """
    deal_val = float(o.get("deal_value", 0))
    win_prob = float(o.get("win_probability", 0.5))
    deal_score = min(100.0, (deal_val / 500000.0) * 100.0)
    prob_score = min(100.0, max(0.0, win_prob * 100.0))
    return (deal_score * 0.5) + (prob_score * 0.5)


class DecisionTwinSimulator:
    def simulate(self, opportunities: List[Dict[str, Any]], user_inputs: SimulationInput) -> SimulationResponse:
        total_opps = len(opportunities)
        if total_opps == 0:
            return SimulationResponse(
                simulation_id="SIM-EMPTY",
                baseline_expected_value=0.0,
                scenario_expected_value=0.0,
                delta_revenue_percent=0.0,
                rep_capacity_utilization_percent=0.0,
                expected_closed_deals=0,
                comparisons=[]
            )

        # Baseline Calculation (status quo: every opportunity in scope, no filters applied)
        baseline_expected = sum(
            float(o.get("deal_value", 0)) * float(o.get("win_probability", 0.5))
            for o in opportunities
        )
        baseline_capacity = BASELINE_SALES_REPS * BASELINE_CONTACTS_PER_DAY * WORKING_DAYS_PER_MONTH
        baseline_demand = total_opps * TOUCHPOINTS_PER_DEAL
        baseline_utilization = round((baseline_demand / max(1, baseline_capacity)) * 100.0, 1)

        # Scenario Filtering: minimum deal value AND the priority cutoff lever both narrow scope
        filtered_opps = [
            o for o in opportunities
            if float(o.get("deal_value", 0)) >= user_inputs.min_deal_value
            and _composite_priority_proxy(o) >= user_inputs.priority_threshold
        ]

        # Calculate Rep Capacity & Workload
        monthly_rep_capacity = user_inputs.sales_reps_count * user_inputs.contacts_per_day * WORKING_DAYS_PER_MONTH
        total_demand = len(filtered_opps) * TOUCHPOINTS_PER_DEAL
        utilization = round((total_demand / max(1, monthly_rep_capacity)) * 100.0, 1)

        capacity_warning = None
        if utilization > 115.0:
            capacity_warning = f"Warning: Workload ({utilization}%) exceeds sales team capacity. Rep burnout risk may decrease win rates by 15%."
        elif utilization < 45.0:
            capacity_warning = f"Notice: Sales capacity is underutilized ({utilization}%). Consider lowering the minimum deal value or priority cutoff to capture more volume."

        # Compute Conversion Lift based on Followup Speed & Focus
        speed_factor = 1.0
        if user_inputs.followup_window_days <= 3:
            speed_factor = 1.18  # +18% lift for rapid response
        elif user_inputs.followup_window_days <= 7:
            speed_factor = 1.05
        elif user_inputs.followup_window_days > 14:
            speed_factor = 0.85  # -15% decay for slow response

        focus_factor = 1.08 if user_inputs.min_deal_value >= 100000 else 1.0
        burnout_penalty = 0.85 if utilization > 120.0 else 1.0

        scenario_expected = sum(
            float(o.get("deal_value", 0)) * min(0.95, float(o.get("win_probability", 0.5)) * speed_factor * focus_factor * burnout_penalty)
            for o in filtered_opps
        )

        delta_percent = 0.0
        if baseline_expected > 0:
            delta_percent = round(((scenario_expected - baseline_expected) / baseline_expected) * 100.0, 1)

        expected_deals = round(sum(
            min(0.95, float(o.get("win_probability", 0.5)) * speed_factor * focus_factor * burnout_penalty)
            for o in filtered_opps
        ))
        baseline_deals = round(sum(float(o.get("win_probability", 0.5)) for o in opportunities))

        comparisons = [
            ScenarioComparison(
                parameter="Projected Pipeline Velocity (30-day)",
                baseline=f"${baseline_expected:,.0f}",
                scenario=f"${scenario_expected:,.0f}",
                delta=f"{'+' if delta_percent >= 0 else ''}{delta_percent}%",
                unit="USD",
                impact="positive" if delta_percent >= 0 else "negative"
            ),
            ScenarioComparison(
                parameter="Opportunities In Scope",
                baseline=total_opps,
                scenario=len(filtered_opps),
                delta=f"{len(filtered_opps) - total_opps:+d}",
                unit="Opportunities",
                impact="neutral"
            ),
            ScenarioComparison(
                parameter="Sales Rep Capacity Utilization",
                baseline=f"{baseline_utilization}%",
                scenario=f"{utilization}%",
                delta=f"{utilization - baseline_utilization:+.1f}%",
                unit="Percentage",
                impact="positive" if 60 <= utilization <= 100 else "negative" if utilization > 110 else "neutral"
            ),
            ScenarioComparison(
                parameter="Projected Closed Deals",
                baseline=baseline_deals,
                scenario=expected_deals,
                delta=f"{expected_deals - baseline_deals:+d}",
                unit="Deals",
                impact="positive" if expected_deals >= baseline_deals else "negative"
            ),
            ScenarioComparison(
                parameter="Average Deal Size in Focus",
                baseline=f"${(sum(float(o.get('deal_value', 0)) for o in opportunities) / max(1, total_opps)):,.0f}",
                scenario=f"${(sum(float(o.get('deal_value', 0)) for o in filtered_opps) / max(1, len(filtered_opps))):,.0f}" if filtered_opps else "$0",
                delta="Targeted",
                unit="USD",
                impact="positive"
            )
        ]

        return SimulationResponse(
            simulation_id=f"SIM-{user_inputs.contacts_per_day}-{int(user_inputs.min_deal_value)}-{int(user_inputs.priority_threshold)}",
            baseline_expected_value=round(baseline_expected, 2),
            scenario_expected_value=round(scenario_expected, 2),
            delta_revenue_percent=delta_percent,
            rep_capacity_utilization_percent=utilization,
            capacity_warning=capacity_warning,
            expected_closed_deals=expected_deals,
            comparisons=comparisons,
            uncertainty_band_percent=12.0
        )
