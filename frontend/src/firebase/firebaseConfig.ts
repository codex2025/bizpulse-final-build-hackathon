import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';

const env = import.meta.env;

/** An unset variable, an empty one and the literal string "undefined" (a common .env slip) all mean "not provided". */
const clean = (value: unknown): string => (typeof value === 'string' && value.trim() && value.trim() !== 'undefined' ? value.trim() : '');

// The Firebase *web* config is public by design (it identifies the project, it is not a secret), so it lives in
// frontend/.env as VITE_FIREBASE_* and ends up in the bundle. See README.md ("Google sign-in").
const firebaseConfig = {
  apiKey: clean(env.VITE_FIREBASE_API_KEY),
  authDomain: clean(env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: clean(env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: clean(env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(env.VITE_FIREBASE_APP_ID),
};

/**
 * Google sign-in needs at least a key and a project id (the gateway checks every token against the project id,
 * FIREBASE_PROJECT_ID, which must be the same project).
 */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Initialise Firebase only when a configuration is present, so the app still runs (email sign-in) without one.
export const app = isFirebaseConfigured ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()) : null;
export const auth = app ? getAuth(app) : null;

// Local development against the Firebase Auth emulator (`firebase emulators:start --only auth`). `import.meta.env.DEV`
// is false in a production build, so Vite removes this branch and a deployed app can never talk to an emulator.
const emulatorHost = clean(env.VITE_FIREBASE_AUTH_EMULATOR_HOST);
if (auth && env.DEV && emulatorHost) {
  connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
