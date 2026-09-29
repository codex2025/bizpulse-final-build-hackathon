from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class CanonicalOpportunity(BaseModel):
    opportunity_id: str
    company_name: str
    contact_name: Optional[str] = "N/A"
    contact_email: Optional[str] = None
    industry: Optional[str] = "Industrial & Commercial"
    location: Optional[str] = "United States"
    deal_value: float = Field(default=0.0, description="Deal size in currency")
    stage: str = "Qualified Lead"
    win_probability: float = Field(default=0.5, ge=0.0, le=1.0)
    engagement_score: float = Field(default=50.0, ge=0.0, le=100.0)
    last_contact_date: Optional[str] = None
    owner: Optional[str] = "Sales Team"
    sales_notes: List[str] = []
    external_signal: Optional[Dict[str, Any]] = None

class PolicyWeights(BaseModel):
    deal_value_weight: float = 0.25
    win_probability_weight: float = 0.20
    engagement_weight: float = 0.20
    recency_weight: float = 0.15
    intent_external_weight: float = 0.20
    # Optional factor: deterministic buying-intent score from rep notes. Weight 0.0 keeps the
    # original 5-factor policy byte-for-byte; presets that use it must still sum to 1.0.
    buying_intent_weight: float = 0.0
    stale_days_threshold: int = 30
    high_priority_threshold: float = 75.0
    medium_priority_threshold: float = 55.0
    policy_version: str = "v1"
    # Points subtracted from the priority score per detected data-quality issue type.
    # Zero for clean records, so clean datasets score exactly as before.
    quality_penalties: Dict[str, float] = {
        "MISSING_PROBABILITY": 8.0,
        "CONFLICTING_PROBABILITY": 10.0,
        "INVALID_DEAL_VALUE": 10.0,
        "DUPLICATE": 5.0,
    }
    # Below this confidence the recommendation is flagged "human review required".
    review_confidence_threshold: float = 0.5

class DecisionFactor(BaseModel):
    name: str
    raw_value: Any
    score: float
    weight: float
    weighted_contribution: float
    description: str

class RecommendationItem(BaseModel):
    recommendation_id: str
    decision_run_id: str = ""
    opportunity_id: str
    company_name: str
    contact_name: str
    contact_email: Optional[str] = None
    industry: str
    deal_value: float
    stage: str
    win_probability: float
    priority_score: float
    decision_class: str  # IMMEDIATE_ACTION | PROCEED_WITH_QUALIFICATION | NURTURE_MONITOR
    badge_color: str    # emerald | amber | slate
    factors: List[DecisionFactor]
    evidence_pack: Dict[str, Any]
    suggested_action: str
    action_email_draft: Optional[str] = None
    stale_data_warning: Optional[str] = None
    external_context_available: bool = False
    external_context_fetched: bool = False
    confidence: float = 0.9
    review_required: bool = False
    warnings: List[str] = []
    data_quality_issues: List[Dict[str, Any]] = []

class DecisionRunResponse(BaseModel):
    decision_run_id: str
    policy_version: str
    data_snapshot: str = ""
    records_analyzed: int
    recommendations_count: int
    pipeline_total_value: float
    weighted_pipeline_value: float
    high_priority_count: int
    stale_warning_count: int
    recommendations: List[RecommendationItem]
    generated_at: str
    dataset_key: str = ""
    snapshot_id: str = ""
    policy: Dict[str, Any] = {}

class ScenarioParams(BaseModel):
    """One set of Decision Twin levers. The default is the baseline strategy: 4 reps, 20 contacts a
    day each, $50,000 minimum deal, 3-day response, priority cutoff 60 (the tab's opening levers)."""
    contacts_per_day: int = Field(default=20, ge=1, le=100)
    min_deal_value: float = Field(default=50000, ge=0)
    sales_reps_count: int = Field(default=4, ge=1, le=20)
    followup_window_days: int = Field(default=3, ge=1, le=30)
    priority_threshold: float = Field(default=60.0, ge=0, le=100)

class SimulationInput(BaseModel):
    contacts_per_day: int = Field(default=15, ge=1, le=100)
    min_deal_value: float = Field(default=50000, ge=0)
    sales_reps_count: int = Field(default=3, ge=1, le=20)
    followup_window_days: int = Field(default=7, ge=1, le=30)
    priority_threshold: float = Field(default=60.0, ge=0, le=100)
    # Optional override of the baseline strategy the scenario is compared against.
    baseline: Optional[ScenarioParams] = None

class ScenarioComparison(BaseModel):
    parameter: str
    baseline: Any
    scenario: Any
    delta: Any
    unit: str
    impact: str  # positive | negative | neutral

class SimulationResponse(BaseModel):
    simulation_id: str
    baseline_expected_value: float
    scenario_expected_value: float
    delta_revenue_percent: float
    rep_capacity_utilization_percent: float
    capacity_warning: Optional[str] = None
    expected_closed_deals: int
    comparisons: List[ScenarioComparison]
    uncertainty_band_percent: float = 12.0
    # Transparent scenario outputs (all deterministic; see decision_twin.py)
    opportunities_total: int = 0
    opportunities_in_scope: int = 0
    opportunities_covered: int = 0
    opportunities_missed: int = 0
    missed_expected_value: float = 0.0
    excluded_invalid_records: int = 0
    scenario_expected_value_no_assumptions: float = 0.0
    baseline_params: Dict[str, Any] = {}
    scenario_params: Dict[str, Any] = {}
    baseline_summary: Dict[str, Any] = {}
    scenario_summary: Dict[str, Any] = {}
    full_pipeline_expected_value: float = 0.0
    assumptions: List[str] = []
    label: str = "Scenario estimate"
    disclaimer: str = "Scenario estimates computed from the recorded win probabilities, team capacity and the stated assumptions; they are not forecasts or guaranteed results."
