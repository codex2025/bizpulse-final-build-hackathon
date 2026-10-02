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
                    # A blank cell is MISSING, not zero: leave the key out so quality checks flag it
                    # instead of the value being silently invented.
                    if val is None or str(val).strip() == "":
                        continue
                    try:
                        # Keep a leading minus: a negative amount is an error to report, not something to turn positive.
                        text = str(val).strip()
                        clean_num = ("-" if text.startswith("-") else "") + re.sub(r"[^\d.]", "", text)
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


# ---------------------------------------------------------------------------
# Dataset loading: nested (sourced / modeled / provenance) and legacy flat formats
# ---------------------------------------------------------------------------
MODELED_SCALAR_FIELDS = ["deal_value", "win_probability", "engagement_score", "last_contact_date", "stage", "owner"]


def is_nested_dataset(raw: Any) -> bool:
    """The nested format is a dict carrying `dataset_meta`; the legacy format is a flat list."""
    return isinstance(raw, dict) and "dataset_meta" in raw


def flatten_nested_record(rec: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten `modeled.*` into the canonical fields the engine reads, while carrying
    `sourced`, `provenance` and the per-field `_basis` strings through untouched so they
    can reach the evidence pack. Tolerates missing/empty blocks (graceful degradation)."""
    modeled = rec.get("modeled") or {}
    flat: Dict[str, Any] = {
        "opportunity_id": rec.get("opportunity_id", ""),
        "company_name": rec.get("company_name", ""),
        "contact_name": rec.get("contact_name") or "N/A",
        "contact_email": rec.get("contact_email"),
        "industry": rec.get("industry"),
        "location": rec.get("location"),
        "sales_notes": list(modeled.get("sales_notes") or []),
        "sourced": dict(rec.get("sourced") or {}),
        "provenance": list(rec.get("provenance") or []),
        "modeled_basis": {k[: -len("_basis")]: v for k, v in modeled.items() if k.endswith("_basis")},
        "modeled_fields": [k for k in modeled if not k.endswith("_basis")],
        "data_origin": "nested",
    }
    # Absent optional text fields are omitted (not None) so engine defaults apply.
    for field in ("industry", "location"):
        if flat.get(field) is None:
            flat.pop(field, None)
    for field in MODELED_SCALAR_FIELDS:
        if field in modeled and modeled[field] is not None:
            flat[field] = modeled[field]
    return flat


def load_dataset(raw: Any) -> Dict[str, Any]:
    """Normalise either supported dataset shape into
    {"meta": dict | None, "opportunities": [flat opportunity dicts]}."""
    if is_nested_dataset(raw):
        return {
            "meta": raw.get("dataset_meta"),
            "opportunities": [flatten_nested_record(r) for r in raw.get("opportunities", [])],
        }
    records = raw.get("opportunities", []) if isinstance(raw, dict) else list(raw or [])
    return {"meta": None, "opportunities": records}
