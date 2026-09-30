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
| 7. Tests | AI service: 284 pytest tests; gateway: 46 Jest tests (the stale "Hello World" template test was corrected). Frontend still has no UI tests | suites (counts as of the second work session, below) |
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

### Second work session (2026-09-30): backlog items P0-1 and P0-3, plus deployment groundwork

| Finding | Severity | Resolution | Verified by |
|---|---|---|---|
| **An ai-service restart silently reverted a user to the default dataset** (in-memory workspaces; a chosen dataset, an uploaded CSV or fetched context vanished with no warning, while the gateway still held runs that referred to the old snapshot) | High | The gateway saves each user's workspace inputs and a fingerprint; the ai-service answers 409 for a state it does not hold and is rebuilt through `POST /workspace/restore`; the gateway retries once (parallel requests share one restore) and audits `WORKSPACE_RESTORED` | `test_workspace_recovery.py` (34), `workspace-recovery.spec.ts` (18), and killing and restarting the ai-service against the running stack, also in production mode with the service token: 18/18 checks (same snapshot id, rankings and fetched score) |
| **CSV activation failed for any realistic file**: the reviewed records go back through the gateway, and Express's default 100 KB JSON limit answered `413` at about 350 rows | High (the ingestion path was effectively unusable beyond toy files) | 6 MB limit on `ingest/apply-mapping` only (other routes keep the default) | `body-limits.spec.ts` against a real Nest bootstrap; a 600-row upload end to end |
| **My first fix for the limit broke every other route**: registering body-parser's `json()` made Nest skip its own global JSON parser (it looks for a middleware named `jsonParser`), so `/auth/login` received no body | High (caught only because the real stack was exercised) | The scoped parser is wrapped in a differently named function; a regression test bootstraps a real Nest app and checks that other routes still receive their body | `body-limits.spec.ts` (fails with the old name, passes with the fix) |
| The Twin was slider-only; the brief's own question, "what if we add two sales reps?", could not be asked | Medium | `scenario_simulation` intent: `scenario_parser.py` reads the levers, the same Twin runs baseline vs scenario on a copy; answers are assembled from the result and say when a change comes only from the stated assumptions | `test_scenario_questions.py` (105), eval cases Q18-Q25 and A10-A15 (independent recomputation), browser check |
| The parser first read "only have 2 reps" as **add** 2 (4 to 6), and "had 8 reps instead of 4" as add 8 | High while it lasted (wrong answer, silently) | Found by running the parser over a broad list of phrasings before wiring it in; `have/had/with N reps` now means a stated team size, "N more reps" means an addition | the 44-row extraction table; mutation check (re-adding `have` fails 8 tests) |
| A regex block written through a shell heredoc lost its backslashes (`\b` became a backspace character) so the what-if cue never fired | Medium | Rewritten with a tool that writes text verbatim; scanned every changed file for control characters | routing tests |
| README said **Node 18+**; NestJS 11, better-sqlite3 and Vite 8 need Node 20+ (20.19+ for the frontend build) | Medium (a fresh clone on Node 18 fails) | README, demo script and deployment doc corrected | dependency `engines` fields |
| `render.yaml` gave the gateway `AI_SERVICE_URL` as a bare hostname (`property: host`), which points at port 80 while the ai-service listens on `$PORT`; no service token; no Python pin (the pinned PyMuPDF has no wheel for newer interpreters) | High for a Render deployment | `hostport`, the gateway tolerates a missing scheme, token on both services, `PYTHON_VERSION` pinned | production-mode run with a scheme-less URL and token enforcement (**not** verified on Render itself) |
| `.env.example` advertised `DATABASE_PATH` (never read) and the wrong frontend variable name (`VITE_API_BASE_URL`; the code reads `VITE_API_URL`) | Low | The gateway now honours `DATABASE_PATH`; the variable name is corrected | production-mode run with a separate database file |
| `docker-compose.yml`: `ai-service/Dockerfile` is an empty file, the gateway and frontend have no Dockerfile, it starts an unused Postgres and Redis and needs env files that do not exist | Medium | **Not fixed** (Docker Desktop was not running, so a rewrite could not be tested); the README now says plainly that it does not work | n/a |
| Whether the pinned requirements work at all had never been tested (development used newer versions) | Medium | Clean venv from `requirements-dev.txt` (fastapi 0.110.0, pydantic 2.6.4, PyMuPDF 1.24.1): 271 tests and the 40-case evaluation pass; `npm ci` for the gateway and frontend also pass | clean installs from a copy of the working tree |

### Third work session (2026-09-30): sign-in (seeded logins removed, Google sign-in through Firebase)

| Finding | Severity | Resolution | Verified by |
|---|---|---|---|
| **`POST /auth/firebase-login` signed anyone in as any email.** It took `email` from the request body and issued a session with no token check (the frontend never even sent the Firebase ID token), so anyone who could reach the gateway could take over any account or create one | **Critical** | Removed. `POST /auth/google` takes a Firebase ID token and verifies it (RS256 signature against Google's keys, issuer, audience, expiry, verified email, Google provider); identity comes only from the token | 46 verifier tests on real signed tokens (`alg: none`, HS256 key confusion, wrong audience or issuer, tampered, foreign key...), 43 account-logic tests, 21 HTTP tests; every rule was also broken on purpose to confirm the tests fail; the old route answers 404 |
| **Fallback signing secret.** With `JWT_SECRET` unset the gateway signed sessions with the literal `fallback_secret`; the example env files shipped public values | High | Production refuses to start without a strong, non-placeholder secret; development uses a random per-process key | jwt-secret tests; the production build really refusing to start (4 of 4 cases) |
| **Mass assignment** in `register` and `PATCH /users/profile`: whatever the body held was written (`email`, a raw `password`, and once Google linking exists, `firebase_uid`, which would let one person claim another's Google identity) | High | Only an explicit list of profile fields, each validated; identity fields are never taken from a body | profile-field tests; an HTTP test that a profile update cannot change email, password, id or the Google link |
| **Seeded accounts** (`demo@...`, `admin@...`, one shared public password, with sample clients, invoices and expenses) were created on every start and advertised on the login page | High for any real deployment | Seeding removed, and the login-page hint. The local database that held the seeded accounts was moved aside to `backend/finsight.seeded-backup.db` (git-ignored) | a fresh database has zero users; the old logins answer 401; the smoke and browser tests check it |
| Account linking: an email + password sign-up is unverified, so someone could register a stranger's address in advance and wait | Design risk (pre-hijacking) | When Google proves ownership of that address, the account is linked (data kept) and the old password is retired | service, HTTP, emulator and browser tests |
| Logout waited for Firebase before clearing the local session, so a slow sign-out left the token in place | Low | The local session is cleared first | found by the browser test |
| The dashboard greeted everyone as "Sam" | Low | Uses the signed-in person's first name | browser test, screenshot |
| Returning people were sent through mode selection again on every sign-in (the flag lives only in the browser and is cleared at logout) | Low | Only new accounts go through it | browser test |
| **The finance dashboard invents figures for an account with no data** (an assumed baseline monthly income of ₹2,20,000 or ₹1,50,000), hidden while the seeded user always had data | Medium, **open** | **Not changed**: the finance modules are out of scope; documented in the README and `docs/AUTHENTICATION.md` | screenshot of a brand-new account |
| Consequence of having no seed: on an ephemeral disk (Render free plan, Vercel `/tmp`) every account is lost on restart | Operational | Documented; signing up again is one click with Google | `docs/DEPLOYMENT.md` |

### Still open / deferred

- **Browser check scope.** The main DecisionForge flow (login, reset, question, evidence drawer with citations, fetch context, approval, replay, data quality, Decision Twin) was clicked through in Chrome against the running stack with no console errors. Not covered: mobile layouts, keyboard/screen-reader use, the policy modal, CSV upload through the file picker, and the modify/reject paths in the UI.
- LLM planner tested only against a fake client; no real-model accuracy. LLM-written explanations deferred.
- Embeddings are hashed bag-of-words unless `sentence-transformers` is installed.
- The ai-service still holds datasets in memory (now rebuilt on demand); SQLite is per instance on serverless and wiped on ephemeral disks; `synchronize: true` schema management. Accounts live in the same SQLite file, so an ephemeral disk loses them; sign-in has no rate limiting, email verification or password reset, and sessions cannot be revoked before they expire (`docs/AUTHENTICATION.md`).
- No separate workspace/company entity (workspace = user); no relational Company/Contact/Product tables; data-quality issues are computed, not persisted, and have no resolve workflow.
- Rate limiting covers questions only. CORS is `*` on both services. `JWT_SECRET` default in `.env.example` must be changed for any real deployment.
- XLSX ingestion not built (CSV only). Frontend has no unit/UI tests; ESLint reports many `no-explicit-any` errors in the pre-existing style of this codebase.
- `docker compose` is broken (above) and the Vercel/Render deployment configs were not exercised on the platforms; see `docs/DEPLOYMENT.md` for exactly what was and was not verified.
