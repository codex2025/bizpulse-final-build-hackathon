"""
Per-workspace state and registry.

A workspace owns its dataset, decision engine (and therefore its own RAG index and
external-context fetch state). Nothing in this module is shared between workspaces, which is
what prevents one tenant's reset / upload / fetch from changing another tenant's view, and what
guarantees a RAG query can never return another tenant's notes.
"""
import hashlib
import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.decision_forge import analytics
from app.decision_forge.decision_engine import DeterministicDecisionEngine
from app.decision_forge.external_gateway import build_signal_from_record
from app.decision_forge.quality_engine import DataQualityEngine, mark_duplicates, parse_date
from app.decision_forge.schema_mapper import load_dataset
from app.decision_forge.schemas import DecisionRunResponse, PolicyWeights
from app.decision_forge import synthetic

WORKSPACE_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")
AI_SERVICE_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATASET_FILES = {"real": "real_industrial_crm.json", "legacy": "demo_industrial_crm.json"}
DATASET_KEYS = ("real", "synthetic", "legacy", "custom")
DEFAULT_DATASET = "real"
MAX_WORKSPACES = 500  # bounds memory: each workspace holds its own dataset and RAG index


class InvalidWorkspaceId(ValueError):
    pass


def compute_reference_time(opportunities: List[Dict[str, Any]]) -> datetime:
    """The dataset's own snapshot time: the most recent last_contact_date, falling back to the
    wall clock only when the data carries no usable dates. Anchoring recency/staleness to this
    (not datetime.now()) makes the same snapshot always reproduce the same scores."""
    latest: Optional[datetime] = None
    for opp in opportunities:
        dt = parse_date(opp.get("last_contact_date"))
        if dt is not None and (latest is None or dt > latest):
            latest = dt
    return latest or datetime.now(timezone.utc)


def snapshot_id_for(opportunities: List[Dict[str, Any]]) -> str:
    canon = json.dumps(opportunities, sort_keys=True, default=str, separators=(",", ":"))
    return "snap-" + hashlib.sha256(canon.encode("utf-8")).hexdigest()[:12]


class WorkspaceState:
    def __init__(self, workspace_id: str):
        self.workspace_id = workspace_id
        self.engine = DeterministicDecisionEngine()
        self.quality = DataQualityEngine()
        self.dataset_key = ""
        self.meta: Optional[Dict[str, Any]] = None
        self.opportunities: List[Dict[str, Any]] = []
        self.activities: List[Dict[str, Any]] = []
        self.customers: List[Dict[str, Any]] = []
        self.reps: List[Dict[str, Any]] = []
        self.snapshot_id = ""
        self.last_run_id: Optional[str] = None
        self.last_run: Optional[DecisionRunResponse] = None
        self.lock = threading.RLock()

    # ---- loading -------------------------------------------------------------------------
    def load(self, dataset_key: str = DEFAULT_DATASET) -> None:
        if dataset_key not in ("real", "synthetic", "legacy"):
            raise ValueError(f"Unknown dataset '{dataset_key}'")
        with self.lock:
            if dataset_key == "synthetic":
                gen = synthetic.generate()
                self._activate(gen["opportunities"], gen["meta"], dataset_key,
                               activities=gen["activities"], customers=gen["customers"], reps=gen["reps"])
                return
            path = os.path.join(AI_SERVICE_ROOT, "data", DATASET_FILES[dataset_key])
            with open(path, "r", encoding="utf-8") as f:
                loaded = load_dataset(json.load(f))
            self._activate(loaded["opportunities"], loaded["meta"], dataset_key)

    def load_default(self) -> None:
        """Real dataset, falling back to the legacy flat one if the real file is absent."""
        try:
            self.load("real")
        except FileNotFoundError:
            self.load("legacy")

    def apply_records(self, records: List[Dict[str, Any]]) -> None:
        with self.lock:
            loaded = load_dataset(records)
            self._activate(loaded["opportunities"], loaded["meta"], "custom")

    def _activate(self, opportunities, meta, dataset_key, activities=None, customers=None, reps=None) -> None:
        for opp in opportunities:
            if not opp.get("external_signal"):
                signal = build_signal_from_record(opp)
                if signal:
                    opp["external_signal"] = signal
        mark_duplicates(opportunities)
        self.opportunities = opportunities
        self.meta = meta
        self.dataset_key = dataset_key
        self.activities = activities or []
        self.customers = customers or []
        self.reps = reps or []
        self.snapshot_id = snapshot_id_for(opportunities)
        self.engine.rag_service.reset()
        self.engine.rag_service.index_opportunities(opportunities)
        self.engine.ext_gateway.reset()
        self.last_run_id = None
        self.last_run = None

    def ensure_loaded(self) -> None:
        if not self.opportunities:
            self.load_default()

    # ---- derived -------------------------------------------------------------------------
    @property
    def reference_time(self) -> datetime:
        return compute_reference_time(self.opportunities)

    def quality_report(self, stale_days: int = 30) -> Dict[str, Any]:
        self.ensure_loaded()
        return self.quality.evaluate(self.opportunities, stale_days_threshold=stale_days, reference_time=self.reference_time)

    # ---- decision run --------------------------------------------------------------------
    def run(self, policy: Optional[PolicyWeights] = None) -> DecisionRunResponse:
        with self.lock:
            self.ensure_loaded()
            pol = policy or PolicyWeights()
            ref = self.reference_time
            run_id = f"DR-{uuid.uuid4().hex[:6].upper()}"
            self.last_run_id = run_id

            recs = [self.engine.evaluate_opportunity(o, pol, reference_time=ref, decision_run_id=run_id)
                    for o in self.opportunities]
            # Stable order: score desc, then id, so equal scores never reorder between runs.
            recs.sort(key=lambda r: (-r.priority_score, r.opportunity_id))

            # Totals come from the analytics tools so every view agrees (no number drift).
            summary = analytics.get_pipeline_summary(self.opportunities, ref, self.dataset_key)["result"]
            resp = DecisionRunResponse(
                decision_run_id=run_id,
                policy_version=pol.policy_version,
                data_snapshot=ref.isoformat(),
                records_analyzed=len(self.opportunities),
                recommendations_count=len(recs),
                pipeline_total_value=summary["total_pipeline_value"],
                weighted_pipeline_value=summary["weighted_expected_value"],
                high_priority_count=sum(1 for r in recs if r.decision_class == "IMMEDIATE_ACTION"),
                stale_warning_count=sum(1 for r in recs if r.stale_data_warning),
                recommendations=recs,
                generated_at=datetime.now(timezone.utc).isoformat(),
                dataset_key=self.dataset_key,
                snapshot_id=self.snapshot_id,
                policy=pol.model_dump(),
            )
            self.last_run = resp
            return resp


class WorkspaceRegistry:
    def __init__(self) -> None:
        self._workspaces: Dict[str, WorkspaceState] = {}
        self._lock = threading.Lock()

    def get(self, workspace_id: Optional[str]) -> WorkspaceState:
        wid = (workspace_id or "default").strip() or "default"
        if not WORKSPACE_ID_RE.match(wid):
            raise InvalidWorkspaceId("Workspace id must be 1-64 characters: letters, digits, '-' or '_'.")
        with self._lock:
            ws = self._workspaces.get(wid)
            if ws is None:
                if len(self._workspaces) >= MAX_WORKSPACES:
                    raise InvalidWorkspaceId("Too many active workspaces; try again later.")
                ws = WorkspaceState(wid)
                self._workspaces[wid] = ws
        ws.ensure_loaded()
        return ws

    def exists(self, workspace_id: str) -> bool:
        return workspace_id in self._workspaces

    def clear(self) -> None:
        with self._lock:
            self._workspaces.clear()


registry = WorkspaceRegistry()
