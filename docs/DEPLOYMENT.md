# Deployment

**Status: not deployed by the authors.** Everything below marked *verified* was run on a local machine (Windows, Python 3.12.10,
Node 24.18) against the production build. Everything marked *not verified* needs a real account on the host and is listed
so nobody has to guess. After deploying, `python scripts/smoke_demo.py --gateway https://<gateway>/api` is the acceptance test.

## What runs where

| Piece | Runtime | Notes |
|---|---|---|
| Frontend | static files (`npm run build` -> `frontend/dist`) | needs `VITE_API_URL` **at build time**; SPA fallback is in `frontend/vercel.json` |
| Gateway | Node **>= 20** (NestJS 11, better-sqlite3, Vite 8 needs 20.19+ for the build) | SQLite file; native module `better-sqlite3` |
| AI service | Python 3.12 with the **pinned** `requirements.txt` | the pinned PyMuPDF has no wheel for newer default interpreters |

## Where state lives (why long-running services are recommended)

| State | Lives in | After an ai-service restart | After a gateway restart or redeploy |
|---|---|---|---|
| Dataset, RAG index, fetched-context flags | ai-service memory | rebuilt on the next request from the gateway's saved state | rebuilt the same way |
| A user's chosen dataset, uploaded CSV records, fetched-context choices | gateway SQLite (`decision_workspace_states`) | kept | kept **only if the SQLite file survives** |
| Runs, approvals, saved policy, query logs, audit log | gateway SQLite | kept | kept **only if the SQLite file survives** |

How the recovery works: the gateway sends the fingerprint of the workspace state it expects (`X-Workspace-State`). An ai-service
instance that does not hold exactly that state answers `409 WORKSPACE_RESTORE_REQUIRED` instead of serving the default dataset;
the gateway then calls `POST /decision-forge/workspace/restore` with what it saved and retries the original request once.
Parallel requests share one restore. The audit log records a `WORKSPACE_RESTORED` event. *Verified* by killing and restarting the
ai-service under a running gateway: same snapshot id, same rankings, same fetched score, for a chosen dataset, a 600-row upload and
fetched context, also with the service token enforced.

`DATABASE_PATH` moves the SQLite file to a persistent volume. Without it the file is `backend/finsight.db`, or `/tmp/finsight.db`
on Vercel. **On a host that wipes the disk (Vercel `/tmp`, Render's free plan) a gateway restart resets everything**: accounts, runs,
approvals and workspace choices are all gone, and **nothing is reseeded** (the old demo login no longer exists), so everyone has to sign up
again. Google makes that one click and email sign-up takes seconds, but plan for it before a demo: sign up again after a restart, or
attach a persistent disk and set `DATABASE_PATH`.

**Serverless caveat.** On Vercel every function instance has its own memory *and its own `/tmp` database*. Two instances are two
different databases, so an approval made on one may not exist on another. That is fine for one person clicking through a demo on a
warm instance and wrong for anything shared. A shared database (Postgres; the `pg` package is already installed but the code uses
better-sqlite3) is required for correctness on serverless.

## Settings

| Variable | Service | Required? | Notes |
|---|---|---|---|
| `JWT_SECRET` | gateway | **yes** | the gateway **refuses to start** in production without a strong (32+ characters), non-placeholder value |
| `FIREBASE_PROJECT_ID` | gateway | for Google sign-in | the Firebase project id (no secret needed); empty turns Google sign-in off, email sign-in still works |
| `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` | frontend **build** | for Google sign-in | the Firebase web app config; public identifiers, not secrets |
| `AI_SERVICE_URL` | gateway | yes | full URL, or `host:port` (a missing scheme is read as `http://`; trailing `/` dropped) |
| `AI_SERVICE_TOKEN` | gateway **and** ai-service | strongly recommended | same value on both; the ai-service then returns 401 to any caller without it |
| `DATABASE_PATH` | gateway | for persistence | path on a persistent volume, e.g. `/var/data/finsight.db` |
| `PORT` | gateway | no | defaults to 3001 |
| `OPENAI_API_KEY`, `DECISION_PLANNER_MODEL` | ai-service | no | optional LLM question classifier; the system works without it |
| `PYTHON_VERSION` | ai-service (Render) | recommended | `3.12.10` |
| `VITE_API_URL` | frontend build | **yes** | public gateway URL including `/api` |

## Render (Blueprint in `render.yaml`)

1. New -> Blueprint, pick this repo. Render creates `bizpulse-backend` and `bizpulse-ai-service`.
2. When prompted, give **the same** `AI_SERVICE_TOKEN` to both services (for example `openssl rand -hex 32`) and your `FIREBASE_PROJECT_ID`.
   `JWT_SECRET` is generated for you. `OPENAI_API_KEY` is optional. In the Firebase console add the gateway's and the frontend's domains under
   *Authentication > Settings > Authorized domains*.
3. `AI_SERVICE_URL` is wired with `property: hostport` (`name:port` on Render's private network). It is `hostport` and not `host` on
   purpose: a bare hostname would target port 80, but the ai-service listens on `$PORT`. The gateway adds the missing `http://`.
   If your Blueprint rejects that property, set `AI_SERVICE_URL` by hand to the ai-service's URL.
4. Deploy the frontend (Vercel: root directory `frontend`, framework Vite, `VITE_API_URL=https://<gateway>.onrender.com/api`).
5. Run the smoke test:
   `python scripts/smoke_demo.py --gateway https://<gateway>.onrender.com/api --ai https://<ai-service>.onrender.com --ai-token <token>`.
6. On the free plan both services spin down when idle and take a while to wake; open the app a couple of minutes before a demo and
   load the sample dataset from the DecisionForge *Start here* screen first. For persistence attach a disk to the gateway and set `DATABASE_PATH` to a path on it.

## Vercel

- **Frontend**: fine. Set `VITE_API_URL` in the project's build environment.
- **Gateway** (`backend/vercel.json` and `backend/api/index.js`, which serves the compiled Nest app): this is how the live site runs.
  Set `DATABASE_URL` to a Postgres connection string (the live site uses Neon). Vercel runs several copies of the function at once, and
  with the default SQLite file each copy has its own database, so accounts and datasets go missing between requests. Also set
  `JWT_SECRET`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `CORS_ORIGINS` (the frontend's address), and optionally `FIREBASE_PROJECT_ID` and
  `OPENROUTER_API_KEY`. `maxDuration` is 30 seconds and the region is pinned next to the database (`sin1`). Vercel's request body limit
  (about 4.5 MB) applies before the gateway's own 6 MB limit on `ingest/apply-mapping`, so very large CSV activations fail there.
- **AI service** (`ai-service/vercel.json`): Vercel's zero-config FastAPI detection, same region. Its per-user data is held in memory;
  the gateway restores it from the database when a request lands on a copy that does not have it.

## Before you expose it publicly

1. Set `JWT_SECRET` and `AI_SERVICE_TOKEN`.
2. **There are no built-in accounts** (the old public demo logins were removed). Sign-up is open to anyone who can reach the frontend, by
   Google or by email and password; there is no invite list or approval step yet, no email verification or password reset for email
   accounts. Five wrong passwords for one address pause sign-in for that address for 15 minutes (per server copy). See `docs/AUTHENTICATION.md`.
3. Set `CORS_ORIGINS` on the gateway to the frontend's address (unset allows every origin). The ai-service is called only by the gateway and is protected by `AI_SERVICE_TOKEN`.
4. Rate limiting covers questions (30 per minute per user), the assistant (15 per minute per user) and wrong passwords. Uploads are limited to 2 MB, 5,000 rows and 60 columns.
5. Nothing secret reaches the browser: the only public setting is `VITE_API_URL`.

## What was verified, and what was not

*Verified locally (2026-09-30):*

- The compiled gateway (`node dist/main`) with `NODE_ENV=production`, a strong `JWT_SECRET`, a **scheme-less** `AI_SERVICE_URL`, a separate
  `DATABASE_PATH` and a shared `AI_SERVICE_TOKEN`, against an ai-service that enforces the token (401 without it, 200 with it):
  `scripts/smoke_demo.py` **36/36** on an empty database (it signs up its own account; Google correctly answers 503 "not configured").
- **Startup guards, for real on the production build:** the gateway refuses to start with `NODE_ENV=production` and no `JWT_SECRET`, with the
  old placeholder or fallback value, or with `FIREBASE_AUTH_EMULATOR_HOST` set.
- The workspace recovery under a production-style configuration: kill and restart the ai-service three times (chosen dataset, 600-row
  upload, fetched context): **18/18** checks. (Run before the sign-in change; that code path is untouched.)
- Clean installs from a copy of the working tree: the pinned `requirements-dev.txt` (fastapi 0.110.0, pydantic 2.6.4, PyMuPDF 1.24.1)
  passes the whole ai-service suite and the 40-case evaluation; `npm ci` gives a gateway that passes its tests and builds;
  the frontend typechecks and builds.

*Not verified (needs the real host or other tooling):*

- The Render Blueprint itself (`hostport`, `PYTHON_VERSION`, prompted secrets) and Render's private networking.
- The Vercel function settings (`maxDuration`, body limit, FastAPI detection) and the frontend served from a static host over HTTPS
  (CORS from a real origin).
- Google sign-in against a **real** Firebase project and a real Google account, and from a deployed origin (it was verified end to end against
  the Firebase Auth emulator only: `docs/AUTHENTICATION.md`).
- Docker: there are no Dockerfiles. The old `docker-compose.yml` and the empty `ai-service/Dockerfile` never worked and were removed;
  run the three services with the commands in the README.
- Node 20 and 22, Python 3.11, macOS and Linux.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Gateway returns 503 "The decision service is temporarily unavailable" | ai-service down or still waking; check `AI_SERVICE_URL`; retry |
| Gateway logs 401 from the ai-service | `AI_SERVICE_TOKEN` differs between the two services |
| 413 when activating a CSV | request body over the limit (Vercel about 4.5 MB, gateway 6 MB on that route) |
| Numbers differ from `docs/DECISIONFORGE_DEMO.md` | click **Start Over**, then load the dataset again (this also restores the default policy) |
| After a restart the app still shows the dataset you chose | expected: the workspace was restored; the audit log shows `WORKSPACE_RESTORED` |
