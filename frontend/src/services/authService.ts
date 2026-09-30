import api from './api';
import { auth, googleProvider, isFirebaseConfigured } from '../firebase/firebaseConfig';
import { signInWithPopup, signOut } from 'firebase/auth';

/** What the gateway returns for every kind of sign-in. `is_new_user` is true when the account was just created. */
export interface AuthSession {
  access_token: string;
  is_new_user?: boolean;
  user: {
    id: string;
    email: string;
    full_name: string;
    business_name?: string;
    persona_type?: string;
    job_title?: string;
    monthly_income?: number;
    avatar_url?: string | null;
    auth_provider?: string;
  };
}

/** Keeps the gateway's session token (our own JWT) and the person's mode where the rest of the app reads them. */
function rememberSession(data: AuthSession) {
  localStorage.setItem('access_token', data.access_token);
  const mode = data?.user?.persona_type;
  if (mode) {
    localStorage.setItem('bizpulse_persona', mode);
    localStorage.setItem('bizpulse_account_persona', mode);
    localStorage.setItem('bizpulse_active_view', mode);
  }
}

/** The gateway's message (a string, or a list from validation), if it sent one. */
function gatewayMessage(err: any): string | undefined {
  const message = err?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  return typeof message === 'string' && message ? message : undefined;
}

/** Turns a Firebase or gateway failure into something a person can act on. */
function googleErrorMessage(err: any): string {
  switch (err?.code as string | undefined) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/network-request-failed':
      return 'Could not reach Google. Check your connection and try again.';
    case 'auth/unauthorized-domain':
      return 'This address is not authorised for Google sign-in. In the Firebase console open Authentication, Settings, Authorized domains and add it.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this Firebase project. In the Firebase console open Authentication, Sign-in method and enable Google.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    case 'auth/auth-domain-config-required':
    case 'auth/configuration-not-found':
      return 'The Firebase web configuration is incomplete or wrong. Check the VITE_FIREBASE_* values in frontend/.env.';
    case 'auth/account-exists-with-different-credential':
      return 'An account with this email already exists and uses a different sign-in method.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
  }
  return gatewayMessage(err) || 'Google sign-in failed. Please try again.';
}

export const GOOGLE_NOT_CONFIGURED_MESSAGE =
  'Google sign-in is not set up on this build yet. Add the Firebase web configuration to frontend/.env (see the README) and restart the dev server.';

export const authService = {
  /** Email + password, checked by the gateway. */
  async login(email: string, password: string): Promise<AuthSession> {
    try {
      const res = await api.post('/auth/login', { email, password });
      rememberSession(res.data);
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 401) {
        throw new Error('Invalid email or password. If you signed up with Google, use "Continue with Google".');
      }
      throw new Error(gatewayMessage(err) || 'Sign-in failed. Please try again.');
    }
  },

  /** Creates an email + password account. */
  async register(data: { email: string; password: string; full_name: string; [key: string]: unknown }): Promise<AuthSession> {
    try {
      const res = await api.post('/auth/register', data);
      rememberSession(res.data);
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 409) {
        throw new Error('This email is already registered. Sign in instead (or use "Continue with Google" if you signed up with it).');
      }
      throw new Error(gatewayMessage(err) || 'Registration failed. Please check your details.');
    }
  },

  /**
   * Google sign-up and sign-in (one flow: the account is created on first use). The Google popup gives a Firebase ID
   * token, which is sent to the gateway; the gateway verifies it against Google's keys and answers with our own
   * session token. Who the person is comes from the verified token, never from anything typed into this page.
   */
  async loginWithGoogle(): Promise<AuthSession> {
    if (!isFirebaseConfigured || !auth) throw new Error(GOOGLE_NOT_CONFIGURED_MESSAGE);
    try {
      let idToken: string;
      try {
        const credential = await signInWithPopup(auth, googleProvider);
        idToken = await credential.user.getIdToken();
      } catch (err) {
        throw new Error(googleErrorMessage(err));
      }
      try {
        const res = await api.post('/auth/google', { idToken });
        rememberSession(res.data);
        return res.data;
      } catch (err) {
        throw new Error(googleErrorMessage(err));
      }
    } finally {
      // Firebase only proved who the person is; the app runs on the gateway's own session. Clearing Firebase's
      // stored sign-in avoids a second, stale session living in the browser.
      signOut(auth).catch(() => undefined);
    }
  },

  async logout() {
    // The local session goes first and synchronously, so the token is gone the moment the person clicks "Logout",
    // whatever Firebase's own sign-out does (it used to run first, and a slow one left the token in place).
    localStorage.removeItem('access_token');
    localStorage.removeItem('bizpulse_persona');
    localStorage.removeItem('bizpulse_account_persona');
    localStorage.removeItem('bizpulse_active_view');
    localStorage.removeItem('bizpulse_onboarded');
    localStorage.removeItem('bizpulse_mode_switches');
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn('Firebase signout error:', e);
      }
    }
  },

  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  },
};
