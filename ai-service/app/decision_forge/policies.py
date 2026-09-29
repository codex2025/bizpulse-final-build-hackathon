"""
Versioned decision-policy presets. Weights live here (and in the persisted policy the gateway
sends), never inline in the scoring code. Every preset must have factor weights summing to 1.0.
"""
from typing import Dict
from app.decision_forge.schemas import PolicyWeights

PRESETS: Dict[str, PolicyWeights] = {
    # Original five-factor policy: byte-for-byte the previous default.
    "sales_priority_v1": PolicyWeights(policy_version="sales_priority_v1"),
    # Adds a buying-intent factor (deterministic phrase score over rep notes).
    "sales_priority_v1_1": PolicyWeights(
        deal_value_weight=0.25,
        win_probability_weight=0.20,
        engagement_weight=0.15,
        recency_weight=0.15,
        intent_external_weight=0.10,
        buying_intent_weight=0.15,
        policy_version="sales_priority_v1_1",
    ),
}
DEFAULT_PRESET = "sales_priority_v1"


def factor_weight_sum(p: PolicyWeights) -> float:
    return round(
        p.deal_value_weight + p.win_probability_weight + p.engagement_weight
        + p.recency_weight + p.intent_external_weight + p.buying_intent_weight, 6)


def get_preset(name: str) -> PolicyWeights:
    if name not in PRESETS:
        raise KeyError(name)
    return PRESETS[name].model_copy(deep=True)
