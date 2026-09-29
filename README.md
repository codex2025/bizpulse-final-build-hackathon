# Bizpulse / DecisionForge

AI Build Challenge 2026 — **PS-04 Data / Business Intelligence: AI Decision Engine for Business Data.**

Bizpulse is a business workspace (invoicing, expenses, contracts, analytics). Its **DecisionForge AI** module turns
scattered CRM data into **answers, analytics, evidence-backed decisions, explainable recommendations and human-approved
actions** for one concrete persona and task:

> **B2B sales manager — "Which opportunities should our team prioritize right now, why do they matter, and what should we do?"**

## The problem and the approach

CRM data is scattered, duplicated and stale, and teams still decide by gut feeling. DecisionForge:

1. **Checks the data first.** Missing, invalid, conflicting, duplicate and stale records are detected and shown — never silently fixed. They lower the decision's confidence.
2. **Understands the question.** A deterministic intent planner (optionally an LLM constrained to a fixed intent list) maps it to a plan, and only the tools that plan needs are run.
3. **Calculates with code, not a model.** All arithmetic is in deterministic analytics tools; each result carries its source, snapshot time and formula.
4. **Retrieves evidence.** Rep notes are chunked, indexed and retrieved with full source references; if nothing is relevant the answer is "Insufficient evidence."
5. **Decides by a versioned policy.** A configurable weighted score with a visible factor breakdown, a confidence value and warnings.
6. **Lets you test alternatives.** Decision Twin recomputes on a copy of the data, respects rep capacity, and lists its assumptions.
7. **Keeps a human in control.** Draft → Review → Approve / Modify / Reject, with a frozen evidence snapshot, and a step-by-step replay of why.

The LLM is optional and never the source of truth: the whole system works with no API key.

## Architecture

```
React + Vite (5173) --JWT--> NestJS gateway (3001, SQLite) --workspace header--> FastAPI ai-service (8000)
   Decision Center · Twin · Data Quality · Evidence & Audit     runs, approvals, audit,        planner · analytics · RAG ·
                                                                policy, replay                 engine · twin · per-user data
```

Details, status of every component, and known limits: [`docs/DECISIONFORGE_ARCHITECTURE.md`](docs/DECISIONFORGE_ARCHITECTURE.md).
What was found in the original codebase and what changed: [`docs/CODEBASE_AUDIT.md`](docs/CODEBASE_AUDIT.md).

## Datasets

| Key | What | Use |
|---|---|---|
| `real` (default) | 12 real companies that publicly announced new plants/expansions, with cited sources. Public facts are marked **SOURCED**; deal value, win probability etc. are our **ESTIMATES**, each with its basis | Credibility: click through to real citations |
| `synthetic` | 520 generated opportunities, 2,240 activities, 646 notes, 120 customers, 12 reps; fixed seed; planted test cases A–H; fictional names, no URLs or emails | Scale, data-quality handling, evaluation, Decision Twin capacity story |
| `legacy` | 8 fictional flat records | Fallback |

See [`ai-service/data/README-data-provenance.md`](ai-service/data/README-data-provenance.md) (real data methodology and sources) and
[`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

## Run locally

Prerequisites: Python 3.11+, Node 18+. No API key, database server or internet access is required.

```bash
# 1. ai-service  (http://localhost:8000, docs at /docs)
cd ai-service
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                   # optional
uvicorn app.main:app --port 8000

# 2. backend gateway  (http://localhost:3001/api)
cd backend
npm install
npm run start:dev                                      # local SQLite file, seeded demo user

# 3. frontend  (http://localhost:5173)
cd frontend
npm install
npm run dev
```

**Demo login:** `demo@bizpulse.com` / `demo123` (seeded on first start). `docker compose up` is also provided but was not
exercised while preparing this submission.

## Environment variables

| Variable | Where | Purpose | Default |
|---|---|---|---|
| `AI_SERVICE_URL` | backend | ai-service address | `http://localhost:8000` |
| `AI_SERVICE_TOKEN` | backend **and** ai-service | Shared secret; when set, ai-service rejects requests without it | unset (off) |
| `JWT_SECRET` | backend | Token signing | see `.env.example` — **change for any real deployment** |
| `OPENAI_API_KEY` | ai-service | Enables the optional LLM query planner | unset (rules planner) |
| `DECISION_PLANNER_MODEL` | ai-service | Planner model | `gpt-4o-mini` |
| `VITE_API_URL` | frontend | Gateway address | `http://localhost:3001/api` |

## Tests

```bash
cd ai-service && python -m pytest tests -q        # 145 tests
cd backend    && npx jest                          # 22 tests
cd frontend   && npx tsc -b && npx vite build      # typecheck + build (no UI test suite yet)
cd ai-service && python evals/run_eval.py          # workflow evaluation (26 cases, per-metric report)
```

Coverage highlights: data quality and ingestion (valid/invalid/oversized/binary uploads, duplicates, stale, missing),
deterministic analytics, RAG (relevance floor, no cross-record citation, outage), scoring and policy versioning,
missing-data penalty and confidence, Decision Twin (no mutation, capacity limits, correct delta), the LLM planner
(validation, single retry, fallback, injection), tenant isolation (dataset, RAG, fetch state, API, gateway ownership),
approval state machine, replay, prompt injection, demo-reset repeatability. Method and results of the evaluation:
[`docs/AI_EVALUATION.md`](docs/AI_EVALUATION.md).

## Demo

A repeatable 3-minute script with the exact numbers to expect: [`docs/DECISIONFORGE_DEMO.md`](docs/DECISIONFORGE_DEMO.md).

## API (gateway, all authenticated; `/api/decision-forge/...`)

| Method | Path | Purpose |
|---|---|---|
| POST | `decisions/query` | Question → plan → analytics → RAG → answer (with trace) |
| POST | `decide/run` | Ranked recommendations with evidence packs |
| GET | `decisions`, `decisions/:runId`, `decisions/:runId/evidence` | History, replay, evidence |
| POST | `recommendations/:id/review \| approve \| modify \| reject` | Human approval state machine |
| POST | `recommendations/:id/convert-to-client` | Explicit action, only after approval |
| POST | `twin/simulate` | Decision Twin scenario |
| GET | `dataset`, `quality`, `datasets`, `summary` | Data, issues, dataset list, dashboard counts |
| POST | `ingest/file`, `ingest/apply-mapping` | Validate then activate a CSV |
| POST | `reset-demo` | Reload a dataset; `clearHistory: true` also resets runs/approvals/policy (audit log is kept) |
| GET/POST | `policy` | Versioned scoring policy |
| POST | `opportunities/:id/fetch-context` | Optional cited external context (cached snapshot) |
| GET | `audit`, `approvals` | Audit log and reviews |

## Limits, stated plainly

- Retrieval uses hashed bag-of-words embeddings unless `sentence-transformers` is installed; the LLM planner has been tested with a fake client but not against a real model (no key was available).
- Datasets and RAG indexes live in memory (rebuilt on restart); gateway data is SQLite.
- "Fetch fresh context" uses a cached, cited snapshot — not a live crawl — and its relevance weight is a modeled value that the UI labels.
- Estimates in the real dataset are ours, labelled as such; the synthetic dataset is entirely generated.
- Rate limiting is per user on questions only; the ai-service token is optional and off by default locally.
- Developed and tested on Python 3.12 and Node 18+; Python 3.11 compatibility was not tested. Not exercised: `docker compose`, Vercel/Render deployment, mobile layouts, accessibility tooling.

## Repository map

`frontend/` React app · `backend/` NestJS gateway · `ai-service/` FastAPI (`app/decision_forge/` is DecisionForge;
`tests/`, `evals/`) · `docs/` audit, architecture, data model, evaluation, demo · the remaining modules (invoices,
expenses, contracts, wealth, goals) are the original Bizpulse application and were not changed.
