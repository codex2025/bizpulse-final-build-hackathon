"""
FastAPI Router for DecisionForge AI.

Every endpoint operates on ONE workspace, taken from the `X-Workspace-Id` header (the gateway
sets it to the authenticated user's id). Datasets, RAG index, external-context fetch state and
decision runs are per workspace -- there is no process-wide dataset.
"""
import csv
import io
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, File, Header, HTTPException, UploadFile

from app.decision_forge import analytics
from app.decision_forge.decision_twin import DecisionTwinSimulator
from app.decision_forge.planner import default_llm
from app.decision_forge.policies import PRESETS, factor_weight_sum, get_preset
from app.decision_forge.qa import SUGGESTED_QUESTIONS
from app.decision_forge.query_pipeline import run_query
from app.decision_forge.schema_mapper import SchemaMapper
from app.decision_forge.security import verify_internal_token
from app.decision_forge.schemas import (
    DecisionRunResponse,
    PolicyWeights,
    SimulationInput,
    SimulationResponse,
)
from app.decision_forge.workspace import (
    InvalidWorkspaceId,
    WorkspaceState,
    compute_reference_time,  # noqa: F401  (re-exported for callers/tests)
    registry,
)

router = APIRouter(dependencies=[Depends(verify_internal_token)])
mapper = SchemaMapper()
simulator = DecisionTwinSimulator()

MAX_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_ROWS = 5000
MAX_COLUMNS = 60
ALLOWED_UPLOAD_EXTENSIONS = (".csv",)


def _ws(x_workspace_id: Optional[str]) -> WorkspaceState:
    try:
        return registry.get(x_workspace_id)
    except InvalidWorkspaceId as e:
        raise HTTPException(status_code=400, detail=str(e))


def _summary_view(ws: WorkspaceState) -> Dict[str, Any]:
    return {"dataset_key": ws.dataset_key, "count": len(ws.opportunities), "snapshot_id": ws.snapshot_id}


@router.post("/reset-demo")
async def reset_demo_data(payload: Optional[Dict[str, Any]] = Body(default=None),
                          x_workspace_id: Optional[str] = Header(default=None)):
    """Resets THIS workspace to a deterministic dataset ('real' by default, or 'synthetic'),
    clearing its fetched-context state and RAG index. Other workspaces are untouched."""
    ws = _ws(x_workspace_id)
    key = (payload or {}).get("dataset", "real")
    if key not in ("real", "synthetic", "legacy"):
        raise HTTPException(status_code=400, detail=f"Unknown dataset '{key}'. Choose one of: real, synthetic, legacy.")
    ws.load(key)
    return {
        "status": "success",
        "message": f"Loaded {len(ws.opportunities)} opportunities ({key} dataset) into your DecisionForge workspace.",
        **_summary_view(ws),
    }


@router.get("/datasets")
async def list_datasets():
    return {"datasets": [
        {"key": "real", "label": "Real accounts (cited public announcements)", "synthetic": False},
        {"key": "synthetic", "label": "Synthetic B2B sales (scale + evaluation)", "synthetic": True},
        {"key": "legacy", "label": "Legacy fictional demo", "synthetic": True},
    ]}


async def _read_upload(file: UploadFile) -> str:
    filename = (file.filename or "").lower()
    if not filename.endswith(ALLOWED_UPLOAD_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload a .csv file.")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (limit {MAX_UPLOAD_BYTES // (1024 * 1024)} MB).")
    if b"\x00" in content:
        raise HTTPException(status_code=400, detail="File does not look like a text CSV (binary content detected).")
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not valid UTF-8 text. Re-export the CSV as UTF-8.")


@router.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...), x_workspace_id: Optional[str] = Header(default=None)):
    """Validates a CSV, detects columns, proposes mappings and reports data quality.
    This does NOT activate the dataset -- call /ingest/apply-mapping with the reviewed records
    (the user reviews/edits before anything is used)."""
    ws = _ws(x_workspace_id)
    text = await _read_upload(file)
    try:
        rows = list(csv.DictReader(io.StringIO(text)))
    except csv.Error as e:
        raise HTTPException(status_code=400, detail=f"Malformed CSV: {e}")
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file appears to be empty.")
    if len(rows) > MAX_ROWS:
        raise HTTPException(status_code=413, detail=f"Too many rows ({len(rows)}); limit is {MAX_ROWS}.")
    columns = [c for c in rows[0].keys() if c is not None]
    if len(columns) > MAX_COLUMNS:
        raise HTTPException(status_code=400, detail=f"Too many columns ({len(columns)}); limit is {MAX_COLUMNS}.")

    mapping_result = mapper.map_columns(columns)
    normalized = [mapper.normalize_record(r, mapping_result["mapped_columns"]) for r in rows]
    invalid_rows = 0
    for rec in normalized:
        if not rec.get("company_name"):
            invalid_rows += 1
        if not rec.get("opportunity_id"):
            rec["opportunity_id"] = f"UPL-{uuid.uuid4().hex[:6].upper()}"
        rec.setdefault("sales_notes", [])

    quality = ws.quality.evaluate(normalized, reference_time=compute_reference_time(normalized))
    return {
        "filename": file.filename,
        "total_rows": len(rows),
        "detected_columns": columns,
        "mapping_proposal": mapping_result,
        "normalized_records": normalized,
        "sample_preview": normalized[:3],
        "quality_report": quality,
        "validation_report": {
            "records_parsed": len(normalized),
            "invalid_records": invalid_rows,
            "duplicates": quality.get("duplicate_count", 0),
            "missing_probability": quality.get("missing_probability_count", 0),
            "missing_or_invalid_value": quality.get("missing_value_count", 0),
            "stale_records": quality.get("stale_record_count", 0),
            "warnings": (["Rows with no company name cannot be scored reliably."] if invalid_rows else []),
        },
    }


@router.post("/ingest/apply-mapping")
async def apply_mapping(payload: Dict[str, Any] = Body(...), x_workspace_id: Optional[str] = Header(default=None)):
    """Activates a reviewed set of normalized records as THIS workspace's dataset."""
    ws = _ws(x_workspace_id)
    records = payload.get("records", [])
    if not isinstance(records, list) or not records:
        raise HTTPException(status_code=400, detail="No records provided to activate.")
    if len(records) > MAX_ROWS:
        raise HTTPException(status_code=413, detail=f"Too many records ({len(records)}); limit is {MAX_ROWS}.")
    if not all(isinstance(r, dict) for r in records):
        raise HTTPException(status_code=400, detail="Every record must be an object.")
    ws.apply_records(records)
    quality = ws.quality_report()
    return {"status": "activated", "records_count": len(ws.opportunities), "quality_score": quality["health_score"],
            "snapshot_id": ws.snapshot_id}


@router.get("/dataset")
async def get_current_dataset(x_workspace_id: Optional[str] = Header(default=None)):
    """The workspace's dataset and data-quality scorecard (structured note bodies omitted for size)."""
    ws = _ws(x_workspace_id)
    lean = [{k: v for k, v in o.items() if k != "notes"} for o in ws.opportunities]
    return {
        "opportunities": lean,
        "count": len(lean),
        "quality_report": ws.quality_report(),
        "data_snapshot": ws.reference_time.isoformat(),
        "dataset_meta": ws.meta,
        "dataset_key": ws.dataset_key,
        "snapshot_id": ws.snapshot_id,
    }


@router.get("/quality")
async def get_quality(x_workspace_id: Optional[str] = Header(default=None), limit: int = 200):
    ws = _ws(x_workspace_id)
    report = ws.quality_report()
    issues = report.get("issues", [])
    return {**{k: v for k, v in report.items() if k != "issues"}, "issues": issues[: max(1, min(limit, 1000))],
            "issues_total": len(issues), "dataset_key": ws.dataset_key, "snapshot_id": ws.snapshot_id}


@router.get("/policies")
async def list_policies():
    return {"presets": [{"name": n, "factor_weight_sum": factor_weight_sum(p), **p.model_dump()} for n, p in PRESETS.items()]}


def _resolve_policy(policy: Optional[PolicyWeights], preset: Optional[str]) -> PolicyWeights:
    if policy is not None:
        return policy
    if preset:
        try:
            return get_preset(preset)
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Unknown policy preset '{preset}'.")
    return PolicyWeights()


@router.post("/decide/run", response_model=DecisionRunResponse)
async def run_decision_engine(policy: Optional[PolicyWeights] = None, preset: Optional[str] = None,
                              x_workspace_id: Optional[str] = Header(default=None)):
    """Deterministic decision run over THIS workspace's opportunities."""
    ws = _ws(x_workspace_id)
    return ws.run(_resolve_policy(policy, preset))


@router.get("/ask/suggestions")
async def ask_suggestions():
    return {"questions": SUGGESTED_QUESTIONS}


def _question(payload: Dict[str, Any]) -> str:
    q = payload.get("question")
    if not isinstance(q, str) or not q.strip():
        raise HTTPException(status_code=400, detail="A question is required.")
    if len(q) > 500:
        raise HTTPException(status_code=400, detail="Question is too long (limit 500 characters).")
    return q.strip()


@router.post("/decisions/query")
async def decisions_query(payload: Dict[str, Any] = Body(...), preset: Optional[str] = None,
                          x_workspace_id: Optional[str] = Header(default=None)):
    """Plan -> analytics -> RAG -> decision -> answer. Only the tools the plan needs are run."""
    ws = _ws(x_workspace_id)
    policy = _resolve_policy(None, preset or payload.get("preset"))
    return run_query(ws, _question(payload), llm=default_llm(), policy=policy)


@router.post("/ask")
async def ask_pipeline(payload: Dict[str, Any] = Body(...), x_workspace_id: Optional[str] = Header(default=None)):
    """Backwards-compatible alias of /decisions/query."""
    ws = _ws(x_workspace_id)
    return run_query(ws, _question(payload), llm=default_llm())


@router.get("/analytics/{tool}")
async def run_analytics_tool(tool: str, x_workspace_id: Optional[str] = Header(default=None),
                             opportunity_id: Optional[str] = None, customer_id: Optional[str] = None,
                             company_name: Optional[str] = None, threshold_days: int = 30):
    """Typed, deterministic, read-only analytics tools (see analytics.TOOLS)."""
    ws = _ws(x_workspace_id)
    if tool not in analytics.TOOLS:
        raise HTTPException(status_code=404, detail=f"Unknown analytics tool '{tool}'.")
    ref, ds, opps = ws.reference_time, ws.dataset_key, ws.opportunities
    if tool == "get_pipeline_summary":
        return analytics.get_pipeline_summary(opps, ref, ds)
    if tool == "get_region_summary":
        return analytics.get_region_summary(opps, ref, ds)
    if tool == "get_expected_value":
        return analytics.get_expected_value(opps, ref, opportunity_id, ds)
    if tool == "get_stale_opportunities":
        return analytics.get_stale_opportunities(opps, ref, threshold_days, ds)
    if tool == "get_activity_metrics":
        return analytics.get_activity_metrics(opps, ws.activities, ref, dataset_key=ds)
    if tool == "get_sales_rep_capacity":
        return analytics.get_sales_rep_capacity(opps, ws.reps, ref, dataset_key=ds)
    if tool == "get_customer_metrics":
        if not (customer_id or company_name):
            raise HTTPException(status_code=400, detail="customer_id or company_name is required.")
        return analytics.get_customer_metrics(opps, ref, customer_id, company_name, ds)
    if not opportunity_id:
        raise HTTPException(status_code=400, detail="opportunity_id is required.")
    return analytics.get_opportunity_metrics(opps, ref, opportunity_id, ds)


@router.post("/opportunities/{opportunity_id}/fetch-context")
async def fetch_external_context(opportunity_id: str, x_workspace_id: Optional[str] = Header(default=None)):
    """Explicitly retrieves the cited external signal for one opportunity. External evidence is
    query-driven and never merged in silently: until this is called for a company its decision
    uses a neutral baseline for that factor. If nothing can be retrieved the decision simply
    continues on internal data."""
    ws = _ws(x_workspace_id)
    opp = next((o for o in ws.opportunities if o.get("opportunity_id") == opportunity_id), None)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found in the active dataset.")

    company_name = opp.get("company_name", "")
    embedded = opp.get("external_signal")
    gw = ws.engine.ext_gateway
    if not gw.has_signal(company_name, embedded=embedded):
        return {
            "status": "no_signal",
            "message": "External context unavailable. Decision calculated from internal business data.",
            "signal": None,
        }
    gw.mark_fetched(company_name)
    signal = gw.get_signal_for_company(company_name, only_if_fetched=True, embedded=embedded)
    return {"status": "fetched", "message": f"External context retrieved for {company_name}.", "signal": signal}


@router.post("/twin/simulate", response_model=SimulationResponse)
async def simulate_decision_twin(inputs: SimulationInput, x_workspace_id: Optional[str] = Header(default=None)):
    """Decision Twin: scenario math on a COPY of the workspace snapshot; source records are never mutated."""
    ws = _ws(x_workspace_id)
    snapshot = [dict(o) for o in ws.opportunities]
    return simulator.simulate(snapshot, inputs)
