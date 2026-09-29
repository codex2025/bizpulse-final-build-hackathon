import api from './api';
import { auth, googleProvider, isFirebaseConfigured } from '../firebase/firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

export const authService = {
  async login(email: string, password: string) {
    if (isFirebaseConfigured && auth) {
      try {
        // 1. Sign in with Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 2. Synchronize with Bizpulse Backend
        const res = await api.post('/auth/firebase-login', {
          email: user.email,
          full_name: user.displayName || user.email?.split('@')[0],
        });

        localStorage.setItem('access_token', res.data.access_token);
        if (res.data?.user?.persona_type) {
          const pt = res.data.user.persona_type;
          localStorage.setItem('bizpulse_persona', pt);
          localStorage.setItem('bizpulse_account_persona', pt);
          localStorage.setItem('bizpulse_active_view', pt);
        }
        return res.data;
      } catch (firebaseErr: any) {
        // Fallback for built-in local backend accounts
        try {
          const res = await api.post('/auth/login', { email, password });
          localStorage.setItem('access_token', res.data.access_token);
          if (res.data?.user?.persona_type) {
            const pt = res.data.user.persona_type;
            localStorage.setItem('bizpulse_persona', pt);
            localStorage.setItem('bizpulse_account_persona', pt);
            localStorage.setItem('bizpulse_active_view', pt);
          }
          return res.data;
        } catch {
          let message = firebaseErr.message || 'Authentication failed';
          if (firebaseErr.code === 'auth/user-not-found' || firebaseErr.code === 'auth/wrong-password' || firebaseErr.code === 'auth/invalid-credential') {
            message = 'Invalid email or password.';
          } else if (firebaseErr.code === 'auth/invalid-email') {
            message = 'Invalid email address.';
          } else if (firebaseErr.code === 'auth/too-many-requests') {
            message = 'Too many failed login attempts. Please try again later.';
          }
          throw new Error(message);
        }
      }
    }

    // Direct NestJS Backend Authentication
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('access_token', res.data.access_token);
      if (res.data?.user?.persona_type) {
        const pt = res.data.user.persona_type;
        localStorage.setItem('bizpulse_persona', pt);
        localStorage.setItem('bizpulse_account_persona', pt);
        localStorage.setItem('bizpulse_active_view', pt);
      }
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid email or password.';
      throw new Error(msg);
    }
  },

  async register(data: any) {
    if (isFirebaseConfigured && auth) {
      try {
        // 1. Create user in Firebase
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        const user = userCredential.user;

        // 2. Sync profile and financial persona to Bizpulse backend
        const res = await api.post('/auth/firebase-login', {
          email: user.email,
          full_name: data.full_name || user.displayName || user.email?.split('@')[0],
          persona_type: data.persona_type || 'business',
          business_name: data.business_name || '',
          job_title: data.job_title || '',
          monthly_income: data.monthly_income || 0,
        });

        localStorage.setItem('access_token', res.data.access_token);
        if (res.data?.user?.persona_type) {
          const pt = res.data.user.persona_type;
          localStorage.setItem('bizpulse_persona', pt);
          localStorage.setItem('bizpulse_account_persona', pt);
          localStorage.setItem('bizpulse_active_view', pt);
        }
        return res.data;
      } catch (firebaseErr: any) {
        try {
          const res = await api.post('/auth/register', data);
          localStorage.setItem('access_token', res.data.access_token);
          if (res.data?.user?.persona_type) {
            const pt = res.data.user.persona_type;
            localStorage.setItem('bizpulse_persona', pt);
            localStorage.setItem('bizpulse_account_persona', pt);
            localStorage.setItem('bizpulse_active_view', pt);
          }
          return res.data;
        } catch {
          let message = firebaseErr.message || 'Registration failed';
          if (firebaseErr.code === 'auth/email-already-in-use') {
            message = 'This email is already registered. Please sign in instead.';
          } else if (firebaseErr.code === 'auth/weak-password') {
            message = 'Password should be at least 6 characters.';
          } else if (firebaseErr.code === 'auth/invalid-email') {
            message = 'Invalid email format.';
          }
          throw new Error(message);
        }
      }
    }

    // Direct NestJS Backend Registration
    try {
      const res = await api.post('/auth/register', data);
      localStorage.setItem('access_token', res.data.access_token);
      if (res.data?.user?.persona_type) {
        const pt = res.data.user.persona_type;
        localStorage.setItem('bizpulse_persona', pt);
        localStorage.setItem('bizpulse_account_persona', pt);
        localStorage.setItem('bizpulse_active_view', pt);
      }
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Registration failed. Please check your details.';
      throw new Error(msg);
    }
  },

  async loginWithGoogle(persona?: string) {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Google Sign-In is only enabled when Firebase is configured.');
    }
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;

      const res = await api.post('/auth/firebase-login', {
        email: user.email,
        full_name: user.displayName || user.email?.split('@')[0],
        persona_type: persona || 'business',
      });

      localStorage.setItem('access_token', res.data.access_token);
      if (res.data?.user?.persona_type) {
        const pt = res.data.user.persona_type;
        localStorage.setItem('bizpulse_persona', pt);
        localStorage.setItem('bizpulse_account_persona', pt);
        localStorage.setItem('bizpulse_active_view', pt);
      }
      return res.data;
    } catch (firebaseErr: any) {
      if (firebaseErr.code === 'auth/popup-closed-by-user') {
        throw new Error('Google Sign-In was cancelled.');
      }
      throw new Error(firebaseErr.message || 'Google Sign-In failed.');
    }
  },

  async logout() {
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn('Firebase signout error:', e);
      }
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('bizpulse_persona');
    localStorage.removeItem('bizpulse_account_persona');
    localStorage.removeItem('bizpulse_active_view');
    localStorage.removeItem('bizpulse_onboarded');
    localStorage.removeItem('bizpulse_mode_switches');
  },

  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  },
};

