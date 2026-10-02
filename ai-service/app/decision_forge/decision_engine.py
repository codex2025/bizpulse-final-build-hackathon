"""
Deterministic Decision Engine.
Evaluates opportunities using mathematical policy scoring, classification thresholds,
and bundles full provenance into evidence packs.
"""
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from app.decision_forge.schemas import PolicyWeights, DecisionFactor, RecommendationItem
from app.decision_forge.external_gateway import ExternalContextGateway
from app.decision_forge.rag_service import NotesRagService
from app.decision_forge.quality_engine import detect_record_issues, STALE, MISSING_PROBABILITY, CONFLICTING_PROBABILITY, INVALID_DEAL_VALUE, DUPLICATE
from app.decision_forge import intent as intent_lexicon


# The deal-value factor scores value / ceiling, capped at 100 (the same 500k the scorer always used).
DEAL_VALUE_CEILING = 500000.0

SYNTHETIC_NOTE = "synthetic CRM state for this demo, not measured from real interactions"


def _engagement_description(engagement: float, nested: bool = False) -> str:
    """Describes the score without claiming meetings, stakeholders or interactions the dataset
    doesn't contain. For the real-account dataset the value is synthetic and says so."""
    level = "high" if engagement >= 80 else "moderate" if engagement >= 50 else "low"
    if nested:
        return f"Engagement {int(engagement)}/100 ({level}) -- {SYNTHETIC_NOTE}."
    return f"Engagement score {int(engagement)}/100 ({level}) as recorded in the CRM."


# Confidence starts at BASE_CONFIDENCE and loses a fixed amount per issue type present.
BASE_CONFIDENCE = 0.9
CONFIDENCE_DEDUCTIONS = {
    MISSING_PROBABILITY: 0.25,
    CONFLICTING_PROBABILITY: 0.20,
    INVALID_DEAL_VALUE: 0.20,
    DUPLICATE: 0.10,
    STALE: 0.15,
}
NO_NOTES_DEDUCTION = 0.05
MIN_CONFIDENCE = 0.1


class DeterministicDecisionEngine:
    def __init__(self):
        self.ext_gateway = ExternalContextGateway()
        self.rag_service = NotesRagService()

    def evaluate_opportunity(
        self,
        opp: Dict[str, Any],
        policy: PolicyWeights,
        reference_time: Optional[datetime] = None,
        decision_run_id: str = "",
    ) -> RecommendationItem:
        """Scores one opportunity. `reference_time` anchors recency/staleness math to the
        dataset's own snapshot time rather than the wall clock (plan AC-002 / AC-010):
        the same snapshot + policy always produces the same score, regardless of what day
        it's re-run on."""
        now_ref = reference_time or datetime.now(timezone.utc)
        def _num(v, default):
            try:
                return float(v) if v not in (None, "") else default
            except (TypeError, ValueError):
                return default

        issues = detect_record_issues(opp, now_ref, policy.stale_days_threshold)
        issue_types = {i["issue_type"] for i in issues}

        # Bad inputs are never hidden: they are flagged above and lower confidence / apply the
        # policy penalty below. The neutral defaults here only let the record be ranked.
        deal_val = max(0.0, _num(opp.get("deal_value"), 0.0))
        win_prob_raw = _num(opp.get("win_probability"), None)
        win_prob = 0.5 if win_prob_raw is None else min(1.0, max(0.0, win_prob_raw))
        engagement = _num(opp.get("engagement_score"), 50.0)

        # 1. Deal Value Factor (normalized relative to $500k ceiling)
        deal_score = min(100.0, (deal_val / DEAL_VALUE_CEILING) * 100.0)

        # 2. Win Probability Factor (0 to 1 -> 0 to 100)
        prob_score = min(100.0, max(0.0, win_prob * 100.0))

        # 3. Engagement Score Factor
        eng_score = min(100.0, max(0.0, engagement))

        # 4. Recency Score Factor (checks last_contact_date against the dataset snapshot time)
        recency_score = 70.0
        stale_warning = None
        days_since_contact = None
        last_date = opp.get("last_contact_date")
        if last_date:
            try:
                dt_part = last_date.replace("Z", "+00:00")
                if len(dt_part) == 10:
                    dt = datetime.strptime(dt_part, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                else:
                    dt = datetime.fromisoformat(dt_part)
                days_diff = (now_ref - dt).days
                days_since_contact = days_diff
                if days_diff <= 7:
                    recency_score = 95.0
                elif days_diff <= 14:
                    recency_score = 80.0
                elif days_diff <= 30:
                    recency_score = 60.0
                else:
                    recency_score = 25.0
                    stale_warning = f"Last contact was {days_diff} days ago (relative to snapshot). Opportunity requires immediate re-qualification."
            except Exception:
                recency_score = 50.0

        # 5. External Intent & Signal Factor -- only counts once the user has explicitly
        # fetched fresh context for this company (see ExternalContextGateway). Until then
        # the factor sits at a neutral baseline so the "before vs after" demo moment is real.
        company_name = opp.get("company_name", "Target")
        embedded_signal = opp.get("external_signal")
        signal_available = self.ext_gateway.has_signal(company_name, embedded=embedded_signal)
        external_signal = self.ext_gateway.get_signal_for_company(company_name, only_if_fetched=True, embedded=embedded_signal)
        was_fetched = external_signal is not None

        ext_score = 50.0
        ext_description = "Baseline market alignment; no external signal fetched yet for this account."
        if external_signal:
            rel = float(external_signal.get("relevance_score", 0.8))
            ext_score = min(100.0, rel * 100.0)
            ext_description = external_signal.get("impact_summary", "External signal fetched; no notable impact flagged.")
        elif signal_available:
            ext_description = "A validated external signal is available for this account -- click \"Fetch fresh context\" to check it."

        # 6. Buying intent from rep notes (optional factor; weight 0.0 leaves the score untouched)
        notes_for_intent = opp.get("notes") or opp.get("sales_notes") or []
        intent = intent_lexicon.score_notes(notes_for_intent)

        # Data-quality penalty: fixed points per issue type present (zero for clean records)
        penalty = round(sum(policy.quality_penalties.get(t, 0.0) for t in issue_types), 1)

        # Mathematical Deterministic Weighted Sum
        priority_score = (
            (deal_score * policy.deal_value_weight) +
            (prob_score * policy.win_probability_weight) +
            (eng_score * policy.engagement_weight) +
            (recency_score * policy.recency_weight) +
            (ext_score * policy.intent_external_weight) +
            (intent["score"] * policy.buying_intent_weight)
        )
        priority_score = round(max(0.0, priority_score - penalty), 1)

        confidence = BASE_CONFIDENCE - sum(CONFIDENCE_DEDUCTIONS.get(t, 0.0) for t in issue_types)
        if not (opp.get("notes") or opp.get("sales_notes")):
            confidence -= NO_NOTES_DEDUCTION
        confidence = round(max(MIN_CONFIDENCE, confidence), 2)
        review_required = confidence < policy.review_confidence_threshold
        warnings = [i["details"] for i in issues if i["issue_type"] != "MISSING_CONTACT"]
        if MISSING_PROBABILITY in issue_types:
            warnings.append("Decision confidence reduced because CRM probability is missing.")
        if review_required:
            warnings.append("Human review required: confidence is below the policy threshold.")

        # Classification
        if priority_score >= policy.high_priority_threshold:
            decision_class = "IMMEDIATE_ACTION"
            badge_color = "emerald"
            suggested_action = f"Schedule executive-level close call with {opp.get('contact_name', 'client')} to finalize contract terms."
        elif priority_score >= policy.medium_priority_threshold:
            decision_class = "PROCEED_WITH_QUALIFICATION"
            badge_color = "amber"
            suggested_action = "Send tailored value-proposition deck addressing technical requirements and budget cycle."
        else:
            decision_class = "NURTURE_MONITOR"
            badge_color = "slate"
            suggested_action = "Add to automated re-engagement campaign; review when quarterly energy/market conditions shift."

        is_nested = opp.get("data_origin") == "nested"
        stage_label = opp.get("stage", "Active")
        if win_prob_raw is None:
            win_description = "CRM win probability is missing; a neutral 50% is used only so the record can be ranked (confidence is reduced)."
        elif is_nested:
            win_description = f"Analyst-estimated win probability of {int(win_prob * 100)}% at the {stage_label} stage (an estimate, not a historical close rate)."
        else:
            win_description = f"CRM win probability of {int(win_prob * 100)}% at the {stage_label} stage."
        if days_since_contact is None:
            recency_description = "No usable last-contact date; a neutral recency score is used."
        else:
            recency_description = (
                f"Last contact {days_since_contact} day(s) before the data snapshot"
                f"{' (synthetic CRM timestamp)' if is_nested else ''}; scores 95 within 7 days, 80 within 14, 60 within 30, 25 beyond."
            )

        factors = [
            DecisionFactor(
                name="Deal Size Impact",
                raw_value=f"${deal_val:,.0f}",
                score=round(deal_score, 1),
                weight=policy.deal_value_weight,
                weighted_contribution=round(deal_score * policy.deal_value_weight, 1),
                description=f"Deal value of ${deal_val:,.0f}, scored as value / ${DEAL_VALUE_CEILING:,.0f} reference ceiling (capped at 100)." + (" Analyst estimate, not a sourced or quoted figure." if is_nested else "")
            ),
            DecisionFactor(
                name="Win Likelihood",
                raw_value=f"{int(win_prob * 100)}%" if win_prob_raw is not None else "Missing (neutral 50% used to rank)",
                score=round(prob_score, 1),
                weight=policy.win_probability_weight,
                weighted_contribution=round(prob_score * policy.win_probability_weight, 1),
                description=win_description
            ),
            DecisionFactor(
                name="Account Engagement",
                raw_value=f"{int(engagement)}/100",
                score=round(eng_score, 1),
                weight=policy.engagement_weight,
                weighted_contribution=round(eng_score * policy.engagement_weight, 1),
                description=_engagement_description(engagement, is_nested)
            ),
            DecisionFactor(
                name="Recency & Momentum",
                raw_value=last_date or "Unknown",
                score=round(recency_score, 1),
                weight=policy.recency_weight,
                weighted_contribution=round(recency_score * policy.recency_weight, 1),
                description=recency_description
            ),
            DecisionFactor(
                name="External Market Signal",
                raw_value=external_signal.get("source", "Not yet fetched") if external_signal else ("Available" if signal_available else "Baseline"),
                score=round(ext_score, 1),
                weight=policy.intent_external_weight,
                weighted_contribution=round(ext_score * policy.intent_external_weight, 1),
                description=ext_description
            )
        ]
        if policy.buying_intent_weight > 0:
            hits = len(intent["strong"]) + len(intent["medium"])
            factors.append(DecisionFactor(
                name="Buying Intent (rep notes)",
                raw_value=f"{hits} intent phrase(s), {len(intent['negative'])} negative",
                score=round(intent["score"], 1),
                weight=policy.buying_intent_weight,
                weighted_contribution=round(intent["score"] * policy.buying_intent_weight, 1),
                description="Deterministic phrase match over rep notes (fixed lexicon); notes are treated as data, never as instructions.",
            ))
        if penalty > 0:
            factors.append(DecisionFactor(
                name="Data Quality Penalty",
                raw_value=", ".join(sorted(t for t in issue_types if t in policy.quality_penalties)),
                score=penalty,
                weight=1.0,
                weighted_contribution=-penalty,
                description="Points deducted per data-quality issue type detected on this record (see policy.quality_penalties).",
            ))

        # Fetch RAG notes evidence
        rag_quotes = self.rag_service.retrieve_evidence(
            query=f"{company_name} capex budget purchase decision timeline",
            opportunity_id=opp.get("opportunity_id"),
            top_k=2
        )
        # If retrieval is unavailable/empty, fall back to the record's own notes -- still with a
        # full source reference (evidence is never returned without one).
        opp_id_for_ref = opp.get("opportunity_id", "")
        notes_used = rag_quotes if rag_quotes else [
            {
                "doc_id": f"{opp_id_for_ref}_note_{i}", "record_id": opp_id_for_ref, "opportunity_id": opp_id_for_ref,
                "source_type": "sales_note", "created_at": None, "company_name": company_name,
                "text": str(n), "snippet": str(n), "relevance": None,
            }
            for i, n in enumerate((opp.get("sales_notes") or [])[:2])
        ]

        provenance = list(opp.get("provenance") or [])
        modeled_basis = opp.get("modeled_basis") or {}
        field_origin = {
            "opportunity_id": "sourced" if is_nested else "record",
            "location": "sourced" if is_nested else "record",
            "deal_value": "estimated" if is_nested else "record",
            "stage": "estimated" if is_nested else "record",
            "win_probability": "estimated" if is_nested else "record",
            "engagement_score": "estimated" if is_nested else "record",
            "last_contact_date": "estimated" if is_nested else "record",
            "owner": "estimated" if is_nested else "record",
        }

        evidence_pack = {
            "structured_data": {
                "opportunity_id": opp.get("opportunity_id"),
                "deal_value": f"${deal_val:,.0f}",
                "stage": opp.get("stage"),
                "owner": opp.get("owner", "Sales Team"),
                "location": opp.get("location") or "US"
            },
            "rag_notes": notes_used,
            "external_signal": external_signal,
            "data_quality": {"issues": issues, "penalty_points": penalty, "confidence": confidence},
            "buying_intent": {k: intent[k] for k in ("score", "strong", "medium", "negative", "definition")},
            "labels": {
                "structured_data": "FACT" if field_origin.get("deal_value") != "estimated" else "PREDICTION",
                "factor_scores": "ANALYSIS",
                "priority_score": "DECISION",
                "external_signal": "EXTERNAL",
                "buying_intent": "ANALYSIS",
            },
            # Sourced facts (each traceable to an entry in `provenance`) vs. our own
            # estimates: every structured field is tagged so nothing estimated can be
            # read as a sourced fact.
            "sourced_facts": opp.get("sourced") or {},
            "modeled_basis": modeled_basis,
            "field_origin": field_origin,
            "provenance": provenance,
        }

        # Outreach draft grounded only in facts already present in the evidence pack --
        # no invented delivery terms, discounts, or commitments (plan section 14.4/17).
        note_line = notes_used[0]["snippet"] if notes_used else None
        email_lines = [
            f"Subject: Following Up -- {company_name}",
            "",
            f"Dear {opp.get('contact_name', 'Team')},",
            "",
            f"I wanted to follow up on where things stand for {company_name} "
            f"({opp.get('stage', 'the current stage')} of our conversation).",
        ]
        if note_line:
            email_lines.append(f"\nFrom our last touchpoint: \"{note_line}\"")
        email_lines += [
            "",
            "Happy to set up a short call this week to go over next steps -- let me know a time that works.",
            "",
            f"Best regards,\n{opp.get('owner', 'Sales Team')}",
        ]
        email_draft = "\n".join(email_lines)

        return RecommendationItem(
            recommendation_id=f"REC-{decision_run_id or 'ADHOC'}-{opp.get('opportunity_id', '000')}",
            decision_run_id=decision_run_id,
            opportunity_id=opp.get("opportunity_id", "0"),
            company_name=company_name,
            contact_name=opp.get("contact_name") or "N/A",
            contact_email=opp.get("contact_email"),
            industry=opp.get("industry") or "Industrial",
            deal_value=deal_val,
            stage=opp.get("stage", "Active"),
            win_probability=win_prob,
            priority_score=priority_score,
            decision_class=decision_class,
            badge_color=badge_color,
            factors=factors,
            evidence_pack=evidence_pack,
            suggested_action=suggested_action,
            action_email_draft=email_draft,
            stale_data_warning=stale_warning,
            external_context_available=signal_available,
            external_context_fetched=was_fetched,
            confidence=confidence,
            review_required=review_required,
            warnings=warnings,
            data_quality_issues=issues,
        )
