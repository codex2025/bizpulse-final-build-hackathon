"""
Data Quality and Hygiene Engine.
Deterministic rules that detect duplicates, missing/invalid/conflicting values and stale
contacts, producing both a per-record issue list (consumed by the decision engine, so bad
data lowers confidence instead of being silently hidden) and an executive scorecard.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

MISSING_PROBABILITY = "MISSING_PROBABILITY"
CONFLICTING_PROBABILITY = "CONFLICTING_PROBABILITY"
INVALID_DEAL_VALUE = "INVALID_DEAL_VALUE"
DUPLICATE = "DUPLICATE"
STALE = "STALE_CONTACT"
MISSING_CONTACT = "MISSING_CONTACT"


def parse_date(raw: Any) -> Optional[datetime]:
    if not raw or not isinstance(raw, str):
        return None
    try:
        s = raw.replace("Z", "+00:00")
        if len(s) == 10:
            return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def identity_key(rec: Dict[str, Any]) -> str:
    """Two records are duplicates when the same company has the same opportunity name.
    Records with no opportunity name fall back to company only (legacy flat data)."""
    company = str(rec.get("company_name", "")).strip().lower()
    name = str(rec.get("opportunity_name", "") or "").strip().lower()
    return f"{company}||{name}"


def mark_duplicates(records: List[Dict[str, Any]]) -> None:
    """Flags every later occurrence with `duplicate_of` (the first record's id). Idempotent."""
    first_seen: Dict[str, str] = {}
    for rec in records:
        rec.pop("duplicate_of", None)
        key = identity_key(rec)
        if not key.split("||")[0]:
            continue
        if key in first_seen:
            rec["duplicate_of"] = first_seen[key]
        else:
            first_seen[key] = str(rec.get("opportunity_id", ""))


def _issue(rec: Dict[str, Any], issue_type: str, severity: str, details: str, detected_at: str) -> Dict[str, Any]:
    return {
        "record_id": rec.get("opportunity_id", ""),
        "company_name": rec.get("company_name", ""),
        "issue_type": issue_type,
        "severity": severity,
        "details": details,
        "detected_at": detected_at,
    }


def detect_record_issues(
    rec: Dict[str, Any],
    reference_time: datetime,
    stale_days_threshold: int = 30,
) -> List[Dict[str, Any]]:
    """Issues detectable from one record (duplicates come from mark_duplicates)."""
    ts = reference_time.isoformat()
    issues: List[Dict[str, Any]] = []

    prob = rec.get("win_probability")
    if prob is None or prob == "":
        issues.append(_issue(rec, MISSING_PROBABILITY, "medium",
                             "CRM win probability is missing; a neutral 0.5 is used only so the record can be ranked.", ts))
    else:
        try:
            p = float(prob)
            if p < 0.0 or p > 1.0:
                issues.append(_issue(rec, CONFLICTING_PROBABILITY, "high",
                                     f"Win probability {p} is outside the valid 0-1 range; it is clamped for scoring.", ts))
        except (TypeError, ValueError):
            issues.append(_issue(rec, CONFLICTING_PROBABILITY, "high", f"Win probability {prob!r} is not a number.", ts))

    try:
        value = float(rec.get("deal_value") or 0)
    except (TypeError, ValueError):
        value = -1.0
    if value < 0:
        issues.append(_issue(rec, INVALID_DEAL_VALUE, "high", "Deal value is negative or not numeric; it is treated as 0 for scoring.", ts))
    elif value == 0:
        issues.append(_issue(rec, INVALID_DEAL_VALUE, "medium", "Deal value is missing or zero.", ts))

    if rec.get("duplicate_of"):
        issues.append(_issue(rec, DUPLICATE, "medium",
                             f"Duplicate of {rec['duplicate_of']} (same company and opportunity name).", ts))

    last = parse_date(rec.get("last_contact_date"))
    if last is not None:
        days = (reference_time - last).days
        if days > stale_days_threshold:
            issues.append(_issue(rec, STALE, "medium",
                                 f"Last contact was {days} days ago (policy threshold {stale_days_threshold}).", ts))

    if not rec.get("contact_name") or rec.get("contact_name") in ("N/A", ""):
        issues.append(_issue(rec, MISSING_CONTACT, "low", "No contact on record.", ts))
    return issues


class DataQualityEngine:
    def evaluate(
        self,
        records: List[Dict[str, Any]],
        stale_days_threshold: int = 30,
        reference_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """`reference_time` should be the dataset's own snapshot time (see
        workspace.compute_reference_time) so re-running the same snapshot always yields
        the same verdicts instead of drifting with the wall clock."""
        total = len(records)
        if total == 0:
            return {"grade": "N/A", "health_score": 0, "warnings": ["No records provided"]}

        now = reference_time or datetime.now(timezone.utc)
        # Duplicate marking must not leak into the caller's records unless already present.
        working = [dict(r) for r in records]
        for w, r in zip(working, records):
            if "duplicate_of" in r:
                w["duplicate_of"] = r["duplicate_of"]
        if not any("duplicate_of" in w for w in working):
            mark_duplicates(working)

        counts: Dict[str, int] = {}
        stale_warnings: List[str] = []
        issues: List[Dict[str, Any]] = []
        for rec in working:
            for issue in detect_record_issues(rec, now, stale_days_threshold):
                issues.append(issue)
                counts[issue["issue_type"]] = counts.get(issue["issue_type"], 0) + 1
                if issue["issue_type"] == STALE:
                    stale_warnings.append(f"{rec.get('company_name', 'Opportunity')}: {issue['details']}")

        duplicates = counts.get(DUPLICATE, 0)
        missing_value = counts.get(INVALID_DEAL_VALUE, 0)
        missing_contact = counts.get(MISSING_CONTACT, 0)
        stale_records = counts.get(STALE, 0)
        missing_prob = counts.get(MISSING_PROBABILITY, 0)
        conflicts = counts.get(CONFLICTING_PROBABILITY, 0)

        penalty = (
            (duplicates * 10) + (missing_value * 8) + (missing_contact * 4) + (stale_records * 6)
            + (missing_prob * 6) + (conflicts * 8)
        )
        score = max(0.0, min(100.0, 100.0 - (penalty / max(1, total) * 10)))
        grade = "A (Excellent)" if score >= 90 else "B (Good)" if score >= 75 else "C (Fair)" if score >= 50 else "D (Action Needed)"

        records_with_issue = len({i["record_id"] for i in issues if i["issue_type"] != MISSING_CONTACT})
        return {
            "health_score": round(score, 1),
            "grade": grade,
            "total_records": total,
            "unique_companies": len({str(r.get("company_name", "")).strip().lower() for r in working if r.get("company_name")}),
            "duplicate_count": duplicates,
            "missing_value_count": missing_value,
            "missing_contact_count": missing_contact,
            "missing_probability_count": missing_prob,
            "conflicting_probability_count": conflicts,
            "stale_record_count": stale_records,
            "records_with_issues": records_with_issue,
            "issue_counts": counts,
            "issues": issues,
            "stale_warnings": stale_warnings[:5],
            "quality_indicators": [
                {"name": "Completeness", "value": f"{round((1 - (missing_value + missing_contact + missing_prob) / (3 * total)) * 100)}%"},
                {"name": "Uniqueness", "value": f"{round((1 - duplicates / total) * 100)}%"},
                {"name": "Freshness", "value": f"{round((1 - stale_records / total) * 100)}%"},
            ],
        }
