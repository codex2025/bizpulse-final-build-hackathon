"""
Schema Auto-Mapper for CRM Datasets.
Detects headers and automatically suggests canonical mappings with confidence scores.
"""
from typing import Dict, List, Any
import re

CANONICAL_TARGETS = {
    "opportunity_id": ["opportunity id", "opp id", "deal id", "lead id", "id", "record id"],
    "company_name": ["company name", "company", "account name", "account", "business", "client name", "organization"],
    "contact_name": ["contact name", "contact person", "contact", "person", "lead name", "decision maker"],
    "contact_email": ["contact email", "email", "work email", "email address"],
    "industry": ["industry", "vertical", "sector", "business type"],
    "location": ["location", "city", "state", "region", "address", "country"],
    "deal_value": ["deal value", "deal amount", "amount", "revenue", "value", "expected revenue", "contract value"],
    "stage": ["stage", "pipeline stage", "status", "deal stage", "sales stage"],
    "win_probability": ["win probability", "probability", "prob", "likelihood", "win rate"],
    "engagement_score": ["engagement score", "engagement", "activity score", "lead score", "health score"],
    "last_contact_date": ["last contact", "last contact date", "last touch", "last activity", "contacted on"],
    "owner": ["owner", "sales owner", "rep", "sales rep", "account executive", "assigned to"],
    "sales_notes": ["sales notes", "notes", "description", "rep notes", "meeting notes", "comments", "activity log"]
}

class SchemaMapper:
    def map_columns(self, source_columns: List[str]) -> Dict[str, Any]:
        mappings = {}
        unmapped = []
        confidences = {}

        for col in source_columns:
            normalized = col.strip().lower().replace("_", " ").replace("-", " ")
            matched_canonical = None
            highest_score = 0.0

            for canonical_key, aliases in CANONICAL_TARGETS.items():
                for alias in aliases:
                    if normalized == alias:
                        matched_canonical = canonical_key
                        highest_score = 1.0
                        break
                    elif alias in normalized or normalized in alias:
                        score = len(alias) / max(len(normalized), len(alias))
                        if score > highest_score and score >= 0.6:
                            highest_score = score
                            matched_canonical = canonical_key
                if highest_score == 1.0:
                    break

            if matched_canonical and matched_canonical not in mappings.values():
                mappings[col] = matched_canonical
                confidences[col] = round(highest_score, 2)
            else:
                unmapped.append(col)

        return {
            "mapped_columns": mappings,
            "unmapped_columns": unmapped,
            "confidence_scores": confidences,
            "canonical_coverage_percent": round((len(mappings) / len(CANONICAL_TARGETS)) * 100, 1),
            "is_ready_for_analysis": len(mappings) >= 4 and any("company" in v for v in mappings.values())
        }

    def normalize_record(self, raw_row: Dict[str, Any], mapping: Dict[str, str]) -> Dict[str, Any]:
        normalized = {}
        for source_col, canonical_field in mapping.items():
            if source_col in raw_row:
                val = raw_row[source_col]
                # Cast numeric types if appropriate
                if canonical_field in ["deal_value", "win_probability", "engagement_score"]:
                    try:
                        clean_num = re.sub(r"[^\d.]", "", str(val))
                        num_val = float(clean_num) if clean_num else 0.0
                        if canonical_field == "win_probability" and num_val > 1.0:
                            num_val = num_val / 100.0  # normalize 85% -> 0.85
                        normalized[canonical_field] = num_val
                    except Exception:
                        normalized[canonical_field] = 0.0
                elif canonical_field == "sales_notes":
                    if isinstance(val, list):
                        normalized[canonical_field] = [str(x) for x in val]
                    else:
                        normalized[canonical_field] = [str(val)] if val else []
                else:
                    normalized[canonical_field] = str(val).strip() if val is not None else ""
        return normalized
