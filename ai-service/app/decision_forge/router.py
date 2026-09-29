"""
FastAPI Router for DecisionForge AI.
Handles CSV/XLSX Ingestion, Schema Mapping, Quality Scanning,
Deterministic Priority Decision Runs, Decision Twin Simulations, and Evidence Retrieval.
"""
import io
import csv
import json
import uuid
import os
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body
from app.decision_forge.schemas import (
    CanonicalOpportunity,
    PolicyWeights,
    DecisionRunResponse,
    SimulationInput,
    SimulationResponse
)
from app.decision_forge.schema_mapper import SchemaMapper
from app.decision_forge.quality_engine import DataQualityEngine
from app.decision_forge.decision_engine import DeterministicDecisionEngine
from app.decision_forge.decision_twin import DecisionTwinSimulator
from app.decision_forge.rag_service import NotesRagService

router = APIRouter()
mapper = SchemaMapper()
quality_engine = DataQualityEngine()
decision_engine = DeterministicDecisionEngine()
simulator = DecisionTwinSimulator()
rag_service = NotesRagService()

# In-memory store for active session dataset (fallback if no external DB provided)
ACTIVE_OPPORTUNITIES: List[Dict[str, Any]] = []
# The last decision run's ranked recommendations, keyed by decision_run_id, so a single
# recommendation can be looked up (e.g. to fetch external context for it) after the run.
LAST_RUN_ID: Optional[str] = None


def compute_reference_time(opportunities: List[Dict[str, Any]]) -> datetime:
    """The dataset's own snapshot time: the most recent last_contact_date in the active
    dataset, falling back to wall-clock only when the data carries no usable dates.
    Anchoring recency/staleness math to this instead of datetime.now() means re-running
    the same snapshot always reproduces the same scores (plan AC-002 / AC-010), rather
    than drifting as real-world days pass.
    """
    latest: Optional[datetime] = None
    for opp in opportunities:
        raw = opp.get("last_contact_date")
        if not raw:
            continue
        try:
            dt_part = raw.replace("Z", "+00:00")
            dt = (
                datetime.strptime(dt_part, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if len(dt_part) == 10
                else datetime.fromisoformat(dt_part)
            )
        except Exception:
            continue
        if latest is None or dt > latest:
            latest = dt
    return latest or datetime.now(timezone.utc)


def load_default_demo_dataset():
    global ACTIVE_OPPORTUNITIES, LAST_RUN_ID
    ai_service_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    # Bundled inside ai-service/data so it ships with the ai-service deployment on
    # its own (Vercel/Render deploy just this directory, not the repo root's data/).
    # Fall back to the repo-root copy for anyone running from a full local checkout
    # before that copy existed.
    candidates = [
        os.path.join(ai_service_root, "data", "demo_industrial_crm.json"),
        os.path.join(ai_service_root, "..", "data", "demo_industrial_crm.json"),
    ]
    data_path = next((p for p in candidates if os.path.exists(p)), candidates[0])
    if os.path.exists(data_path):
        try:
            with open(data_path, "r", encoding="utf-8") as f:
                ACTIVE_OPPORTUNITIES = json.load(f)
                rag_service.index_opportunities(ACTIVE_OPPORTUNITIES)
        except Exception as e:
            print(f"[DecisionForge] Error loading demo dataset: {e}")
    decision_engine.ext_gateway.reset()
    LAST_RUN_ID = None

# Pre-load on startup
load_default_demo_dataset()

@router.post("/reset-demo")
async def reset_demo_data():
    """Resets the dataset to the clean, verified industrial sales benchmark, and clears
    any "fetched" external-context state so a fresh demo run starts from a known state
    (plan AC-010)."""
    load_default_demo_dataset()
    return {
        "status": "success",
        "message": f"Loaded {len(ACTIVE_OPPORTUNITIES)} industrial B2B sales opportunities into DecisionForge memory.",
        "count": len(ACTIVE_OPPORTUNITIES)
    }

@router.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...)):
    """Accepts CSV or tabular file, detects columns, returns suggested mappings and data quality.
    This does NOT activate the dataset -- call /ingest/apply-mapping with the reviewed
    records to make them the active dataset (plan FR-004: user reviews/edits before use)."""
    content = await file.read()
    filename = file.filename or "data.csv"

    try:
        text = content.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file appears to be empty.")

    columns = list(rows[0].keys())
    mapping_result = mapper.map_columns(columns)

    # Normalize rows
    normalized_records = [
        mapper.normalize_record(r, mapping_result["mapped_columns"])
        for r in rows
    ]

    # Assign opportunity IDs to any record missing one so it can be activated downstream
    for idx, rec in enumerate(normalized_records):
        if not rec.get("opportunity_id"):
            rec["opportunity_id"] = f"UPL-{uuid.uuid4().hex[:6].upper()}"
        rec.setdefault("sales_notes", [])

    quality_report = quality_engine.evaluate(normalized_records)

    return {
        "filename": filename,
        "total_rows": len(rows),
        "detected_columns": columns,
        "mapping_proposal": mapping_result,
        "normalized_records": normalized_records,
        "sample_preview": normalized_records[:3],
        "quality_report": quality_report
    }

@router.post("/ingest/apply-mapping")
async def apply_mapping(payload: Dict[str, Any] = Body(...)):
    """Activates a reviewed set of normalized records as the live dataset for decision-making."""
    global ACTIVE_OPPORTUNITIES, LAST_RUN_ID
    records = payload.get("records", [])
    if not records:
        raise HTTPException(status_code=400, detail="No records provided to activate.")

    ACTIVE_OPPORTUNITIES = records
    rag_service.index_opportunities(records)
    decision_engine.ext_gateway.reset()
    LAST_RUN_ID = None
    quality = quality_engine.evaluate(records, reference_time=compute_reference_time(records))

    return {
        "status": "activated",
        "records_count": len(records),
        "quality_score": quality["health_score"]
    }

@router.get("/dataset")
async def get_current_dataset():
    """Returns the currently active opportunity dataset and data quality scorecard"""
    if not ACTIVE_OPPORTUNITIES:
        load_default_demo_dataset()

    reference_time = compute_reference_time(ACTIVE_OPPORTUNITIES)
    quality = quality_engine.evaluate(ACTIVE_OPPORTUNITIES, reference_time=reference_time)
    return {
        "opportunities": ACTIVE_OPPORTUNITIES,
        "count": len(ACTIVE_OPPORTUNITIES),
        "quality_report": quality,
        "data_snapshot": reference_time.isoformat()
    }

@router.post("/decide/run", response_model=DecisionRunResponse)
async def run_decision_engine(policy: Optional[PolicyWeights] = None):
    """
    Executes the deterministic decision engine against active CRM opportunities.
    Computes priority scores, factor breakdowns, evidence packs, and recommended actions.
    """
    global LAST_RUN_ID
    if not ACTIVE_OPPORTUNITIES:
        load_default_demo_dataset()

    pol = policy or PolicyWeights()
    reference_time = compute_reference_time(ACTIVE_OPPORTUNITIES)
    run_id = f"DR-{uuid.uuid4().hex[:6].upper()}"
    LAST_RUN_ID = run_id

    recommendations = []
    stale_count = 0
    high_prio_count = 0

    for opp in ACTIVE_OPPORTUNITIES:
        rec = decision_engine.evaluate_opportunity(opp, pol, reference_time=reference_time, decision_run_id=run_id)
        if rec.stale_data_warning:
            stale_count += 1
        if rec.decision_class == "IMMEDIATE_ACTION":
            high_prio_count += 1
        recommendations.append(rec)

    # Sort descending by priority score
    recommendations.sort(key=lambda x: x.priority_score, reverse=True)

    total_val = sum(float(o.get("deal_value", 0)) for o in ACTIVE_OPPORTUNITIES)
    weighted_val = sum(float(o.get("deal_value", 0)) * float(o.get("win_probability", 0.5)) for o in ACTIVE_OPPORTUNITIES)

    return DecisionRunResponse(
        decision_run_id=run_id,
        policy_version=pol.policy_version,
        data_snapshot=reference_time.isoformat(),
        records_analyzed=len(ACTIVE_OPPORTUNITIES),
        recommendations_count=len(recommendations),
        pipeline_total_value=total_val,
        weighted_pipeline_value=round(weighted_val, 2),
        high_priority_count=high_prio_count,
        stale_warning_count=stale_count,
        recommendations=recommendations,
        generated_at=datetime.now(timezone.utc).isoformat()
    )

@router.post("/opportunities/{opportunity_id}/fetch-context")
async def fetch_external_context(opportunity_id: str):
    """Explicitly retrieves fresh external context for one opportunity (plan FR-015/UC-004).
    External evidence is query-driven, never merged in silently: until this endpoint is
    called for a company, its decision score uses a neutral baseline for that factor."""
    opp = next((o for o in ACTIVE_OPPORTUNITIES if o.get("opportunity_id") == opportunity_id), None)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found in the active dataset.")

    company_name = opp.get("company_name", "")
    embedded_signal = opp.get("external_signal")
    if not decision_engine.ext_gateway.has_signal(company_name, embedded=embedded_signal):
        return {
            "status": "no_signal",
            "message": f"No validated external signal available for {company_name}.",
            "signal": None
        }

    decision_engine.ext_gateway.mark_fetched(company_name)
    signal = decision_engine.ext_gateway.get_signal_for_company(company_name, only_if_fetched=True, embedded=embedded_signal)
    return {
        "status": "fetched",
        "message": f"Fresh external context retrieved for {company_name}.",
        "signal": signal
    }

@router.post("/twin/simulate", response_model=SimulationResponse)
async def simulate_decision_twin(inputs: SimulationInput):
    """
    Decision Twin Scenario Simulator.
    Calculates expected pipeline velocity, rep workload %, and conversion lifts under alternative strategy parameters.
    """
    if not ACTIVE_OPPORTUNITIES:
        load_default_demo_dataset()

    sim_res = simulator.simulate(ACTIVE_OPPORTUNITIES, inputs)
    return sim_res
