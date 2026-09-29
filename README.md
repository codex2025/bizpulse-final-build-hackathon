# Bizpulse / DecisionForge

AI Build Challenge 2026 — **PS-04 Decision Engine**. Bizpulse is a business-intelligence workspace; its
**DecisionForge AI** module ranks sales opportunities with a deterministic, explainable scoring engine and
traces every recommendation back to cited public data.

## What DecisionForge does

- **Decision engine** — a 5-factor weighted score (deal value, win probability, engagement, recency,
  external signal) classifies each account as `IMMEDIATE_ACTION`, `PROCEED_WITH_QUALIFICATION` or
  `NURTURE_MONITOR`. The same snapshot + policy always yields the same scores.
- **RAG over business data** — rep notes are indexed and retrieved as evidence quotes for each decision.
- **Data-analytics Q&A** — `POST /decision-forge/ask` answers pipeline questions (what to prioritize, who
  has gone cold, highest expected value, weakest region). Answers are computed from the live decision run.
- **Evidence packs** — every recommendation carries its factor breakdown, RAG notes, sourced facts and
  `provenance` (publisher, URL, published date).
- **Fetch-gated external context** — a market signal never changes a score until a user explicitly fetches
  it. Signals are labelled *"Cached validated snapshot (not a live web crawl)"*.
- **Decision Twin** — what-if simulation of outreach volume, rep capacity and deal thresholds.

## Persona and task

An enterprise sales team at an **industrial automation equipment vendor** ranks **real companies that have
publicly announced new plants or major expansions** (Amazon, Eli Lilly, Pirelli, U.S. Steel, FANUC America,
Chobani, Ford, GE Appliances, Toyotetsu Mid America, Hansae Mobility, Hanwha Defense, LEGO Group). An
announced facility is a live capital-equipment buying window. The engine decides who to contact first, and a
human approves the outreach.

## Sourced vs. estimated — the honesty rule

Each record in `ai-service/data/real_industrial_crm.json` has three blocks:

| Block | Contents | Trust |
| --- | --- | --- |
| `sourced` | investment, location, size, announced jobs, timeline | Traceable to a cited URL |
| `modeled` | deal value, win probability, engagement, last contact, stage, notes | **Our estimates / synthetic CRM state**, each with a `_basis` |
| `provenance` | `{claim, publisher, url, published_date, retrieved_date}` | Real, dated citations |

No private CRM data for these companies is public and we do not claim otherwise. Contacts are role
placeholders; no named individuals or email addresses are invented. Details:
[`ai-service/data/README-data-provenance.md`](ai-service/data/README-data-provenance.md).

## Architecture

```
frontend (React + Vite, :5173)
    -> backend (NestJS gateway, :3001)
        -> ai-service (FastAPI, :8000)
              app/decision_forge/
                schema_mapper.py    nested + legacy dataset loading (auto-detected via `dataset_meta`)
                external_gateway.py signals built from each record's provenance; fetch gating
                decision_engine.py  deterministic scoring, evidence packs
                rag_service.py      in-memory vector index over rep notes
                qa.py               computed pipeline Q&A
                decision_twin.py    scenario simulator
                router.py           API, mounted at /decision-forge
```

## Run locally

Prerequisites: Python 3.11+, Node 18+.

```bash
# 1. ai-service  (http://localhost:8000, docs at /docs)
cd ai-service
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# 2. backend gateway  (http://localhost:3001)
cd backend
npm install
cp ../.env.example .env
npm run start:dev

# 3. frontend  (http://localhost:5173)
cd frontend
npm install
npm run dev
```

The ai-service works on its own: try `POST http://localhost:8000/decision-forge/decide/run`.
Everything can also be started with `docker compose up`.

The embedding model (`sentence-transformers`) is optional; without it a deterministic offline fallback
embedding is used, so tests and demos run with no network access.

## Run the tests

```bash
cd ai-service
pip install -r requirements-dev.txt
python -m pytest tests -q
```

The suite covers provenance integrity (including a guard against fake placeholder-domain citations),
determinism, sourced/modeled separation, score spread, stale detection, Q&A, graceful degradation, and the
HTTP API end to end.

## Key endpoints (`/decision-forge`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dataset` | Active records, quality scorecard, `dataset_meta` |
| POST | `/decide/run` | Ranked recommendations with evidence packs |
| POST | `/opportunities/{id}/fetch-context` | Explicitly fetch the cited external signal |
| POST | `/ask` | Computed answer to a pipeline question |
| GET | `/ask/suggestions` | The four suggested questions |
| POST | `/twin/simulate` | Decision Twin scenario |
| POST | `/reset-demo` | Reload the real dataset, clear fetch state |
