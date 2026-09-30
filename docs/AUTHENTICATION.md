# Authentication

Two ways to have an account, and **no built-in accounts**: nothing is seeded, so a fresh install has zero users.

| Method | Sign up | Sign in | Notes |
|---|---|---|---|
| **Google, through Firebase** | first Google sign-in creates the account | Google again | who you are comes from a verified Firebase ID token, never from the request body |
| **Email + password** | `POST /api/auth/register` | `POST /api/auth/login` | bcrypt, at least 8 characters, email stored lowercase |

The app itself runs on the gateway's own session token (a JWT, 7 days). Firebase is used only to prove who someone is at the moment they sign in.

## How Google sign-in works

```
Browser                         Google / Firebase                Gateway (NestJS)
   | signInWithPopup ---------------> account chooser
   | <------------ Firebase ID token (RS256, signed by Google)
   | POST /api/auth/google { idToken } ---------------------------->  verify token
   |                                                                   find / create / link the user
   | <----------------------------------- { access_token, user, is_new_user }
   | signOut of Firebase (the gateway session is now the only one)
```

The gateway accepts a token only if **all** of these hold (`backend/src/auth/firebase-token.verifier.ts`):

- RS256, and the signature verifies against Google's published keys for Firebase (`kid` must match);
- `iss` is `https://securetoken.google.com/<FIREBASE_PROJECT_ID>` and `aud` is `<FIREBASE_PROJECT_ID>`;
- not expired, not used before its `nbf`, `sub` present (at most 128 characters), `auth_time` not in the future;
- an email is present **and verified**;
- the sign-in provider is `google.com` (a valid token for any other provider, such as password or GitHub, is refused).

No secret or service-account key is stored on the gateway: verifying a Firebase ID token needs only the public keys and the project id.

### Account rules

| Situation | Result |
|---|---|
| First Google sign-in for this Google account and email | account created (`is_new_user: true`); the optional sign-up choices in the body (mode, business name, job title, income) apply to this new account only |
| Same Google account again | the same account; sign-up choices are never re-applied to a returning person |
| The verified email already belongs to an **email + password** account | that account is **linked** (data kept) and its old password is **retired** |
| The email is linked to a different Google account | `409`, nothing changes |
| Unverified email, another provider, expired or forged token | `401`, nothing is created |
| Google sign-in not configured on the server | `503` with a clear message; email + password keeps working |

Why the old password is retired on linking: an email + password sign-up is not verified, so someone could register a stranger's address in advance and wait. Once the real owner proves the address through Google, the old password stops working, so it cannot be used to get into the account afterwards. (A person who used both loses the password and signs in with Google from then on.)

## What was wrong before, and is fixed

Found while adding Google sign-in (details in `docs/CODEBASE_AUDIT.md`, section 9):

- **`POST /api/auth/firebase-login` signed anyone in as any email.** It took `email` from the request body and issued a session with no token check, so anyone who could reach the gateway could take over any account or create one. It is removed; the frontend never sent the ID token, so there was nothing to verify.
- **Hard-coded fallback JWT secret** (`fallback_secret`) when `JWT_SECRET` was unset, and a public example value in `.env.example`. Now: production **refuses to start** without a strong, non-placeholder secret; development uses a random per-process key.
- **Mass assignment.** `register` and `PATCH /users/profile` wrote whatever fields the body contained (including `email`, `password`, and now `firebase_uid`). Both now accept an explicit list of profile fields only.
- **Seeded accounts** (`demo@…`, `admin@…`, password `demo123`) created on every start, and advertised on the login page. Removed, with their sample data.
- Logout waited for Firebase before clearing the local session; the local session is now cleared first.

## Setting up Google sign-in with your Firebase project

You need a Firebase project (free plan is enough).

1. **Firebase console** > your project > **Authentication** > *Get started* > **Sign-in method** > **Google** > enable, pick a support email, save.
2. **Project settings** > *General* > *Your apps* > add a **Web** app (`</>`) and copy its `firebaseConfig` values.
3. **Authentication** > *Settings* > **Authorized domains**: `localhost` is there by default; add every domain the app is served from.
4. Put the values in place, then restart both servers (Vite reads `frontend/.env` only at start-up):

   ```bash
   # frontend/.env  (copy frontend/.env.example)
   VITE_FIREBASE_API_KEY=...          # apiKey
   VITE_FIREBASE_AUTH_DOMAIN=...      # authDomain, for example my-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=...       # projectId
   VITE_FIREBASE_APP_ID=...           # appId

   # backend/.env  (copy backend/.env.example)
   FIREBASE_PROJECT_ID=...            # the SAME project id
   JWT_SECRET=...                     # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

5. Open `/register` or `/login` and use **Sign up with Google** or **Continue with Google**.

The `VITE_FIREBASE_*` values are public identifiers, not secrets (they end up in the browser bundle); the only thing that matters server-side is that `FIREBASE_PROJECT_ID` equals the project the frontend signs in against. With those empty, the Google button is shown disabled with an explanation.

**Deployed:** set `FIREBASE_PROJECT_ID` on the gateway, the `VITE_FIREBASE_*` values at the frontend **build**, and add the deployed domain to *Authorized domains*.

## Testing without a Google account: the Firebase Auth emulator

The Firebase CLI's Auth emulator supplies fake Google accounts, so the whole popup flow can be exercised locally with no real account and no real project (a `demo-` project id needs no login):

```bash
firebase emulators:start --only auth --project demo-bizpulse            # emulator on 127.0.0.1:9099

# gateway (development mode only)
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIREBASE_PROJECT_ID=demo-bizpulse npm run start:dev

# frontend
VITE_FIREBASE_API_KEY=fake-api-key VITE_FIREBASE_AUTH_DOMAIN=localhost VITE_FIREBASE_PROJECT_ID=demo-bizpulse \
VITE_FIREBASE_APP_ID=1:0:web:0 VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run dev
```

The popup then shows the emulator's account chooser ("Add new account" and fill in an email).

Emulator tokens are **unsigned**, so the gateway cannot check them with keys; in this mode it asks the emulator to look the token up. That code path exists for local development only: **the gateway refuses to start if `FIREBASE_AUTH_EMULATOR_HOST` is set while `NODE_ENV=production`**, and production frontend builds ignore `VITE_FIREBASE_AUTH_EMULATOR_HOST`.

## How it was verified

| Check | Result |
|---|---|
| Token verifier: real RS256 tokens signed with local keys, including `alg: none`, HS256 key confusion, wrong audience/issuer, expired, tampered, foreign key, unverified email, outages | 46 tests; each rule was also broken on purpose and the tests failed |
| Account logic: sign-up, sign-in, linking and the retired password, mass assignment, the double-click race, error mapping | 43 tests, with the same break-it-on-purpose check |
| The whole gateway over HTTP with an in-memory database (no seeded users, the removed route, forged tokens, startup guards) | 21 tests |
| Google sign-in against the Firebase Auth **emulator** through the gateway (`e2e/google-signin.emulator.api.py`) | 20 of 20 |
| The same flow in a **real browser** (Chromium driven by Playwright) through the emulator's popup: sign-up, onboarding, dashboard, DecisionForge, logout, sign-in again to the same account, closed popup, unverified email, email sign-up, refused demo login, clean console (`e2e/google-signin.emulator.js`, repeated three times in a row) | 21 of 21 |
| `scripts/smoke_demo.py` (sign-up, sign-in, the whole DecisionForge path) on a fresh database | 34 of 34 |
| The same on the compiled gateway with `NODE_ENV=production`, a strong `JWT_SECRET` and the ai-service token enforced | 36 of 36 |
| The production build **refusing to start**: no `JWT_SECRET`, the old placeholder, the old hard-coded fallback, `FIREBASE_AUTH_EMULATOR_HOST` set | 4 of 4 refused |

The whole gateway suite is 199 tests (`cd backend && npx jest`).

**Not verified:** a real Google account against a real Firebase project (needs your project and an interactive login), the deployed origin, and Firebase's behaviour on a hosted domain.

## Known limits

- **No email verification or password reset** for email + password accounts, and **no rate limiting or lockout** on `/auth/login`.
- **Sessions cannot be revoked** before they expire (7 days); disabling a Google account does not end an existing session. The token is kept in `localStorage`, as before.
- Whether an account has finished mode selection is remembered only in the browser.
- **The finance dashboard invents figures for an account with no data**: the analytics service assumes a baseline monthly income (₹2,20,000 for business accounts, ₹1,50,000 otherwise) when none is entered, so a new account sees revenue and a month-end balance it never had (`backend/src/analytics/analytics.service.ts`). It was hidden when a seeded demo user always had data. DecisionForge is unaffected.
