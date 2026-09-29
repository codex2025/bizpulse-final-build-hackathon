from fastapi import APIRouter
from app.services.simulator import FinancialSimulator
from app.models.simulation_models import SimulationInput

router = APIRouter()
simulator = FinancialSimulator()

@router.post("/loan")
def simulate_loan(params: SimulationInput):
    return simulator.simulate(params)
