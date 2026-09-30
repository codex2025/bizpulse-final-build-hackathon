"""Rule-based clause extraction for documents that are NOT loan agreements (MSAs, SLAs, NDAs, leases ...).

The loan extractor is a template for lending documents: given anything else it would invent a lender, a principal
and a repayment schedule. This module instead reads the document's own numbered sections, scores each by fixed
keyword rules, and reports only what the text says. No amounts, rates or dates are created that are not in the text.
"""
import re
from typing import Any, Dict, List

LENDING_TERMS = (
    "loan", "lender", "borrower", "borrowed", "emi", "equated monthly", "mortgage", "repayment", "sanctioned",
    "disbursement", "instalment", "installment", "moratorium", "hypothecation",
)

_SECTION = re.compile(r"(?m)^\s*(\d{1,2})[.)]\s+([A-Za-z][A-Za-z &/\-]{2,60}?)[.:]\s+(.*?)(?=^\s*\d{1,2}[.)]\s+[A-Za-z]|\Z)", re.S)

_HIGH = re.compile(r"unlimited|uncapped|indemnif|liquidated\s+damages|sole\s+remedy|waive[sd]?\b|irrevocabl|perpetual", re.I)
_MEDIUM = re.compile(
    r"penalt|late\s+pay|interest|terminat|auto(?:matic(?:ally)?)?[-\s]?renew|renews?|fee\b|charge|liabilit|non-?compete|exclusive|"
    r"injunct|consequential|breach|notice",
    re.I,
)
_MONEY = re.compile(r"(?:₹|Rs\.?\s?|INR\s?|\$)\s?[\d,]+(?:\.\d+)?(?:\s?(?:lakh|lac|crore|million))?|\d+(?:\.\d+)?\s?%(?:\s+(?:per|a|of)\s+\w+)?|\b\d+\s+(?:days?|months?|years?|hours?)\b", re.I)

_TIPS = [
    (re.compile(r"terminat|renew", re.I), "Check the notice period, any exit fee and whether the term renews automatically; diarise the notice date."),
    (re.compile(r"liabilit|indemn|consequential", re.I), "Confirm the liability cap is a fixed amount, is mutual, and that indemnities are limited to third-party claims."),
    (re.compile(r"late|penalt|interest|fee", re.I), "Compare the rate or fee to your own payment terms and ask for a grace period before it applies."),
    (re.compile(r"confidential|disclos", re.I), "Check how long the duty lasts, what is excluded, and whether you may share with advisers and auditors."),
    (re.compile(r"uptime|availability|service\s+level|credit|support", re.I), "Check how the commitment is measured, what remedy you get, and whether credits are the only remedy."),
    (re.compile(r"governing|jurisdiction|law", re.I), "Confirm the governing law and court are acceptable and practical for you."),
]


def is_lending_document(text: str) -> bool:
    """True when the text uses enough lending vocabulary to be treated as a loan agreement."""
    lower = text.lower()
    return sum(1 for t in LENDING_TERMS if t in lower) >= 3


def _sections(text: str) -> List[Dict[str, str]]:
    found = [
        {"title": m.group(2).strip(), "body": " ".join(m.group(3).split())}
        for m in _SECTION.finditer(text)
    ]
    if found:
        return found
    # No numbered sections: fall back to paragraphs so something honest is still shown.
    paras = [" ".join(p.split()) for p in re.split(r"\n\s*\n", text) if len(p.split()) >= 6]
    return [{"title": f"Paragraph {i + 1}", "body": p} for i, p in enumerate(paras[:20])]


def extract_general_clauses(text: str) -> Dict[str, Any]:
    clauses: List[Dict[str, Any]] = []
    red_flags: List[Dict[str, Any]] = []

    for sec in _sections(text):
        title, body = sec["title"].title(), sec["body"]
        haystack = f"{title} {body}"
        high = bool(_HIGH.search(haystack))
        medium = bool(_MEDIUM.search(haystack))
        level = "High" if high else "Medium" if medium else "Low"
        tip = next((t for rx, t in _TIPS if rx.search(haystack)), "No unusual term detected by the keyword rules; read it once in full.")
        impact = "; ".join(dict.fromkeys(m.group(0).strip() for m in _MONEY.finditer(body)))[:160]
        clause = {
            "clause_type": title,
            "original_text": body[:700],
            "simple_explanation": body.split(". ")[0][:220],
            "risk_level": level,
            "is_red_flag": high,
            "red_flag_reason": "Wording often used to shift risk to one party (uncapped, indemnity, waiver, sole remedy)." if high else None,
            "financial_impact": impact,
            "actionable_tip": tip,
            "confidence": "medium",
            "confidence_reason": "Keyword rules over the document's own wording; no language model was used.",
            "source_page": 1,
            "financial_values": {},
        }
        clauses.append(clause)
        if high:
            red_flags.append({"clause_name": title, "severity": "High", "why_risky": clause["red_flag_reason"], "mitigation_tip": tip})

    n_high = sum(1 for c in clauses if c["risk_level"] == "High")
    n_med = sum(1 for c in clauses if c["risk_level"] == "Medium")
    summary = [
        f"General commercial agreement (not a loan): {len(clauses)} clause{'s' if len(clauses) != 1 else ''} read from the document.",
        f"{n_high} high-attention and {n_med} moderate-attention clause{'s' if n_med != 1 else ''} by keyword rules.",
        "Loan-specific figures (principal, EMI, affordability) do not apply to this document.",
    ]
    return {
        "document_type": "general",
        "executive_summary": summary,
        "overall_risk_rating": "High Attention Needed" if n_high >= 2 else "Moderate Attention Needed" if (n_high or n_med) else "Low Risk",
        "red_flags": red_flags,
        "borrower_rights": [],
        "clauses": clauses,
    }
