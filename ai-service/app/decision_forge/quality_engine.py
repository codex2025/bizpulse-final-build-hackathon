"""
Data Quality and Hygiene Engine.
Detects duplicates, missing fields, and stale contacts, generating an executive Data Health Scorecard.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

class DataQualityEngine:
    def evaluate(
        self,
        records: List[Dict[str, Any]],
        stale_days_threshold: int = 30,
        reference_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Evaluates data quality. `reference_time` should be the dataset's own snapshot
        time (see router.compute_reference_time) rather than the wall clock, so that
        re-running against the same snapshot always yields the same staleness verdicts
        (plan AC-002 / AC-010) instead of drifting as real-world days pass.
        """
        total = len(records)
        if total == 0:
            return {"grade": "N/A", "health_score": 0, "warnings": ["No records provided"]}

        duplicates = 0
        missing_deal_value = 0
        missing_contact = 0
        stale_records = 0
        seen_companies = set()
        stale_warnings = []
        now = reference_time or datetime.now(timezone.utc)

        for rec in records:
            comp = rec.get("company_name", "").strip().lower()
            if comp in seen_companies:
                duplicates += 1
            else:
                if comp:
                    seen_companies.add(comp)

            if not rec.get("deal_value") or float(rec.get("deal_value", 0)) <= 0:
                missing_deal_value += 1

            if not rec.get("contact_name") or rec.get("contact_name") in ["N/A", ""]:
                missing_contact += 1

            # Check staleness
            last_date_str = rec.get("last_contact_date")
            if last_date_str:
                try:
                    # Clean ISO format
                    dt_part = last_date_str.replace("Z", "+00:00")
                    if len(dt_part) == 10:
                        dt = datetime.strptime(dt_part, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    else:
                        dt = datetime.fromisoformat(dt_part)
                    days_diff = (now - dt).days
                    if days_diff > stale_days_threshold:
                        stale_records += 1
                        stale_warnings.append(
                            f"{rec.get('company_name', 'Opportunity')}: Last contact was {days_diff} days ago (exceeds {stale_days_threshold}-day policy threshold)."
                        )
                except Exception:
                    pass

        # Compute composite quality score (0 to 100)
        penalty = (
            (duplicates * 10) +
            (missing_deal_value * 8) +
            (missing_contact * 4) +
            (stale_records * 6)
        )
        score = max(0.0, min(100.0, 100.0 - (penalty / max(1, total) * 10)))

        grade = "A (Excellent)" if score >= 90 else "B (Good)" if score >= 75 else "C (Fair)" if score >= 50 else "D (Action Needed)"

        return {
            "health_score": round(score, 1),
            "grade": grade,
            "total_records": total,
            "unique_companies": len(seen_companies),
            "duplicate_count": duplicates,
            "missing_value_count": missing_deal_value,
            "missing_contact_count": missing_contact,
            "stale_record_count": stale_records,
            "stale_warnings": stale_warnings[:5],
            "quality_indicators": [
                {"name": "Completeness", "value": f"{round((1 - (missing_deal_value + missing_contact)/(2 * total)) * 100)}%"},
                {"name": "Uniqueness", "value": f"{round((1 - duplicates/total) * 100)}%"},
                {"name": "Freshness", "value": f"{round((1 - stale_records/total) * 100)}%"}
            ]
        }
