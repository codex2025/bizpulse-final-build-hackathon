# Bizpulse — an AI Decision Engine for Business Data

**Build Fast with AI · AI Build Challenge 2026 · PS-04 Data / Business Intelligence**

Bizpulse answers one question for a B2B sales team: **which deals should we work on first, why, and what should we do about each one?**
It checks the data, calculates with code, retrieves the notes that support each recommendation, lets you simulate alternatives,
and waits for a human to approve.

| | |
|---|---|
| **Live app** | https://bizpulse-app-rust.vercel.app |
| **Scan to open** | <img src="docs/bizpulse-live-qr.png" width="140" alt="QR code for the live app"> |
| **Source** | https://github.com/codex2025/bizpulse-final-build-hackathon |

**Contents:** [Project overview](#1-project-overview) · [Try it in 3 minutes](#2-try-it-in-3-minutes) ·
[How it meets the brief](#3-how-it-meets-the-brief) · [Technologies used](#4-technologies-used) ·
[Repository layout](#5-repository-layout) · [Setup and installation](#6-setup-and-installation) ·
[How to run](#7-how-to-run-the-project) · [Your data](#8-your-data-the-csv-format) · [Tests and code quality](#9-tests-and-code-quality) ·
[Configuration](#10-configuration) · [Deployment](#11-deployment) · [Limits](#12-limits-stated-plainly)

---

## 1. Project overview

### The task we were given

> **PS-04: AI Decision Engine for Business Data.** Build a system that uses **RAG over business data**, **data analytics agents**
> and **decision-making agents** to turn scattered business data into decisions a person can trust.

### What we built

CRM data is scattered, duplicated and stale, and teams still decide by gut feeling. Bizpulse's **DecisionForge** module takes a list
of sales opportunities and runs them through seven steps:

1. **Checks the data first.** Missing, invalid, conflicting, duplicate and stale records are found and shown, never silently fixed. They lower the confidence of the decision.
2. **Understands the question.** A rules-based planner maps a plain-English question to a fixed list of intents and runs only the tools that question needs.
3. **Calculates with code, not a model.** All arithmetic is in analytics functions. Each result carries its source, snapshot time and formula.
4. **Retrieves evidence.** Sales notes are chunked, indexed and retrieved with their source record. If nothing relevant exists, the answer is "Insufficient evidence."
5. **Decides by a versioned policy.** A weighted score with a visible factor breakdown, a confidence value and warnings.
6. **Simulates alternatives.** The Decision Twin recomputes on a copy of the data. Use the sliders or ask in words: *"What happens if we add two sales reps?"*
7. **Keeps a human in control.** Draft → Review → Approve / Modify / Reject, with a frozen evidence snapshot and a step-by-step replay of how the decision was made.

**The language model is optional and never the source of truth.** The whole system runs with no API key, no database server and
no internet access.

Bizpulse also contains invoicing, expenses, contract review, analytics, goals and net-worth pages. They are part of the product,
but DecisionForge is the submission for this brief.

```
React + Vite  ──JWT──►  NestJS gateway (SQLite)  ──workspace id──►  FastAPI ai-service
 Get started · Decision Center      runs, approvals, policy,            planner · analytics · RAG ·
 Decision Twin · Data Quality       audit log, replay,                  decision engine · Decision Twin
 Evidence & Audit                   sign-in                             (per-user data, in memory)
```

---

## 2. Try it in 3 minutes

1. Open the [live app](https://bizpulse-app-rust.vercel.app) and choose **Sign up**. Email and password is enough (8+ characters). On a laptop a short product tour starts by itself (use **Next** / **Back**, or skip it); on a phone it does not, and you can start it from Help or by asking the assistant.
2. A new account is **empty**. Open **DecisionForge** in the sidebar. The *Start here* screen offers two ways in:
   - **Download sample CSV**, then upload it. You will see the column matching and the data-quality report before anything is used.
   - **No file? Use our sample dataset** if you would rather not handle a file. Nothing loads unless you click.
   - **Start Over** (top right, once data is loaded) returns to the empty start screen.
3. **Decision Center:** ask *"Which opportunities should we prioritize today?"* and read the ranked list. Open **View Evidence** on the top deal to see the score formula, the factors and the cited notes.
4. **Decision Twin:** move the sliders (sales reps, contacts per day, minimum deal value), or ask *"What happens if we add two sales reps?"* to compare baseline and scenario.
5. **Review & Approve** a recommendation, then open **Evidence & Audit → Replay** to see every step that produced it.
6. **Ask Bizpulse** (bottom right, on every page): type or press the microphone and ask *"Which deals should we prioritise today?"*, *"Who owes me money?"* or *"Show me around"*. It answers from your data, reads the answer aloud and opens the matching page.

The exact numbers to expect at each step: [`docs/DECISIONFORGE_DEMO.md`](docs/DECISIONFORGE_DEMO.md).

> The live site stores accounts and decisions in a hosted Postgres database, so they persist between visits.

---

## 3. How it meets the brief

| The brief asks for | What we built | Where it is in the code |
|---|---|---|
| **RAG over business data** | Sales notes are chunked, indexed and retrieved per opportunity with source ids, a relevance floor, and "Insufficient evidence" when nothing fits | `ai-service/app/decision_forge/rag_service.py`, `intent.py` |
| **Data analytics agents** | Eight analytics tools (pipeline summary, expected value, stale deals, rep capacity and more), chosen by a planner from a fixed intent list; every number comes from code | `ai-service/app/decision_forge/analytics.py`, `planner.py`, `query_pipeline.py` |
| **Decision-making agents** | A versioned scoring policy combines the metrics, the evidence and the data quality into a ranked recommendation with reasons, confidence and warnings | `ai-service/app/decision_forge/decision_engine.py`, `policies.py`, `schemas.py` |
| Messy real-world data | Upload a CSV; columns are matched automatically; missing, duplicate, stale and invalid records are reported before the data is used | `ai-service/app/decision_forge/schema_mapper.py`, `quality_engine.py`; `frontend/src/components/decision-forge/GetStarted.tsx`, `DataIngestionTab.tsx` |
| Explainable results | Evidence pack: score formula, factor breakdown, cited notes, fact / estimate labels | `frontend/src/components/decision-forge/EvidenceDrawer.tsx`, `DecisionCenterTab.tsx` |
| What-if analysis | Decision Twin: baseline and scenario run through the same model; what-if questions in words are parsed by code and refused if out of range | `ai-service/app/decision_forge/decision_twin.py`, `scenario_parser.py`; `frontend/.../DecisionTwinTab.tsx` |
| Human in the loop | Approval state machine with ownership checks; nothing is acted on without an explicit approval | `backend/src/decision-forge/decision-forge.service.ts`; `frontend/.../ApprovalModal.tsx` |
| Audit and replay | Every run, question, approval and dataset change is logged; a run can be replayed step by step | `backend/src/decision-forge/`, `frontend/.../AuditTrailTab.tsx` |
| Safety | Notes are treated as data, never as instructions; the model cannot query the database or supply a number; each user's data is isolated | `ai-service/app/decision_forge/planner.py` (the model sees only the question), `workspace.py` (per-user data), `security.py` (service token) |
| An agent over the whole product | **Ask Bizpulse**: a chat and voice assistant on every page. A free OpenRouter model (optional) reads only the question and picks from eleven fixed tools (and, for a sales question, one of nine fixed topics); the tools are the project's own code (decision engine, invoices, expenses, contracts, goals, net worth, forecast), run for the signed-in user. It opens the matching page and can walk through every page. With no key or no quota it routes by keywords and still answers | `backend/src/assistant/` (`assistant.catalog.ts` tools and rules, `assistant.service.ts`); `frontend/src/components/assistant/AssistantWidget.tsx`, `frontend/src/utils/speech.ts` |
| Evaluation | 40 scripted cases (25 representative, 15 adversarial) scored for success, grounding, determinism and recovery | `ai-service/evals/`, [`docs/AI_EVALUATION.md`](docs/AI_EVALUATION.md) |

Architecture in detail: [`docs/DECISIONFORGE_ARCHITECTURE.md`](docs/DECISIONFORGE_ARCHITECTURE.md).

---

## 4. Technologies used

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS, TanStack Query, React Router, Recharts, Framer Motion |
| API gateway | NestJS 11 (Node.js, TypeScript), TypeORM, SQLite (`better-sqlite3`) or Postgres (`pg`), Passport JWT |
| AI service | Python, FastAPI, Pydantic, Uvicorn; PyMuPDF / pdfplumber / python-docx for contract files |
| Retrieval (RAG) | In-process index with hashed bag-of-words vectors and a lexical rerank; no external vector database |
| Language model | Optional and never the source of a number. The assistant uses free OpenRouter models (`nvidia/nemotron-3-super-120b-a12b:free`, then `google/gemma-4-31b-it:free`, then `qwen/qwen3.8-27b:free`) to choose tools; DecisionForge can use OpenAI (`gpt-4o-mini`) to classify a question. Both fall back to rules |
| Voice | The browser's Web Speech API: speech recognition to hear, speech synthesis to reply. No key and no audio handled by our servers |
| Sign-in | Google through Firebase Authentication (ID token verified on the gateway with `jose`), or email and password (`bcryptjs`) |
| Tests | pytest, Jest + Supertest, Vitest, Playwright |
| Hosting | Vercel (frontend, gateway and AI service as three projects) with Neon Postgres; `render.yaml` for Render |

---

## 5. Repository layout

```
.
├── README.md                  you are here
├── frontend/                  React app
│   ├── src/components/
│   │   ├── decision-forge/    the DecisionForge screens (start screen, Decision Center, Twin, Data Quality, Audit)
│   │   ├── dashboard/ billing/ expenses/ contracts/ analytics/ goals/ wealth/ settings/
│   │   ├── auth/ landing/ tour/ common/
│   ├── src/services/          API clients (decisionForgeService.ts, authService.ts, ...)
│   └── public/sample-data/    crm_opportunities_sample.csv (the sample file the app offers)
├── backend/                   NestJS gateway
│   └── src/
│       ├── decision-forge/    runs, approvals, policy, audit, replay, workspace recovery
│       ├── assistant/         Ask Bizpulse: tool list, keyword rules, optional OpenRouter planner
│       ├── auth/ users/       Google and email sign-in
│       └── analytics/ invoices/ expenses/ clients/ contracts/ goals/ wealth/
├── ai-service/                FastAPI service
│   ├── app/decision_forge/    planner, analytics, RAG, decision engine, Decision Twin, data quality
│   ├── app/routers/ services/ contract analysis and simulators
│   ├── data/                  the sample dataset and where every fact in it comes from
│   ├── tests/                 pytest suite
│   └── evals/                 the 40-case workflow evaluation
├── e2e/                       Playwright UI audit and Google sign-in checks
├── scripts/smoke_demo.py      end-to-end check of a running stack (local or deployed)
├── docs/                      architecture, data model, evaluation, demo script, deployment, authentication
└── render.yaml                deployment blueprint for Render
```

---

## 6. Setup and installation

**You need:** Python 3.11 or newer (3.12 tested) and Node.js 20.19+ or 22.12+ (24 tested). No API key, database server or Docker.

```bash
git clone https://github.com/codex2025/bizpulse-final-build-hackathon.git
cd bizpulse-final-build-hackathon
```

**AI service**

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
```

**Gateway**

```bash
cd backend
npm install
cp .env.example .env                 # Windows: copy .env.example .env
```

Open `backend/.env` and set `JWT_SECRET` to any long random string, so that restarting the gateway does not sign you out.

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env                 # optional: only needed for Google sign-in
```

Google sign-in is optional. Without the Firebase values the Google button is shown disabled and email sign-up works as normal.
To turn it on with your own Firebase project, follow [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md).

---

## 7. How to run the project

Start the three services in three terminals, in this order:

```bash
# Terminal 1: AI service  → http://localhost:8000  (API docs at /docs)
cd ai-service && python -m uvicorn app.main:app --port 8000

# Terminal 2: gateway     → http://localhost:3001/api
cd backend && npm run start:dev

# Terminal 3: frontend    → http://localhost:5173
cd frontend && npm run dev
```

Then open **http://localhost:5173/register**, create an account, and follow [Try it in 3 minutes](#2-try-it-in-3-minutes).

There are **no built-in accounts**; the database is created empty on first start.

To check that everything is wired together:

```bash
python scripts/smoke_demo.py         # signs up its own account and walks the whole decision flow over HTTP
```

---

## 8. Your data: the CSV format

One row per sales opportunity. Column names are matched loosely ("Account", "Amount" and "Rep" also work), and you review the
matching before the data is used. Limits: 2 MB, 5,000 rows, UTF-8 text.

| Column | What goes in it | Needed |
|---|---|---|
| Company Name | Who the deal is with | Core |
| Deal Value | Amount in USD, for example `340000` | Core |
| Win Probability | `0.85` or `85%` | Core |
| Stage | For example `Proposal Review` | Recommended |
| Last Contact Date | `YYYY-MM-DD`; old dates are flagged as stale | Recommended |
| Engagement Score | 0 to 100 | Recommended |
| Owner | Sales rep, used for the capacity calculation | Recommended |
| Sales Notes | Free text. This is the evidence the engine retrieves and cites | Recommended |
| Opportunity ID, Contact Name, Industry, Location | Optional detail | Optional |

A file is accepted when the company column and at least three other columns are recognised. A blank cell is reported as
*missing*; it is never filled in with a guess.

**Sample files**

| File | What it is |
|---|---|
| [`frontend/public/sample-data/crm_opportunities_sample.csv`](frontend/public/sample-data/crm_opportunities_sample.csv) | 40 fictional deals in the format above, including a duplicate, a missing probability, a stale deal and an invalid amount, so the data-quality report has something to show. The app's **Download sample CSV** button serves this file. |
| [`ai-service/data/real_industrial_crm.json`](ai-service/data/real_industrial_crm.json) | The one-click sample dataset: 12 real companies that publicly announced new plants, each fact with its source. Deal value and win probability are our estimates and are labelled as such. Method and sources: [`ai-service/data/README-data-provenance.md`](ai-service/data/README-data-provenance.md). |
| Synthetic dataset (generated in code) | 520 opportunities with a fixed seed, used for scale, tests and the Decision Twin capacity story. `ai-service/app/decision_forge/synthetic.py` |
| [`ai-service/test_data/`](ai-service/test_data/) | Sample loan agreements for the Contracts page. |

Data model: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

---

## 9. Tests and code quality

```bash
cd ai-service && python -m pytest tests -q        # 289 tests: analytics, RAG, scoring, Twin, data quality, isolation, injection
cd ai-service && python evals/run_eval.py         # 40-case workflow evaluation
cd ai-service && python -m ruff check .           # lint: undefined names, unused imports and variables
cd backend    && npx jest                         # 222 tests: approvals, replay, sign-in, workspace recovery, assistant
cd backend    && npx eslint "src/**/*.ts" --quiet # lint and formatting (Prettier): no errors
cd frontend   && npx eslint . --quiet             # lint: no errors
cd frontend   && npm test                         # 21 unit tests of the pure logic
cd frontend   && npx tsc -b && npx vite build     # typecheck and build
cd e2e        && npx playwright test              # UI audit on desktop and phone sizes (needs the stack running)
python scripts/smoke_demo.py                      # end-to-end check over HTTP (add --gateway <url>/api for a deployed stack)
```

Evaluation results on the 40 cases: success 1.00, hallucination 0.00, determinism 1.00, data accuracy 1.00, recovery 1.00.
Method and per-case detail: [`docs/AI_EVALUATION.md`](docs/AI_EVALUATION.md).

---

## 10. Configuration

Every variable is optional for a local run except `JWT_SECRET` in production.

| Variable | Where | Purpose | Default |
|---|---|---|---|
| `JWT_SECRET` | backend | Signs session tokens. Production refuses to start without a strong value (32+ characters). In development a random key is used when it is empty | empty |
| `AI_SERVICE_URL` | backend | Address of the AI service (full URL or `host:port`) | `http://localhost:8000` |
| `AI_SERVICE_TOKEN` | backend and ai-service | Shared secret between the two services. When set, the AI service rejects requests without it | unset |
| `DATABASE_URL` | backend | Postgres connection string. When set, the gateway uses Postgres instead of SQLite. Needed on serverless hosts, where several copies of the gateway run at once | unset |
| `DATABASE_PATH` | backend | SQLite file (used when `DATABASE_URL` is unset). Put it on a persistent disk in production | `./finsight.db` |
| `CORS_ORIGINS` | backend | Comma-separated browser origins allowed to call the API (the deployed frontend). Unset allows every origin, for local development | unset |
| `FIREBASE_PROJECT_ID` | backend | Firebase project for Google sign-in. Empty turns Google sign-in off | empty |
| `VITE_API_URL` | frontend | Gateway address | `http://localhost:3001/api` |
| `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` | frontend | Firebase web config (public identifiers, not secrets) | empty |
| `OPENROUTER_API_KEY` | backend | Turns on AI understanding in the assistant (free models). Without it the assistant routes by keywords | unset |
| `ASSISTANT_MODELS` | backend | Comma-separated OpenRouter model ids to try in order (up to three) | the three free models above |
| `ASSISTANT_LLM_WRITER` | backend | `1` lets the model rephrase the answer; its text is discarded if it contains a number that is not in the facts | off |
| `OPENAI_API_KEY` | ai-service | Turns on the optional language-model question planner | unset |
| `DECISION_PLANNER_MODEL` | ai-service | Planner model | `gpt-4o-mini` |

---

## 11. Deployment

The live site runs as three Vercel projects: the frontend, the gateway (`backend/vercel.json`) and the AI service
(`ai-service/vercel.json`). `render.yaml` describes the same stack as two long-running services on Render, which is the better
fit because the gateway's database then lives on a real disk.

After any deployment, the acceptance check is:

```bash
python scripts/smoke_demo.py --gateway https://<your-gateway>/api
```

Settings for each service and the trade-offs: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 12. Limits, stated plainly

- **Storage.** The live gateway uses a hosted Postgres database (`DATABASE_URL`). A local run uses a SQLite file. The schema is created automatically (`synchronize`), not by migrations.
- **Google sign-in** was verified end to end against the Firebase Auth emulator in a real browser, not with a real Google account on the live site. Email sign-up always works.
- **Retrieval** uses hashed bag-of-words vectors with a lexical rerank, so it matches on wording rather than meaning.
- **The language-model planner** was tested only with a fake client; no API key was available. The rules planner is what runs.
- **What-if questions** understand a fixed set of levers (reps, contacts per day, minimum deal value, follow-up window, priority cutoff). Anything else gets a clear "can't simulate that".
- **"Fetch fresh context"** reads a cached, cited snapshot, not a live web crawl.
- **The assistant.** Without `OPENROUTER_API_KEY`, or when the free daily quota is used up, it routes by keywords, so unusual wording may land on the general help answer. Each question is answered on its own (it does not remember the previous one). Voice input needs a browser with speech recognition (Chrome, Edge, Safari); the browser, not this app, sends the audio to its speech service. In Firefox the microphone button is hidden and typing still works.
- **Sign-in hardening is partial.** Five wrong passwords for one address pause sign-in for that address for 15 minutes (counted per server copy, so it slows guessing rather than locking an account), responses carry security headers (`helmet`), and the API only accepts browser calls from the deployed frontend. There is no email verification or password reset, and the session token is kept in `localStorage`.
- **Typing.** Request bodies in the gateway and the AI service's JSON are not fully typed: `any` is allowed there, and the lint rules that follow from it report as warnings (about 950), not errors.
- **Not tested:** Python 3.11, Node 20 and 22, macOS and Linux, Docker.

---

## More documentation

| Document | What it covers |
|---|---|
| [`docs/DECISIONFORGE_ARCHITECTURE.md`](docs/DECISIONFORGE_ARCHITECTURE.md) | Components, data flow, status of each part |
| [`docs/DECISIONFORGE_DEMO.md`](docs/DECISIONFORGE_DEMO.md) | The demo script with expected numbers |
| [`docs/AI_EVALUATION.md`](docs/AI_EVALUATION.md) | Evaluation method and results |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Entities and datasets |
| [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md) | Sign-in design, Firebase setup, threat model |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Hosting options and settings |
| [`docs/CODEBASE_AUDIT.md`](docs/CODEBASE_AUDIT.md) | What the original codebase had and what changed |
| `http://localhost:8000/docs` | Interactive API reference for the AI service (when running locally) |
