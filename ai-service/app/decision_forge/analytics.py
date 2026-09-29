"""
Deterministic analytics tools.

Every calculation lives here as plain code -- the LLM never does arithmetic. Each tool returns
a structured dict with:
  result      the computed values
  source      which records/dataset the numbers came from
  timestamp   the data snapshot time the calculation was anchored to (NOT the wall clock)
  definition  the exact formula used

Expected value = deal_value x probability, computed only when probability is a number in
[0, 1] and deal_value is non-negative. Otherwise the record is *excluded and listed*, never
silently given an invented probability.
"""
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.decision_forge.quality_engine import parse_date

EV_DEFINITION = "expected_value = deal_value x probability (only when 0 <= probability <= 1 and deal_value >= 0)"


def _num(v: Any) -> Optional[float]:
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def expected_value(opp: Dict[str, Any]) -> Optional[float]:
    value, prob = _num(opp.get("deal_value")), _num(opp.get("win_probability"))
    if value is None or value < 0 or prob is None or not (0.0 <= prob <= 1.0):
        return None
    return value * prob


def _envelope(tool: str, result: Any, ref: datetime, dataset_key: str, n_records: int, definition: str) -> Dict[str, Any]:
    return {
        "tool": tool,
        "result": result,
        "source": {"dataset": dataset_key, "records": n_records, "type": "business_records"},
        "timestamp": ref.isoformat(),
        "definition": definition,
    }


def days_since(rec: Dict[str, Any], ref: datetime) -> Optional[int]:
    last = parse_date(rec.get("last_contact_date"))
    return None if last is None else (ref - last).days


def get_pipeline_summary(opps: List[Dict[str, Any]], ref: datetime, dataset_key: str = "") -> Dict[str, Any]:
    total = sum(max(0.0, _num(o.get("deal_value")) or 0.0) for o in opps)
    weighted = 0.0
    excluded: List[Dict[str, str]] = []
    by_stage: Dict[str, Dict[str, float]] = defaultdict(lambda: {"count": 0, "value": 0.0, "expected_value": 0.0})
    by_region: Dict[str, Dict[str, float]] = defaultdict(lambda: {"count": 0, "value": 0.0, "expected_value": 0.0})
    for o in opps:
        ev = expected_value(o)
        value = max(0.0, _num(o.get("deal_value")) or 0.0)
        if ev is None:
            excluded.append({"opportunity_id": o.get("opportunity_id", ""), "reason": "probability missing/out of range or deal value invalid"})
        else:
            weighted += ev
        region = o.get("region") or _region_from_location(o.get("location"))
        for bucket, key in ((by_stage, o.get("stage", "Unknown")), (by_region, region)):
            bucket[key]["count"] += 1
            bucket[key]["value"] += value
            bucket[key]["expected_value"] += ev or 0.0
    return _envelope("get_pipeline_summary", {
        "opportunity_count": len(opps),
        "total_pipeline_value": round(total, 2),
        "weighted_expected_value": round(weighted, 2),
        "excluded_from_expected_value": excluded,
        "by_stage": {k: {m: round(x, 2) for m, x in v.items()} for k, v in sorted(by_stage.items())},
        "by_region": {k: {m: round(x, 2) for m, x in v.items()} for k, v in sorted(by_region.items())},
    }, ref, dataset_key, len(opps), "total = sum(deal_value >= 0); weighted = sum(" + EV_DEFINITION + ")")


def _region_from_location(location: Optional[str]) -> str:
    from app.decision_forge.qa import region_of
    return region_of(location or "")


def get_expected_value(opps: List[Dict[str, Any]], ref: datetime, opportunity_id: Optional[str] = None,
                       dataset_key: str = "") -> Dict[str, Any]:
    rows = []
    for o in opps:
        if opportunity_id and o.get("opportunity_id") != opportunity_id:
            continue
        ev = expected_value(o)
        rows.append({
            "opportunity_id": o.get("opportunity_id"), "company_name": o.get("company_name"),
            "deal_value": _num(o.get("deal_value")), "probability": _num(o.get("win_probability")),
            "expected_value": None if ev is None else round(ev, 2),
            "note": None if ev is not None else "Expected value not computed: probability missing/out of range or deal value invalid.",
        })
    rows.sort(key=lambda r: (-(r["expected_value"] or -1.0), str(r["opportunity_id"])))
    return _envelope("get_expected_value", rows, ref, dataset_key, len(rows), EV_DEFINITION)


def get_opportunity_metrics(opps: List[Dict[str, Any]], ref: datetime, opportunity_id: str, dataset_key: str = "") -> Dict[str, Any]:
    o = next((x for x in opps if x.get("opportunity_id") == opportunity_id), None)
    if o is None:
        return _envelope("get_opportunity_metrics", None, ref, dataset_key, 0, "lookup by opportunity_id")
    ev = expected_value(o)
    return _envelope("get_opportunity_metrics", {
        "opportunity_id": opportunity_id, "company_name": o.get("company_name"), "stage": o.get("stage"),
        "deal_value": _num(o.get("deal_value")), "probability": _num(o.get("win_probability")),
        "expected_value": None if ev is None else round(ev, 2),
        "days_since_last_contact": days_since(o, ref), "activity_count": o.get("activity_count"),
        "engagement_score": o.get("engagement_score"),
    }, ref, dataset_key, 1, "record fields as stored; days_since_last_contact = snapshot - last_contact_date")


def get_customer_metrics(opps: List[Dict[str, Any]], ref: datetime, customer_id: Optional[str] = None,
                         company_name: Optional[str] = None, dataset_key: str = "") -> Dict[str, Any]:
    rows = [o for o in opps
            if (customer_id and o.get("customer_id") == customer_id)
            or (company_name and str(o.get("company_name", "")).lower() == company_name.lower())]
    ev = [expected_value(o) for o in rows]
    return _envelope("get_customer_metrics", {
        "customer_id": customer_id, "company_name": company_name or (rows[0].get("company_name") if rows else None),
        "opportunity_count": len(rows),
        "total_value": round(sum(max(0.0, _num(o.get("deal_value")) or 0.0) for o in rows), 2),
        "expected_value": round(sum(e for e in ev if e is not None), 2),
        "opportunity_ids": [o.get("opportunity_id") for o in rows],
    }, ref, dataset_key, len(rows), "sums over the customer's opportunities; " + EV_DEFINITION)


def get_activity_metrics(opps: List[Dict[str, Any]], activities: List[Dict[str, Any]], ref: datetime,
                         window_days: int = 30, dataset_key: str = "") -> Dict[str, Any]:
    by_type: Dict[str, int] = defaultdict(int)
    by_rep: Dict[str, int] = defaultdict(int)
    recent = 0
    for a in activities:
        by_type[a.get("type", "other")] += 1
        by_rep[a.get("owner_id", "unknown")] += 1
        ts = parse_date(a.get("occurred_at"))
        if ts is not None and 0 <= (ref - ts).days <= window_days:
            recent += 1
    note = None if activities else "No activity records in this dataset."
    return _envelope("get_activity_metrics", {
        "total_activities": len(activities), f"activities_last_{window_days}_days": recent,
        "by_type": dict(sorted(by_type.items())), "by_rep": dict(sorted(by_rep.items())),
        "activities_per_opportunity": round(len(activities) / len(opps), 2) if opps else 0.0, "note": note,
    }, ref, dataset_key, len(activities), f"counts of activity records; recent = occurred within {window_days} days of the snapshot")


def get_stale_opportunities(opps: List[Dict[str, Any]], ref: datetime, threshold_days: int = 30, dataset_key: str = "") -> Dict[str, Any]:
    stale = []
    for o in opps:
        d = days_since(o, ref)
        if d is not None and d > threshold_days:
            stale.append({"opportunity_id": o.get("opportunity_id"), "company_name": o.get("company_name"),
                          "days_since_last_contact": d, "deal_value": _num(o.get("deal_value"))})
    stale.sort(key=lambda r: (-r["days_since_last_contact"], str(r["opportunity_id"])))
    return _envelope("get_stale_opportunities", stale, ref, dataset_key, len(opps),
                     f"stale = (snapshot - last_contact_date) > {threshold_days} days")


def get_sales_rep_capacity(opps: List[Dict[str, Any]], reps: List[Dict[str, Any]], ref: datetime,
                           contacts_per_day: int = 15, working_days: int = 20, touchpoints_per_deal: int = 4,
                           dataset_key: str = "") -> Dict[str, Any]:
    load: Dict[str, int] = defaultdict(int)
    for o in opps:
        load[o.get("owner_id") or o.get("owner") or "unassigned"] += 1
    capacity = contacts_per_day * working_days
    rows = []
    for rid in sorted(load):
        demand = load[rid] * touchpoints_per_deal
        rows.append({"rep": rid, "opportunities": load[rid], "demand_touchpoints": demand,
                     "capacity_touchpoints": capacity, "utilization_percent": round(demand / capacity * 100.0, 1)})
    return _envelope("get_sales_rep_capacity", rows, ref, dataset_key, len(opps),
                     f"utilization = opportunities x {touchpoints_per_deal} touchpoints / ({contacts_per_day} contacts/day x {working_days} days)")


def get_region_summary(opps: List[Dict[str, Any]], ref: datetime, dataset_key: str = "") -> Dict[str, Any]:
    regions = get_pipeline_summary(opps, ref, dataset_key)["result"]["by_region"]
    ranked = sorted(regions.items(), key=lambda kv: (-kv[1]["expected_value"], kv[0]))
    return _envelope("get_region_summary", [{"region": k, **v} for k, v in ranked], ref, dataset_key, len(opps),
                     "regions ranked by expected value; " + EV_DEFINITION)


TOOLS = {
    "get_pipeline_summary": get_pipeline_summary,
    "get_expected_value": get_expected_value,
    "get_opportunity_metrics": get_opportunity_metrics,
    "get_customer_metrics": get_customer_metrics,
    "get_activity_metrics": get_activity_metrics,
    "get_stale_opportunities": get_stale_opportunities,
    "get_sales_rep_capacity": get_sales_rep_capacity,
    "get_region_summary": get_region_summary,
}
