# DecisionForge architecture

Status labels used throughout: **IMPLEMENTED** (real code, tested) · **PARTIAL** · **MOCKED** · **DEFERRED**.

## The flow

```
BUSINESS DATA  ->  DATA QUALITY  ->  QUERY UNDERSTANDING  ->  ANALYTICS + RAG  ->  EVIDENCE PACK
      ->  DECISION ENGINE  ->  RECOMMENDATION  ->  DECISION TWIN  ->  HUMAN APPROVAL  ->  ACTION  ->  AUDIT / REPLAY
```

```
React (5173) --JWT--> NestJS gateway (3001, SQLite)  --X-Workspace-Id, X-Internal-Token--> FastAPI ai-service (8000)
   decisions, approvals, audit, policy, replay            planner, analytics, RAG, engine, twin, per-workspace data
```

The gateway authenticates the user and stores everything that must outlive a request (runs, approvals, audit log,
policy versions, query logs). The ai-service is stateless with respect to *users*: it holds one in-memory workspace per
caller id and does all analysis.

## Source of truth (never reversed)

1. Business records  2. Deterministic calculations  3. Retrieved business evidence  4. External sources  5. LLM interpretation.

The LLM (optional) is used **only** to classify a question into one of 14 intents. It receives the question text and
nothing else, returns JSON that is validated against a fixed enum, is retried once with the validation error, and falls
back to the rules planner if still invalid or unavailable. It never computes, never chooses tools, never sees records,
notes or evidence, and never writes the answer text. All arithmetic lives in `analytics.py`, `decision_engine.py` and
`decision_twin.py`. Explicit what-if wording ("what if", "simulate", "suppose we ...") is routed by fixed cues *before* the
model is asked, so a model can never turn a simulation request into a ranking or capacity question, and the numbers of a
what-if are read from the sentence by `scenario_parser.py`, never by a model.

## ai-service modules (`ai-service/app/decision_forge/`)

| Module | Role | Status |
|---|---|---|
| `workspace.py` | Per-workspace dataset, engine, RAG index, fetch state; snapshot id; **state fingerprint and deterministic restore**; registry with a cap | IMPLEMENTED |
| `schema_mapper.py` | CSV column mapping; loads nested (sourced/modeled/provenance) and legacy flat datasets | IMPLEMENTED |
| `quality_engine.py` | Missing / invalid / conflicting / duplicate / stale detection; issue list + scorecard | IMPLEMENTED |
| `analytics.py` | 8 deterministic tools; every result carries source, timestamp, definition | IMPLEMENTED |
| `planner.py` | Rules planner (14 intents, what-if cues first) + optional LLM planner with schema validation, one retry, fallback | IMPLEMENTED (LLM path tested with a fake client only; no API key was available) |
| `scenario_parser.py` | What-if wording -> validated Twin levers (regex + arithmetic; bounds read from the Twin's own schema; never clamps) | IMPLEMENTED |
| `rag_service.py` | Sentence chunking, metadata-filtered retrieval, hybrid rerank, relevance floor, "Insufficient evidence." | IMPLEMENTED (see limits) |
| `intent.py` | Fixed-lexicon buying-intent score over notes | IMPLEMENTED |
| `decision_engine.py` | Weighted policy score, quality penalty, confidence, warnings, evidence pack | IMPLEMENTED |
| `policies.py` | Versioned presets (`sales_priority_v1`, `sales_priority_v1_1`) | IMPLEMENTED |
| `query_pipeline.py` | Plan -> tools -> decision run -> RAG -> answer, with a step trace; the what-if branch runs the Twin on a copy | IMPLEMENTED |
| `decision_twin.py` | Baseline strategy and scenario run through the same model on a copy of the snapshot; capacity-limited coverage; stated assumptions; baseline overridable | IMPLEMENTED |
| `external_gateway.py` | Optional cited signal per account, explicit fetch only; labelled a cached snapshot | IMPLEMENTED (cached snapshot, **not** a live crawl) |
| `synthetic.py` | Deterministic 520-opportunity dataset with planted cases A-H | IMPLEMENTED |
| `security.py` | Optional shared-secret check between gateway and ai-service | IMPLEMENTED |

## Scoring

```
score = max(0, deal_value_score x w_deal + win_probability x w_win + engagement x w_eng + recency x w_rec
              + external_signal x w_ext + buying_intent x w_intent  -  data_quality_penalty)
```

Weights, thresholds and penalties come from the policy (`PolicyWeights`); nothing is hard-coded in the scorer. The
default policy (`sales_priority_v1`, weights 0.25/0.20/0.20/0.15/0.20, intent 0) reproduces the original scores
exactly. `sales_priority_v1_1` adds buying intent (0.15). The gateway persists per-user policy versions and sends them on
every run; each run stores the exact policy body used.

Clean records are scored exactly as before. A record with a missing probability, a conflicting probability, an invalid
deal value or a duplicate gets a fixed point penalty and a confidence reduction; below the policy's confidence threshold
the recommendation is flagged **human review required**. Staleness lowers confidence but is not double-penalised (recency
already scores it).

Every response separates FACT (observed record), ANALYSIS (deterministic arithmetic), PREDICTION (estimate),
DECISION (policy output), EXTERNAL and ASSUMPTION; the evidence pack carries a `labels` map and the UI renders
sourced-vs-estimated fields differently.

## Workspace isolation

`X-Workspace-Id` (the JWT user id) selects a `WorkspaceState`. Each one owns its records, activities, decision engine,
RAG index and external-context fetch state; nothing is module-global. Consequences, all tested:

- resetting, uploading or fetching in one workspace does not change another's data or scores;
- a RAG query cannot return another workspace's notes;
- asking about another workspace's opportunity id gets the same "not found in this workspace" as a nonexistent id;
- gateway reads/writes (runs, approvals, replay, audit, evidence) are filtered by `userId`; another user gets 404.

## Recoverable workspace state

The ai-service keeps each workspace in memory, so a restart, a cold start or another serverless instance would silently replace a
user's chosen dataset with the default. Instead the state is described, remembered and rebuilt:

1. `WorkspaceState.state_fingerprint()` hashes what changes an answer: dataset key, snapshot id (a hash of the records) and which
   companies had external context fetched. State-changing calls (`reset-demo`, `ingest/apply-mapping`, `fetch-context`) return it.
2. The gateway stores, per user, the inputs needed to rebuild it (`decision_workspace_states`): the dataset key, the uploaded
   records for a custom dataset, the opportunity ids whose context was fetched, and the fingerprint.
3. Every later gateway call sends `X-Workspace-State: <fingerprint>`. An ai-service instance that does not hold exactly that state
   answers `409 WORKSPACE_RESTORE_REQUIRED` (it does **not** load the default dataset to answer).
4. The gateway calls `POST /decision-forge/workspace/restore` (same limits and loader as an upload; an unknown dataset, oversized or
   malformed input is rejected) and retries the original request once. Parallel requests share one restore. If the rebuilt data
   differs from what was saved (for example a new release of a preset dataset) the response says `matches_expected: false` and the
   gateway adopts the new fingerprint. A `WORKSPACE_RESTORED` event is written to the audit log.

State-establishing endpoints ignore the header, and a request without it behaves as before. The recovery is exactly as durable as the
gateway's SQLite file (see `docs/DEPLOYMENT.md`).

## What-if questions in words

`scenario_simulation` is the fourteenth intent. `scenario_parser.py` reads the levers from the sentence, applies relative wording to the
stated baseline (4 reps, 20 contacts/day, $50,000 minimum, 3-day response, cutoff 60) and hands `ScenarioParams` to the same
`DecisionTwinSimulator` the sliders use, on a copy of the snapshot.

- Understood: number of reps (add, remove, stated total, double or halve), contacts per rep per day (absolute, percent, double),
  minimum deal value (`$500,000`, `100k`, `1.5m`, `5 lakh`), follow-up window (hours become whole days and the conversion is said),
  priority cutoff.
- **Never clamped or guessed.** A value outside the Twin's own bounds (read from `ScenarioParams`, so they cannot drift), two
  conflicting values for one lever, or a follow-up window under one day blocks the simulation and is explained. Ambiguous wording
  ("2 reps", "increase outreach" with no amount) or an unmodelled lever (a *maximum* deal size) is disclosed as "not applied"; the
  clear levers are still simulated and the answer lists exactly which ones.
- A currency other than USD is applied as the same number and the answer says no conversion was done.
- The answer is assembled from the result: what was applied, expected value and coverage against the baseline, utilization, the
  capacity warning, and, when relevant, that the result is flat because capacity was never the constraint or that the change comes
  only from the Twin's stated assumptions. Confidence is capped at 0.8 because the result rests on those assumptions.
- The gateway records a `SIMULATION_RUN` audit event (parameters, baseline, result) next to the usual `QUERY_RUN`.

## Human approval

`DRAFT -> REVIEW -> APPROVED | REJECTED | MODIFIED` (MODIFIED can still be approved or rejected; APPROVED and REJECTED are
terminal, later changes return 409). Company, deal value and opportunity are read from the stored run, never from the
request body. Each approval stores the policy version, snapshot id, score, confidence, a frozen copy of the evidence the
reviewer saw, and the transition history. Nothing is executed by approval; "convert to client" is a separate,
explicit step that requires an approved recommendation.

## Replay

`GET /decision-forge/decisions/:runId` returns, in order: question -> query plan -> data snapshot -> analytics -> RAG
results -> evidence -> policy -> score -> recommendation -> approval, plus the raw run, audit events and approvals.

## Failure handling

| Failure | Behaviour |
|---|---|
| LLM unavailable / invalid twice / unknown intent | Rules planner; response says `planner: rules_fallback` |
| RAG retrieval error | Structured answer still returned; `fallbacks` says retrieval unavailable |
| No relevant note | "Insufficient evidence." (no padding with weak matches) |
| External context fails or has no signal | "External context unavailable. Decision calculated from internal business data." |
| Malformed / oversized / non-CSV upload | 400/413 with an actionable message; nothing activated |
| ai-service restarted, cold, or a different instance | 409 -> the gateway restores the workspace from its saved state and retries once; if the restore itself fails the user gets a 4xx/503 message, never the default dataset |
| What-if that cannot be simulated (out of range, conflicting, ambiguous, nothing recognised) | Explained answer, confidence 0, human review flagged, no simulation run, no value clamped |
| Unsupported question | Controlled "can't map that question" answer, confidence 0, human review flagged |
| ai-service down | Gateway returns 503 "temporarily unavailable"; dashboard banner says so instead of showing numbers |

## Security controls

sign-in by Google (a Firebase ID token verified against Google's keys; no secret on the server) or by email and password, no built-in accounts,
and a `JWT_SECRET` that must be strong in production (see `docs/AUTHENTICATION.md`); JWT on every gateway route; per-user scoping of all reads and writes; ownership check before any approval; input
length/type validation on questions, comments and actions; CSV upload limits (2 MB, 5,000 rows, 60 columns, extension,
binary and UTF-8 checks) with a 6 MB JSON limit on `ingest/apply-mapping` only (the reviewed records travel back through the gateway;
other routes keep Express's 100 KB default); per-user question rate limit (30/min); optional shared service token; workspace-count cap; notes
and question text treated strictly as data (fixed lexicon, enum-constrained planner); no API keys in the frontend.

## Known limits (be honest with judges)

- **Embeddings.** Without `sentence-transformers` installed (the case in this repo's default setup) retrieval uses a
  deterministic hashed bag-of-words embedding; the hybrid rerank adds lexical coverage. It is exact-ish keyword retrieval,
  not deep semantic search. Installing `sentence-transformers` enables real embeddings with no code change.
- **Persistence.** Datasets and RAG indexes are in-memory but rebuilt on demand from state the gateway saved (dataset choice,
  uploaded CSV, fetched context), so an ai-service restart no longer loses them. That state, and runs, approvals and the audit log,
  live in the gateway's SQLite file, which a host with an ephemeral disk (Vercel `/tmp`, Render's free plan) wipes on restart, and
  which is per instance on serverless. See `docs/DEPLOYMENT.md`.
- **Estimates.** In the real-account dataset, deal value / win probability / engagement / contact dates are our modeled
  estimates, labelled ESTIMATED with a basis. In the synthetic dataset everything is generated.
- **Decision Twin multipliers** (response-time and focus effects) are stated assumptions, not measurements.
- **Deferred:** LLM-written explanations, XLSX ingestion, a workspace (multi-user company) concept separate from the user,
  relational Company/Product/Contact tables, live web retrieval, multi-node persistence.
