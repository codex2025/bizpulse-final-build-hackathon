from pydantic import BaseModel

class SimulationInput(BaseModel):
    loan_amount: float
    annual_interest_rate: float
    tenure_months: int
    penalty_rate: float = 2.0
    missed_payments: int = 0

class SimulationOutput(BaseModel):
    monthly_emi: float
    total_repayment: float
    total_interest: float
    missed_3_penalty: float
    credit_score_impact: int
    affordable_income_needed: float
