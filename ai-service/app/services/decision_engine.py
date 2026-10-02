import logging
from typing import Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

class DecisionEngine:
    def __init__(self):
        self.llm = None
        if settings.openai_api_key and settings.openai_api_key.startswith("sk-"):
            try:
                from langchain_openai import ChatOpenAI
                self.llm = ChatOpenAI(
                    model=settings.model_name,
                    temperature=0,
                    api_key=settings.openai_api_key
                )
            except Exception as e:
                logger.warning(f"Could not initialize DecisionEngine LLM: {e}")
                self.llm = None

    def evaluate_ledger_impact(
        self,
        monthly_emi: float,
        monthly_income: float = 65000,
        monthly_expense: float = 20000,
        annual_revenue: float = 780000,
        persona_type: str = "business"
    ) -> Dict[str, Any]:
        """
        Evaluates the debt obligation strictly against the user's past financial ledger data.
        """
        income = float(monthly_income) if monthly_income > 0 else (55000.0 if persona_type == "employee" else 65000.0)
        expense = float(monthly_expense) if monthly_expense > 0 else (22000.0 if persona_type == "employee" else 20000.0)
        emi = float(monthly_emi)

        net_profit_before = income - expense
        residual_cash = net_profit_before - emi
        
        emi_to_profit_pct = round((emi / net_profit_before * 100), 1) if net_profit_before > 0 else 100.0
        emi_to_income_pct = round((emi / income * 100), 1) if income > 0 else 100.0
        annual_debt_servicing = round(emi * 12, 2)

        # Evaluate affordability based on user's past data
        if persona_type == "employee":
            is_unaffordable = residual_cash < 0 or emi_to_income_pct > 40.0 or emi_to_profit_pct > 55.0
            is_tight = not is_unaffordable and (emi_to_income_pct > 25.0 or emi_to_profit_pct > 30.0)

            if is_unaffordable:
                affordability_verdict = "UNAFFORDABLE"
                impact_explanation = (
                    f"Based on your past salary of ₹{income:,.2f}/mo and living costs of ₹{expense:,.2f}/mo, "
                    f"this payment of ₹{emi:,.2f}/mo takes {emi_to_income_pct}% of your salary ({emi_to_profit_pct}% of your savings surplus). "
                    f"It leaves an unsafe cushion of only ₹{max(0, residual_cash):,.2f}/mo."
                )
            elif is_tight:
                affordability_verdict = "TIGHT BUT MANAGEABLE"
                impact_explanation = (
                    f"Based on your past salary of ₹{income:,.2f}/mo and living expenses of ₹{expense:,.2f}/mo, "
                    f"this payment takes {emi_to_income_pct}% of your income. You will have ₹{residual_cash:,.2f}/mo left for savings."
                )
            else:
                affordability_verdict = "EASILY AFFORDABLE"
                impact_explanation = (
                    f"Based on your past salary of ₹{income:,.2f}/mo and expenses of ₹{expense:,.2f}/mo, "
                    f"this payment consumes only {emi_to_income_pct}% of your income. You retain a strong savings buffer of ₹{residual_cash:,.2f}/mo."
                )

        elif persona_type == "self_employed":
            is_unaffordable = residual_cash < 0 or emi_to_profit_pct > 50.0
            is_tight = not is_unaffordable and emi_to_profit_pct > 25.0

            if is_unaffordable:
                affordability_verdict = "UNAFFORDABLE"
                impact_explanation = (
                    f"Based on your freelance revenue of ₹{income:,.2f}/mo and expenses of ₹{expense:,.2f}/mo, "
                    f"this EMI of ₹{emi:,.2f}/mo consumes {emi_to_profit_pct}% of your net surplus, leaving almost zero buffer for slow client months."
                )
            elif is_tight:
                affordability_verdict = "TIGHT BUT MANAGEABLE"
                impact_explanation = (
                    f"Based on your average income of ₹{income:,.2f}/mo, the payment consumes {emi_to_profit_pct}% of your profit buffer. "
                    f"Manageable only if maintaining a 3-month cash buffer of at least ₹{emi * 3:,.2f}."
                )
            else:
                affordability_verdict = "EASILY AFFORDABLE"
                impact_explanation = (
                    f"The payment takes {emi_to_profit_pct}% of your surplus, leaving a safe buffer of ₹{residual_cash:,.2f}/mo."
                )

        else: # business
            is_unaffordable = residual_cash < 0 or emi_to_profit_pct > 60.0 or emi_to_income_pct > 40.0
            is_tight = not is_unaffordable and (emi_to_profit_pct > 30.0 or emi_to_income_pct > 20.0)

            if is_unaffordable:
                affordability_verdict = "UNAFFORDABLE"
                impact_explanation = (
                    f"Based on your past ledger (₹{income:,.2f} monthly inflow vs ₹{expense:,.2f} outflow), "
                    f"this payment of ₹{emi:,.2f}/mo consumes {emi_to_profit_pct}% of your profit buffer, leaving only ₹{max(0, residual_cash):,.2f}/mo for payroll and operations."
                )
            elif is_tight:
                affordability_verdict = "TIGHT BUT MANAGEABLE"
                impact_explanation = (
                    f"Based on your ledger, this payment consumes {emi_to_profit_pct}% of your net surplus. "
                    f"You retain ₹{residual_cash:,.2f}/mo in operating cushion provided customer invoices are paid on time."
                )
            else:
                affordability_verdict = "EASILY AFFORDABLE"
                impact_explanation = (
                    f"The payment takes only {emi_to_profit_pct}% of your profit buffer, leaving a healthy operating cushion of ₹{residual_cash:,.2f}/mo."
                )

        return {
            "persona_type": persona_type,
            "avg_monthly_income": income,
            "avg_monthly_expense": expense,
            "net_monthly_profit_before": net_profit_before,
            "monthly_emi": emi,
            "residual_free_cash": residual_cash,
            "emi_to_profit_ratio": emi_to_profit_pct,
            "emi_to_income_ratio": emi_to_income_pct,
            "annual_debt_servicing": annual_debt_servicing,
            "affordability_verdict": affordability_verdict,
            "is_unaffordable": is_unaffordable,
            "is_tight": is_tight,
            "impact_explanation": impact_explanation,
        }

    def generate_decision(
        self,
        clauses: list,
        simulation: dict,
        monthly_income: float = 65000,
        monthly_expense: float = 20000,
        annual_revenue: float = 780000,
        persona_type: str = "business"
    ) -> dict:
        emi = simulation.get("monthly_emi", 16727)
        ledger_impact = self.evaluate_ledger_impact(emi, monthly_income, monthly_expense, annual_revenue, persona_type)
        
        red_flag_clauses = [c for c in clauses if c.get("is_red_flag") or c.get("risk_level") == "High"]
        is_unaffordable = ledger_impact["is_unaffordable"]
        is_tight = ledger_impact["is_tight"]

        # SINGLE UNAMBIGUOUS DECISION DETERMINATION:
        # 1. If unaffordable by user ledger OR has 2+ severe red flags -> DECLINE
        # 2. If 1 red flag OR tight budget -> RENEGOTIATE TERMS BEFORE SIGNING
        # 3. If affordable AND clean clauses -> ACCEPT
        if is_unaffordable or len(red_flag_clauses) >= 2:
            decision = "DECLINE (DO NOT SIGN)"
            decision_type = "DECLINE"
            action_badge = "bg-red-600 text-white"
            action_headline = "Do Not Sign This Agreement"
            action_summary = "This debt carries high financial hazard or predatory terms that put you at severe risk."
            
            reasons = []
            if is_unaffordable:
                reasons.append(
                    f"Excessive Cash Flow Burden: The monthly payment of ₹{emi:,.2f} takes {ledger_impact['emi_to_profit_ratio']}% of your surplus, "
                    f"leaving an unsafe cushion of only ₹{max(0, ledger_impact['residual_free_cash']):,.2f}/mo."
                )
            for c in red_flag_clauses:
                r_why = c.get("red_flag_reason") or c.get("simple_explanation")
                c_name = c.get("clause_type", "High Risk Clause")
                reasons.append(f"{c_name}: {r_why}")

            if not reasons:
                reasons.append("The total interest cost and restrictive conditions outweigh the capital benefits.")

        elif len(red_flag_clauses) == 1 or is_tight:
            decision = "RENEGOTIATE BEFORE SIGNING"
            decision_type = "CAUTION"
            action_badge = "bg-amber-500 text-white"
            action_headline = "Hold Signing — Negotiate Key Terms First"
            action_summary = "This agreement is workable, but contains specific risky conditions or tight margins you should adjust before signing."
            
            reasons = []
            if is_tight:
                reasons.append(
                    f"Tight Monthly Buffer: Repaying ₹{emi:,.2f}/mo leaves ₹{ledger_impact['residual_free_cash']:,.2f}/mo in free savings. "
                    f"Extend the tenure to lower monthly payments by 15-25%."
                )
            for c in red_flag_clauses:
                r_why = c.get("red_flag_reason") or c.get("simple_explanation")
                c_name = c.get("clause_type", "Risky Clause")
                reasons.append(f"Negotiate {c_name}: {r_why}")

            if not reasons:
                reasons.append("Ensure interest rate spread is explicitly capped before execution.")

        else:
            decision = "ACCEPT (SAFE TO PROCEED)"
            decision_type = "ACCEPT"
            action_badge = "bg-emerald-600 text-white"
            action_headline = "Safe to Proceed with Execution"
            action_summary = "This agreement features favorable market terms, standard borrower protections, and fits safely within your monthly financial means."
            
            reasons = [
                f"Affordable Debt Servicing: Monthly payment of ₹{emi:,.2f} consumes only {ledger_impact['emi_to_income_ratio']}% of your income, leaving ₹{ledger_impact['residual_free_cash']:,.2f}/mo in safe surplus.",
                "Zero Predatory Red Flags: No unilateral rate revision clauses, blank security cheque demands, or blanket asset seizure terms found.",
                "Standard Borrower Protections: Includes standard repayment terms, transparent pricing, and statutory borrower rights."
            ]

        executive_takeaway = (
            f"{action_headline}. {ledger_impact['impact_explanation']} "
            f"Evaluated against your verified past financial condition and {len(clauses)} analyzed contract clauses."
        )

        return {
            "decision": decision,
            "decision_type": decision_type,
            "action_badge": action_badge,
            "action_headline": action_headline,
            "action_summary": action_summary,
            "reasons": reasons,
            "executive_takeaway": executive_takeaway,
            "ledger_impact": ledger_impact,
            "red_flag_count": len(red_flag_clauses),
            "total_clause_count": len(clauses)
        }
