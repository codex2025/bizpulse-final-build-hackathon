"""
Deterministic Decision Engine.
Evaluates opportunities using mathematical policy scoring, classification thresholds,
and bundles full provenance into evidence packs.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from app.decision_forge.schemas import PolicyWeights, DecisionFactor, RecommendationItem
from app.decision_forge.external_gateway import ExternalContextGateway
from app.decision_forge.rag_service import NotesRagService


def _engagement_description(engagement: float) -> str:
    """Data-driven description derived from the actual score -- never a fixed claim
    about meetings or stakeholders that the dataset doesn't actually contain."""
    if engagement >= 80:
        return f"Engagement score of {int(engagement)}/100 -- extensive, recent rep-logged interaction with this account."
    if engagement >= 50:
        return f"Engagement score of {int(engagement)}/100 -- moderate, ongoing rep-logged interaction with this account."
    return f"Engagement score of {int(engagement)}/100 -- limited recent interaction logged for this account."


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
        deal_val = float(opp.get("deal_value", 0))
        win_prob = float(opp.get("win_probability", 0.5))
        engagement = float(opp.get("engagement_score", 50))

        # 1. Deal Value Factor (normalized relative to $500k ceiling)
        deal_score = min(100.0, (deal_val / 500000.0) * 100.0)

        # 2. Win Probability Factor (0 to 1 -> 0 to 100)
        prob_score = min(100.0, max(0.0, win_prob * 100.0))

        # 3. Engagement Score Factor
        eng_score = min(100.0, max(0.0, engagement))

        # 4. Recency Score Factor (checks last_contact_date against the dataset snapshot time)
        recency_score = 70.0
        stale_warning = None
        last_date = opp.get("last_contact_date")
        if last_date:
            try:
                dt_part = last_date.replace("Z", "+00:00")
                if len(dt_part) == 10:
                    dt = datetime.strptime(dt_part, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                else:
                    dt = datetime.fromisoformat(dt_part)
                days_diff = (now_ref - dt).days
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

        # Mathematical Deterministic Weighted Sum
        priority_score = (
            (deal_score * policy.deal_value_weight) +
            (prob_score * policy.win_probability_weight) +
            (eng_score * policy.engagement_weight) +
            (recency_score * policy.recency_weight) +
            (ext_score * policy.intent_external_weight)
        )
        priority_score = round(priority_score, 1)

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

        factors = [
            DecisionFactor(
                name="Deal Size Impact",
                raw_value=f"${deal_val:,.0f}",
                score=round(deal_score, 1),
                weight=policy.deal_value_weight,
                weighted_contribution=round(deal_score * policy.deal_value_weight, 1),
                description=f"Represents a ${deal_val:,.0f} revenue potential against team target."
            ),
            DecisionFactor(
                name="Win Likelihood",
                raw_value=f"{int(win_prob * 100)}%",
                score=round(prob_score, 1),
                weight=policy.win_probability_weight,
                weighted_contribution=round(prob_score * policy.win_probability_weight, 1),
                description=f"Current pipeline stage ({opp.get('stage', 'Active')}) yields {int(win_prob * 100)}% historical close rate."
            ),
            DecisionFactor(
                name="Account Engagement",
                raw_value=f"{int(engagement)}/100",
                score=round(eng_score, 1),
                weight=policy.engagement_weight,
                weighted_contribution=round(eng_score * policy.engagement_weight, 1),
                description=_engagement_description(engagement)
            ),
            DecisionFactor(
                name="Recency & Momentum",
                raw_value=last_date or "Unknown",
                score=round(recency_score, 1),
                weight=policy.recency_weight,
                weighted_contribution=round(recency_score * policy.recency_weight, 1),
                description="Pacing is optimal for maintaining deal momentum." if recency_score >= 70 else "Deal pacing has stalled; risk of cold loss."
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

        # Fetch RAG notes evidence
        rag_quotes = self.rag_service.retrieve_evidence(
            query=f"{company_name} capex budget purchase decision timeline",
            opportunity_id=opp.get("opportunity_id"),
            top_k=2
        )
        notes_used = rag_quotes if rag_quotes else [
            {"snippet": n, "company_name": company_name} for n in opp.get("sales_notes", [])[:2]
        ]

        evidence_pack = {
            "structured_data": {
                "opportunity_id": opp.get("opportunity_id"),
                "deal_value": f"${deal_val:,.0f}",
                "stage": opp.get("stage"),
                "owner": opp.get("owner", "Sales Team"),
                "location": opp.get("location", "US")
            },
            "rag_notes": notes_used,
            "external_signal": external_signal
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
            contact_name=opp.get("contact_name", "N/A"),
            contact_email=opp.get("contact_email"),
            industry=opp.get("industry", "Industrial"),
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
        )
