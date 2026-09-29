from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import contract_router, simulator_router, decision_router, statement_router
from app.decision_forge import router as decision_forge_router

app = FastAPI(title="Bizpulse AI Service", version="2.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contract_router.router, prefix="/analyze", tags=["Contract Analysis"])
app.include_router(contract_router.router, prefix="", tags=["Contracts Direct"])
app.include_router(simulator_router.router, prefix="/simulate", tags=["Simulation"])
app.include_router(decision_router.router, prefix="/decide", tags=["Decision"])
app.include_router(statement_router.router, prefix="/import", tags=["Statement Import"])
app.include_router(decision_forge_router.router, prefix="/decision-forge", tags=["DecisionForge AI"])

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "bizpulse-ai-engine",
        "version": "2.2.0",
        "features": ["contract_analysis", "loan_simulation", "statement_import", "rag_qa", "decision_forge_ai"]
    }

