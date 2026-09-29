from fastapi import APIRouter
from app.services.decision_engine import DecisionEngine
from pydantic import BaseModel

router = APIRouter()
engine = DecisionEngine()

class DecisionRequest(BaseModel):
    clauses: list
    simulation: dict
    monthly_income: float = 0

@router.post("/")
def decide(req: DecisionRequest):
    return engine.generate_decision(req.clauses, req.simulation, req.monthly_income)
