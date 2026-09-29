from app.models.simulation_models import SimulationInput, SimulationOutput

class FinancialSimulator:
    def simulate(self, params: SimulationInput) -> SimulationOutput:
        principal = params.loan_amount
        annual_rate = params.annual_interest_rate / 100
        monthly_rate = annual_rate / 12
        n = params.tenure_months

        if monthly_rate > 0:
            emi = principal * monthly_rate * (1 + monthly_rate) ** n / ((1 + monthly_rate) ** n - 1)
        else:
            emi = principal / n

        total_repayment = emi * n
        total_interest = total_repayment - principal
        missed_3_penalty = principal * (params.penalty_rate / 100) * 3
        credit_impact = -20 if params.missed_payments <= 1 else -50
        affordable_income_needed = emi / 0.40  # EMI should be <= 40% of income

        return SimulationOutput(
            monthly_emi=round(emi, 2),
            total_repayment=round(total_repayment, 2),
            total_interest=round(total_interest, 2),
            missed_3_penalty=round(missed_3_penalty, 2),
            credit_score_impact=credit_impact,
            affordable_income_needed=round(affordable_income_needed, 2),
        )
