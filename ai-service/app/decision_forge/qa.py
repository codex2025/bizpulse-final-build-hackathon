"""
Pipeline Q&A. Answers are computed from the active dataset's decision run -- there is no
canned text: every sentence is built from recommendation fields and names the records it
came from.
"""
import re
from typing import Any, Dict, List

from app.decision_forge.schemas import RecommendationItem

SUGGESTED_QUESTIONS = [
    "Which opportunities should we prioritize today?",
    "Which customers have gone cold?",
    "Which opportunities generated the highest expected value?",
    "Which regions are underperforming?",
]


def region_of(location: str) -> str:
    """'Greenwood, Indiana, USA' -> 'Indiana'; 'Monterrey, Mexico' -> 'Mexico'."""
    parts = [p.strip() for p in (location or "").split(",") if p.strip()]
    if not parts:
        return "Unknown"
    if len(parts) >= 2 and parts[-1].upper() in {"USA", "US", "UNITED STATES"}:
        return parts[-2]
    return parts[-1]


def _fmt(n: float) -> str:
    return f"${round(n):,}"


def _result(question: str, kind: str, text: str, recs: List[RecommendationItem]) -> Dict[str, Any]:
    return {
        "question": question,
        "intent": kind,
        "answer": text,
        "matched_ids": [r.opportunity_id for r in recs],
        "matched_companies": [r.company_name for r in recs],
        "basis": "Computed from the active dataset's latest decision run. Deal value, win probability and engagement are analyst estimates, not sourced facts.",
    }


def answer_question(question: str, recs: List[RecommendationItem]) -> Dict[str, Any]:
    q = (question or "").lower()
    if not recs:
        return _result(question, "empty", "No opportunities are loaded, so there is nothing to analyse.", [])
    by_score = sorted(recs, key=lambda r: (-r.priority_score, r.opportunity_id))

    if re.search(r"cold|stale|untouched|gone quiet", q):
        stale = [r for r in by_score if r.stale_data_warning]
        if stale:
            detail = "; ".join(f"{r.company_name} ({r.stale_data_warning.split(' (')[0]})" for r in stale)
            text = f"{len(stale)} opportunit{'y has' if len(stale) == 1 else 'ies have'} gone cold: {detail}."
        else:
            text = "No opportunities are flagged stale; every account was contacted within the policy window."
        return _result(question, "cold", text, stale)

    if re.search(r"highest.*(value|expected)|expected value|biggest deal|most valuable", q):
        ranked = sorted(recs, key=lambda r: (-(r.deal_value * r.win_probability), r.opportunity_id))[:3]
        text = "Ranked by expected value (estimated deal value x estimated win probability): " + ", ".join(
            f"{r.company_name} ({_fmt(r.deal_value * r.win_probability)})" for r in ranked) + "."
        return _result(question, "expected_value", text, ranked)

    if re.search(r"region|location|state|underperform", q):
        groups: Dict[str, List[RecommendationItem]] = {}
        for r in recs:
            loc = r.evidence_pack.get("structured_data", {}).get("location") or ""
            groups.setdefault(region_of(loc), []).append(r)
        ranked = sorted(groups.items(), key=lambda kv: (sum(x.priority_score for x in kv[1]) / len(kv[1]), kv[0]))
        name, items = ranked[0]
        avg = sum(x.priority_score for x in items) / len(items)
        text = (f"{name} is the weakest region: average priority score {avg:.1f} across {len(items)} "
                f"opportunit{'y' if len(items) == 1 else 'ies'} ({', '.join(x.company_name for x in items)}).")
        return _result(question, "region", text, items)

    if re.search(r"today|prioriti[sz]e|contact|act now|focus|attention", q):
        immediate = [r for r in by_score if r.decision_class == "IMMEDIATE_ACTION"]
        picks = immediate or by_score[:3]
        text = (f"{len(picks)} opportunit{'y needs' if len(picks) == 1 else 'ies need'} attention today: "
                + ", ".join(f"{r.company_name} ({r.priority_score})" for r in picks) + ".")
        return _result(question, "prioritize", text, picks)

    top = by_score[:3]
    text = "Top 3 by priority score: " + ", ".join(f"{r.company_name} ({r.priority_score})" for r in top) + "."
    return _result(question, "top", text, top)
