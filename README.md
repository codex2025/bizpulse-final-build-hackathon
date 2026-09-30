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
6. **Lets you test alternatives.** Decision Twin recomputes on a copy of the data, respects rep capacity, and lists its assumptions. Use the sliders, or just ask: *"What happens if we add two sales reps?"* The numbers are read from your sentence by deterministic code, checked against the Twin's limits (never rounded to something it accepts) and shown as baseline vs scenario.
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

Prerequisites: Python 3.11+ (3.12 tested) and **Node 20.19+ or 22.12+** (24 tested; NestJS 11 and Vite 8 do not run on Node 18). No API key, database server or internet access is required.

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
cp .env.example .env                                   # set JWT_SECRET (and FIREBASE_PROJECT_ID for Google sign-in)
npm run start:dev                                      # local SQLite file, created EMPTY: no built-in accounts

# 3. frontend  (http://localhost:5173)
cd frontend
npm install
cp .env.example .env                                   # optional: the Firebase web config for Google sign-in
npm run dev
```

### Signing in

There are **no built-in accounts** (the old public `demo@bizpulse.com` / `demo123` login is gone). Open `http://localhost:5173/register` and
**sign up with Google** (once Firebase is configured, below) or with **email and password** (8+ characters). A new account starts empty;
DecisionForge loads its own dataset for every user, so the DecisionForge demo works from the first sign-in.

### Google sign-in (Firebase)

You need a Firebase project (free plan is enough): enable **Authentication > Sign-in method > Google**, add a **Web app** and copy its config into
`frontend/.env` (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`) and the same project id
into `backend/.env` as `FIREBASE_PROJECT_ID`, then restart both servers. `localhost` is an authorised domain by default; add your deployed domain
under *Authentication > Settings > Authorized domains*. Until the values are set the Google button is shown disabled, with an explanation.

Nothing secret is stored on the server: the gateway verifies each Firebase ID token against Google's public keys (signature, project, expiry, verified
email, Google provider) and answers with its own session. Step-by-step setup, how accounts are created and linked, the threat model, and how to test the
whole flow **without a Google account** using the Firebase Auth emulator: [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md) and [`e2e/README.md`](e2e/README.md).

The repository's `docker-compose.yml` does **not** work as it stands (`ai-service/Dockerfile` is empty and the gateway and frontend
have no Dockerfile, and it starts a Postgres and a Redis that nothing uses). Use the commands above; fixing Docker is on the backlog.

## Environment variables

| Variable | Where | Purpose | Default |
|---|---|---|---|
| `AI_SERVICE_URL` | backend | ai-service address: a full URL, or just `host:port` (a missing scheme is read as `http://`) | `http://localhost:8000` |
| `AI_SERVICE_TOKEN` | backend **and** ai-service | Shared secret; when set, ai-service rejects requests without it | unset (off) |
| `JWT_SECRET` | backend | Signs session tokens. **Required in production**: the server refuses to start without a strong, non-placeholder value (32+ characters). In development a random key is used when it is empty, so restarts sign everyone out | empty |
| `FIREBASE_PROJECT_ID` | backend | Firebase project id for Google sign-in (must match `VITE_FIREBASE_PROJECT_ID`). Empty = Google sign-in off, email sign-in still works | empty |
| `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` | frontend build | The Firebase web app config (public identifiers, not secrets). Empty = the Google button is disabled | empty |
| `DATABASE_PATH` | backend | SQLite file for runs, approvals, policy and each user's recoverable workspace state. Put it on a persistent volume in production | `./finsight.db` (`/tmp/finsight.db` on Vercel) |
| `OPENAI_API_KEY` | ai-service | Enables the optional LLM query planner | unset (rules planner) |
| `DECISION_PLANNER_MODEL` | ai-service | Planner model | `gpt-4o-mini` |
| `VITE_API_URL` | frontend | Gateway address | `http://localhost:3001/api` |

## Tests

```bash
cd ai-service && python -m pytest tests -q        # 284 tests
cd backend    && npx jest                          # 199 tests (includes 21 that boot the whole gateway over HTTP)
cd frontend   && npx tsc -b && npx vite build      # typecheck + build (no UI test suite yet)
cd ai-service && python evals/run_eval.py          # workflow evaluation (40 cases, per-metric report)
python scripts/smoke_demo.py                       # HTTP walk of the demo against a running stack, local or deployed (34 checks; 36 with --ai --ai-token)
cd e2e && node google-signin.emulator.js           # Google sign-in in a real browser via the Firebase Auth emulator (see e2e/README.md)
```

Coverage highlights: data quality and ingestion (valid/invalid/oversized/binary uploads, duplicates, stale, missing),
deterministic analytics, RAG (relevance floor, no cross-record citation, outage), scoring and policy versioning,
missing-data penalty and confidence, Decision Twin (no mutation, capacity limits, correct delta), what-if questions in words
(extraction table, bounds never clamped, ambiguity and conflicts, agreement with an independent recomputation, injection),
the LLM planner (validation, single retry, fallback, injection), tenant isolation (dataset, RAG, fetch state, API, gateway
ownership), recovery of a user's workspace after an ai-service restart (dataset, uploaded CSV, fetched context), approval state
machine, replay, prompt injection, demo-reset repeatability, and authentication (real RS256 Firebase-style tokens against every
rule and known attack, account creation and linking, no seeded accounts, no forged sessions, startup guards; some in a real browser).
Method and results of the evaluation: [`docs/AI_EVALUATION.md`](docs/AI_EVALUATION.md).

## Demo

A repeatable 3-minute script with the exact numbers to expect: [`docs/DECISIONFORGE_DEMO.md`](docs/DECISIONFORGE_DEMO.md).

## API

Sign-in (public):

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Email + password sign-up (`email`, `password` 8-72 characters, `full_name`, optional profile fields) |
| POST | `/api/auth/login` | Email + password sign-in |
| POST | `/api/auth/google` | Google sign-up **and** sign-in: body `{ "idToken": <Firebase ID token> }` plus optional profile choices for a new account. Identity comes only from the verified token |

All return `{ access_token, user, is_new_user }`. Everything below needs `Authorization: Bearer <access_token>`.

### DecisionForge (`/api/decision-forge/...`)

| Method | Path | Purpose |
|---|---|---|
| POST | `decisions/query` | Question → plan → analytics → RAG → answer (with trace). A what-if ("what if we add two reps?") runs the Decision Twin and returns a `scenario` block with baseline vs scenario |
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
- Datasets and RAG indexes live in the ai-service's memory, but a user's chosen dataset, uploaded CSV and fetched-context choices are saved by the gateway and rebuilt on demand after an ai-service restart (checked by restarting it against the running stack). That recovery is only as durable as the gateway's SQLite file: on a host that wipes the disk (Vercel `/tmp`, Render's free plan) a restart of the gateway itself still resets everything. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
- What-if questions understand a fixed set of levers (reps, contacts per day, minimum deal value, follow-up window, priority cutoff) in ordinary wording; anything else gets a clear "can't simulate that", not a guess. The Twin's response-window and focus multipliers are stated assumptions, and an answer says when a change comes only from them.
- "Fetch fresh context" uses a cached, cited snapshot — not a live crawl — and its relevance weight is a modeled value that the UI labels.
- Estimates in the real dataset are ours, labelled as such; the synthetic dataset is entirely generated.
- Rate limiting is per user on questions only (none on sign-in); the ai-service token is optional and off by default locally.
- Sign-in limits: no email verification or password reset for email accounts, sessions cannot be revoked before their 7 days are up, and the token lives in `localStorage`. Google sign-in was verified end to end only against the Firebase Auth **emulator** (fake Google accounts, real browser); a real Google account against your real Firebase project is the one step left for you. See [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md).
- The finance dashboard (not DecisionForge) assumes a baseline monthly income (₹2,20,000 business, ₹1,50,000 otherwise) for an account that has entered none, so a brand-new account sees revenue figures it never had. Pre-existing; it was hidden while a seeded demo user always had data.
- Developed and tested on Windows with Python 3.12 and Node 24. A clean install (pinned `requirements-dev.txt`, `npm ci`) of a copy of the working tree was built and tested, and the compiled gateway was run in production mode with the service token enforced. Not exercised: Python 3.11, Node 20/22, macOS/Linux, `docker compose`, the Vercel/Render deployments, mobile layouts, accessibility tooling.

## Deployment

Recommended: two long-running services (the gateway and the ai-service) plus a static frontend. What was verified locally, what still has to
be confirmed on a real host, the settings each service needs, and the trade-offs of serverless are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
`python scripts/smoke_demo.py --gateway https://<your-gateway>/api` is the acceptance test after deploying.

## Repository map

`frontend/` React app · `backend/` NestJS gateway · `ai-service/` FastAPI (`app/decision_forge/` is DecisionForge;
`tests/`, `evals/`) · `e2e/` Google sign-in checks against the Firebase Auth emulator · `scripts/` smoke test · `docs/` audit,
architecture, data model, evaluation, demo, deployment, authentication · the remaining modules (invoices, expenses, contracts,
wealth, goals) are the original Bizpulse application and were not changed, apart from the sign-in path (`auth/`, `users/`) and the dashboard greeting.
