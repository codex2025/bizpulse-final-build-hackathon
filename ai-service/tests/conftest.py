import json
import os
import sys

import pytest

AI_SERVICE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if AI_SERVICE_ROOT not in sys.path:
    sys.path.insert(0, AI_SERVICE_ROOT)

from app.decision_forge.decision_engine import DeterministicDecisionEngine  # noqa: E402
from app.decision_forge.external_gateway import build_signal_from_record  # noqa: E402
from app.decision_forge.router import compute_reference_time  # noqa: E402
from app.decision_forge.schema_mapper import load_dataset  # noqa: E402
from app.decision_forge.schemas import PolicyWeights  # noqa: E402

DATA_PATH = os.path.join(AI_SERVICE_ROOT, "data", "real_industrial_crm.json")


@pytest.fixture(scope="session")
def raw_dataset():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture()
def opportunities(raw_dataset):
    opps = load_dataset(raw_dataset)["opportunities"]
    for o in opps:
        signal = build_signal_from_record(o)
        if signal:
            o["external_signal"] = signal
    return opps


@pytest.fixture()
def engine(opportunities):
    eng = DeterministicDecisionEngine()
    eng.rag_service.index_opportunities(opportunities)  # exercise the real retrieval path
    return eng


@pytest.fixture()
def run_all(engine, opportunities):
    """Evaluates every opportunity against the dataset's own snapshot time."""
    def _run(opps=None, policy=None):
        opps = opportunities if opps is None else opps
        ref = compute_reference_time(opps)
        return [
            engine.evaluate_opportunity(o, policy or PolicyWeights(), reference_time=ref, decision_run_id="TEST")
            for o in opps
        ]
    return _run
