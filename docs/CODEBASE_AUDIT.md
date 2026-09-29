# Codebase Audit — Bizpulse / DecisionForge

Audit date: 2026-09-29 · Commit audited: `a973ea8` (branch `praveen`).

> Sections 1-8 describe the code **as audited, before remediation**. The **remediation log at the end** records what
> was changed since, what further defects were found while doing it, and what is still open.
Method: read the code and ran the stack locally (ai-service :8000, NestJS :3001, Vite :5173). Nothing below
is inferred from UI labels; each claim was traced to a file or a live call.

Legend: **IMPLEMENTED** (real code path, exercised) · **PARTIAL** · **MOCKED** · **ABSENT**.

## 1. Architecture as it actually is

```
React/Vite (5173) ──axios──▶ NestJS gateway (3001, /api, JWT, SQLite via TypeORM)
                                   │  axios (no auth, no tenant header)
                                   ▼
                          FastAPI ai-service (8000)
                          app/decision_forge/*   ← deterministic engine, in-memory state
                          app/routers, services  ← contracts/statements/loan (OpenAI-based, unrelated)
```

- **Frontend** (`frontend/src`): 9 routes under `/*` (dashboard, `/decision-forge`, billing, expenses,
  contracts, analytics, goals, wealth, settings) plus landing/auth. DecisionForge is one page with four tabs:
  Decision Center, Decision Twin, Data Ingestion, Audit Trail.
- **Backend** (`backend/src`): NestJS modules for auth, users, clients, invoices, expenses, goals, wealth,
  analytics, contracts, statement, decision-forge. SQLite (`better-sqlite3`) with `synchronize: true`.
- **ai-service**: FastAPI. Two unrelated halves: (a) contracts/statements/loan simulation using OpenAI;
  (b) `decision_forge/`, which uses **no LLM at all**.

## 2. DecisionForge — what is real

| Capability | Status | Evidence |
|---|---|---|
| 5-factor deterministic scoring, policy thresholds | IMPLEMENTED | `decision_engine.py`; 19 pytest tests |
| Snapshot-anchored determinism (`reference_time`) | IMPLEMENTED | `router.compute_reference_time`; determinism test |
| Evidence pack (factors, RAG notes, provenance, sourced/estimated tags) | IMPLEMENTED | `decision_engine.py`; API test |
| External signal fetch-gating | IMPLEMENTED (cached snapshot, not live) | `external_gateway.py`; honest label |
| RAG over rep notes | PARTIAL | `rag_service.py` + `lite_vector_store.py`: in-memory, fallback hash embeddings when `sentence_transformers` is absent (it is absent here). Retrieval is filtered by opportunity id, but there is **no relevance threshold and no "insufficient evidence" path**; the query string is fixed |
| Pipeline Q&A | PARTIAL | `qa.py` (regex intent → computed answer). Not exposed by the gateway (`/ask` has no NestJS route); the frontend still answers with its own duplicate logic |
| Data quality | PARTIAL | `quality_engine.py`: duplicates by company name, missing deal value/contact, staleness. No invalid-value, conflict or probability checks; not persisted |
| CSV ingestion + column mapping | PARTIAL | `router.ingest_file` (CSV only, no size limit/type validation, no XLSX) |
| Decision Twin | PARTIAL | `decision_twin.py`: transparent arithmetic on the active dataset; does not mutate records. Simplified capacity model; `simulation_id` is derived from inputs (not unique) |
| Human approval (approve/modify/reject) | IMPLEMENTED | `reviewAction` → `decision_approvals` + audit log. No state machine (no DRAFT/REVIEW), no evidence snapshot on the approval row |
| Audit log | IMPLEMENTED | `decision_audit_logs`, `getAuditLogs` |
| Decision replay | PARTIAL | `replayDecision` returns run + audit events + approvals. The run stores the full recommendations JSON (so evidence is reproducible) but no query, query plan or policy body |
| Policy config, versioned | IMPLEMENTED | `decision_policy_configs`, per-user, versioned |
| LLM query understanding / planner / tool calling | **ABSENT** | No LLM anywhere in `decision_forge/` |
| Output schema validation for LLM output | ABSENT (nothing to validate) | — |
| Prompt-injection handling | N/A today | notes are only embedded/quoted, never sent to an LLM |
| Dashboard integration | PARTIAL | banner links to `/decision-forge`; shows no live counts |

## 3. Data

- **Real dataset:** 12 accounts with cited provenance (`ai-service/data/real_industrial_crm.json`).
- **Fallback:** fictional 8-record flat dataset (`demo_industrial_crm.json`), fake URLs nulled.
- **Not present:** the 500+ opportunity / 1,000+ activity / notes / reps dataset the target spec describes,
  and any Company/Contact/Activity/Product/Rep entities. The ai-service holds plain dicts, not tables.
- Decision data lives in **two places**: ai-service process memory (opportunities, RAG index, fetched
  flags) and gateway SQLite (runs, approvals, audit, policy, clients).

## 4. Critical findings

1. **No tenant isolation in the AI layer (HIGH).** `ACTIVE_OPPORTUNITIES`, the RAG index and the
   `_fetched` set are process-wide globals in `router.py`. Any user's `reset-demo`, `apply-mapping` or
   fetch changes what every other user sees. The gateway attaches `userId` to its own rows but sends the
   ai-service no workspace/user identifier.
2. **Replay IDOR (HIGH).** `GET /decision-forge/replay/:runId` looks the run up by id only; any
   authenticated user can read another user's run, recommendations and approvals.
3. **Approval integrity (MEDIUM).** `reviewAction` trusts `companyName`, `dealValue`, `opportunityId`
   from the request body and never checks the recommendation belongs to the caller or to a real run.
   `convertToClient` updates approvals by `recommendationId` alone (not scoped to `userId`).
4. **ai-service is unauthenticated with `allow_origins=["*"]`; gateway CORS is `*`.** Fine for local
   demo, risky if the ai-service is deployed publicly.
5. **Upload validation missing** on `ingest/file` (no extension/size/content checks, decodes with
   `errors="replace"`).
6. **`synchronize: true` on SQLite in `/tmp` on Vercel** — data does not persist across cold starts.
7. **Tests:** ai-service now has 19 pytest tests. Backend has only the Nest boilerplate spec and e2e stub;
   frontend has none.
8. Frontend Q&A duplicates `qa.py` and groups regions by the last comma-part (which is "USA").
9. Gateway run score differs slightly from a direct ai-service run (Chobani 82.1 vs 81.8): the gateway
   sends the user's saved policy; the saved policy differs from the code defaults. Not yet investigated.

## 5. Reusable as-is

Auth/JWT, clients/invoices/expenses/analytics/contracts modules, the deterministic scorer and evidence
pack, policy entity/versioning, approval + audit entities, Decision Twin arithmetic, the evidence drawer
and tab layout, the new pytest suite.

## 6. Do not touch

Contracts, statements/loan simulator, invoices/GST, wealth, goals, personal/freelancer persona, landing
visuals (only fix claims that aren't true).

## 7. Gap to the target spec (60-point brief)

| Target | Gap |
|---|---|
| 500+ opp synthetic dataset, planted cases A–G | Not built. Conflicts with the real-data migration; see §8 |
| Relational entities (opportunity/activity/note/rep…) | Not built; ai-service uses dicts |
| Query planner + typed tool calls + LLM with schema validation and one retry | Not built; needs a decision on LLM provider/key |
| RAG relevance threshold + "insufficient evidence" | Not built |
| Workspace/tenant scoping end to end | Not built (finding 1–3) |
| Approval state machine + evidence snapshot on approval | Partial |
| Decision persisted with question, plan, policy body, snapshot id | Partial |
| Data-quality tab with issue list, reprocess | Partial (ingestion tab has a scorecard only) |
| Dashboard live counts | Not built |
| Eval dataset (20+ questions) + per-metric report | Not built |
| Backend + frontend tests | Not built |
| `/docs/*` set | This file only |

## 8. Decisions taken and one that needs the owner

Taken (reasonable defaults, low regret):
- Keep the NestJS/FastAPI split and the existing tabs; extend rather than rebuild.
- Make policy weights configurable from one place (defaults unchanged) rather than changing them.
- Fix tenant isolation and the replay IDOR **first** — they are correctness/security defects.
- Deterministic path stays the source of truth; any LLM layer is optional and falls back to it.

Needs a decision (materially different outcomes):
1. **Dataset strategy.** The real, cited 12-account dataset was just adopted specifically because fake
   companies and links undermined credibility. The new brief asks for 500+ synthetic opportunities.
   Proposal: keep the 12 real accounts as the headline "real-world" workspace and add the large synthetic
   set as a clearly labelled *synthetic scale/eval workspace* (fictional company names, no URLs, marked
   `synthetic`), so both the credibility story and the volume/test-case story hold.
2. **LLM.** No LLM key is configured for DecisionForge. Options: an OpenAI/Anthropic key for the planner
   and explanation layer with deterministic fallback, or a rule-based planner only (no key, fully
   reproducible, weaker "agent" story).


---

## 9. Remediation log (after the audit)

### Fixed

| Finding | Fix | Verified by |
|---|---|---|
| 1. No tenant isolation in the AI layer | Per-workspace state (`workspace.py`): dataset, engine, RAG index, fetch state; `X-Workspace-Id` from the JWT user; workspace cap | `test_planner_pipeline_security.py` (dataset, RAG, fetch state, API, id validation), live check with two users |
| 2. Replay IDOR | Every run lookup filters by `userId`; other users get 404 | `decision-forge.service.spec.ts`; live: user B got 404 |
| 3. Approval integrity | Recommendation must exist in the caller's own run; company/value/opportunity read server-side; state machine (terminal states return 409); convert-to-client needs an approved item and uses the stored name | `decision-forge.service.spec.ts` |
| 4. Unauthenticated ai-service | Optional shared `X-Internal-Token` (`AI_SERVICE_TOKEN`) enforced on all DecisionForge routes. CORS is still `*` | `test_service_token_is_enforced_only_when_configured` |
| 5. No upload validation | Extension, 2 MB, 5,000 rows, 60 columns, binary and UTF-8 checks, 400/413 messages; gateway multer limit | `test_synthetic_and_quality.py` |
| 7. Tests | AI service: 145 pytest tests; gateway: 22 Jest tests (the stale "Hello World" template test was corrected). Frontend still has no UI tests | suites |
| 8. Duplicate frontend Q&A | Frontend calls the backend query endpoint; the browser-side copy is gone | UI + `tsc` |
| 9. Gateway vs direct score difference | Not a bug: the gateway applies the user's saved policy (this account was on policy v2). `Reset Demo` now restores the default policy | live check |

### Found while fixing (not in the original audit)

| Finding | Severity | Resolution |
|---|---|---|
| **RAG was bypassed.** The router indexed notes into its own `NotesRagService`, but the engine retrieved from a different instance, so retrieval always came back empty and evidence silently fell back to raw notes | High (the core "RAG over business data" requirement) | One service per workspace, indexed and queried through the same instance; tests assert retrieval is used |
| **Hard-coded dashboard figure.** The banner said "$2.17M Pipeline Analyzed" regardless of data (real pipeline: $6.7M) | High (fabricated number) | Banner reads live counts from `/summary` and says so when the service is down |
| **Decision Twin presented invented multipliers as results** (+18% for fast response, "burnout" -15%) | Medium | Multipliers are now labelled assumptions returned with every response; capacity actually limits coverage; the value without assumptions is shown; the burnout claim was removed |
| **Decision Twin compared a capacity-limited scenario with an unconstrained baseline** (baseline "covered" 507 deals at 231% utilization), so almost every scenario looked like a large loss; the UI also drew a drop in green with an up arrow | High (misleading headline feature) | Baseline is now a parameter set (default: the tab's opening levers, overridable) run through the same model as the scenario; identical levers give 0%; deltas are coloured by sign; verified against an independent re-implementation in tests |
| Twin labels claimed a "30-day" velocity, "next 60 days" closes and "historical conversion velocity" | Low | Relabelled to what is computed (expected value of covered opportunities; probability-weighted deals) |
| Factor text said "yields N% historical close rate", "revenue potential against team target" and "rep-logged interaction" | Medium (unsupported claims) | Text now states what the value is: an analyst estimate / synthetic CRM state for the real-account dataset, a CRM value otherwise; the $500,000 scoring ceiling is named and shown |
| Audit heading said "Immutable" | Low | Renamed "Approvals & Audit Log" (append-only in application code, not tamper-proof) |
| Open evidence drawer kept showing the pre-fetch score after "Fetch fresh context" | Low | The drawer follows the refreshed recommendation |
| **Blank CSV cells became 0** (a blank probability silently became 0%) | Medium | Blank numeric cells are left missing and flagged |
| **Missing probability was silently 0.5** | Medium | Flagged, penalised, lowers confidence, warning text |
| **False "duplicates"** in synthetic data (name collisions) inflated the quality report | Low | Unique opportunity names; only real duplicates flagged |
| Landing card said "±12% band" for the Twin | Low | Label corrected |
| Signal relevance (which sets how much fetched context moves a score) was an unexplained constant | Medium | Now a documented modeled value, shown with its basis in the evidence drawer |

### Still open / deferred

- **Browser check scope.** The main DecisionForge flow (login, reset, question, evidence drawer with citations, fetch context, approval, replay, data quality, Decision Twin) was clicked through in Chrome against the running stack with no console errors. Not covered: mobile layouts, keyboard/screen-reader use, the policy modal, CSV upload through the file picker, and the modify/reject paths in the UI.
- LLM planner tested only against a fake client; no real-model accuracy. LLM-written explanations deferred.
- Embeddings are hashed bag-of-words unless `sentence-transformers` is installed.
- In-memory datasets and RAG indexes; SQLite (ephemeral on Vercel); `synchronize: true` schema management.
- No separate workspace/company entity (workspace = user); no relational Company/Contact/Product tables; data-quality issues are computed, not persisted, and have no resolve workflow.
- Rate limiting covers questions only. CORS is `*` on both services. `JWT_SECRET` default in `.env.example` must be changed for any real deployment.
- XLSX ingestion not built (CSV only). Frontend has no unit/UI tests; ESLint reports many `no-explicit-any` errors in the pre-existing style of this codebase.
- `docker compose` and the Vercel/Render deployment configs were not exercised.
