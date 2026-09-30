# Google sign-in checks (Firebase Auth emulator)

Reproduces the Google sign-up / sign-in verification **without a real Google account or Firebase project**. The Firebase CLI's Auth
emulator supplies fake Google accounts; the app runs unchanged except for three environment switches. Test instances only: these
scripts create accounts, so never point them at a real deployment.

Two checks:

| File | What it does |
|---|---|
| `google-signin.emulator.js` | A real Chromium (Playwright) clicks **Sign up with Google** and drives the emulator's popup: sign-up, mode selection, the dashboard, DecisionForge, logout, sign-in again (same account, no second onboarding), a closed popup, an unverified email, email + password sign-up, and the refused seeded login. 21 checks. |
| `google-signin.emulator.api.py` | The same at the API level, no browser: the emulator issues tokens for fake Google accounts and the gateway is asked to accept or refuse them (tampered, garbage, unverified email, non-Google provider, linking to an existing password account, the removed `firebase-login` route). 20 checks. |

## Run it

Prerequisites: Node 20+, the Firebase CLI (`npm i -g firebase-tools`, Java 11+ is not needed for the Auth emulator), the ai-service already
running on `:8000` (`cd ai-service && uvicorn app.main:app --port 8000`), and once: `cd e2e && npm install && npx playwright install chromium`.

Use four terminals (bash syntax; in PowerShell set variables with `$env:NAME = "value"` first).

```bash
# 1. the Auth emulator (a demo- project id needs no login)
cd e2e && firebase emulators:start --only auth --project demo-bizpulse

# 2. a SEPARATE gateway in emulator mode, with its own throwaway database (development mode only).
#    Run the compiled build, not a second `npm run start:dev`: two watchers would fight over backend/dist.
cd backend && npm run build && PORT=3201 DATABASE_PATH=/tmp/bizpulse-e2e.db AI_SERVICE_URL=localhost:8000 \
  FIREBASE_PROJECT_ID=demo-bizpulse FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node dist/main

# 3. a SEPARATE frontend wired to the gateway and the emulator (production builds ignore the emulator variable)
cd frontend && VITE_API_URL=http://localhost:3201/api VITE_FIREBASE_API_KEY=fake-api-key VITE_FIREBASE_AUTH_DOMAIN=localhost \
  VITE_FIREBASE_PROJECT_ID=demo-bizpulse VITE_FIREBASE_APP_ID=1:0:web:0 VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
  npx vite --port 5273 --strictPort

# 4. the checks
cd e2e && node google-signin.emulator.js          # the browser test  (HEADED=1 to watch it)
cd e2e && python google-signin.emulator.api.py    # the API check
```

Defaults match the commands above; override with `APP_URL`, `GATEWAY_URL` (including `/api`) and `EMULATOR_URL` if you used other ports.

## Why the gateway needs a special mode for this

Tokens from the emulator are **unsigned**, so they cannot be verified with Google's keys. With `FIREBASE_AUTH_EMULATOR_HOST` set (development
only) the gateway asks the emulator to look the token up instead. That switch is refused in production: the gateway will not start with it
set while `NODE_ENV=production`, because it would accept forged tokens. See `docs/AUTHENTICATION.md`.
