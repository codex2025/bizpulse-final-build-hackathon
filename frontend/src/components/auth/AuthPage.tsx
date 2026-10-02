import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Mail, Lock, User, Eye, EyeOff, TrendingUp, Shield,
  BarChart3, FileText
} from 'lucide-react';
import { authService } from '../../services/authService';
import { isFirebaseConfigured } from '../../firebase/firebaseConfig';

interface AuthPageProps {
  mode: 'login' | 'register';
}

const features = [
  { icon: BarChart3, title: 'Commercial Analytics', desc: 'Real-time operational cashflow velocity & margin intelligence' },
  { icon: FileText, title: 'Contract Intelligence', desc: 'Identify loan covenants, penalty risks & personal guarantees' },
  { icon: TrendingUp, title: 'DecisionForge Engine', desc: 'Mathematical deal prioritization & win probability scoring' },
  { icon: Shield, title: 'Enterprise Security', desc: 'Encrypted at rest, JWT authenticated session tokens' },
];

export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Mode selection is for NEW accounts only. Whether an account has been through it is not stored anywhere but this
  // browser (and is cleared on logout), so a returning person is never sent back through it, and a brand-new account
  // always is, even if an earlier person on this browser had finished it.
  const goAfterSignIn = (isNewAccount: boolean) => {
    if (isNewAccount) localStorage.removeItem('bizpulse_onboarded');
    else localStorage.setItem('bizpulse_onboarded', 'true');
    navigate(isNewAccount ? '/onboarding' : '/');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const session = await authService.loginWithGoogle();
      goAfterSignIn(session.is_new_user === true);
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await authService.login(form.email, form.password);
        goAfterSignIn(false);
      } else {
        await authService.register({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
        });
        goAfterSignIn(true);
      }
    } catch (err: unknown) {
      let msg = 'Authentication error. Please verify your credentials.';
      if (err instanceof Error) msg = err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden bg-slate-50">
      {/* Left panel - branding */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="hidden lg:flex flex-col justify-between w-1/2 p-16 relative overflow-hidden border-r border-slate-200 bg-white"
      >
        {/* Subtle decorative glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-cobalt-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-cobalt-600 rounded-xl flex items-center justify-center shadow-lg shadow-cobalt-600/20">
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-2xl font-black text-ink-900 tracking-tight">Bizpulse</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-8 max-w-lg">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-4xl lg:text-5xl font-black text-ink-900 leading-tight mb-4 tracking-tight"
            >
              Financial intelligence,<br />
              <span className="text-cobalt-600">purpose-built for business.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-slate-500 text-base font-medium leading-relaxed"
            >
              Enterprise cashflow telemetry, legal contract intelligence, automated decision progression, and GST tax invoicing in a unified operating architecture.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="grid grid-cols-2 gap-3.5"
          >
            {features.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 + i * 0.06 }}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-cobalt-300 hover:bg-white transition-all shadow-2xs hover:shadow-xs"
              >
                <Icon size={18} className="text-cobalt-600 mb-2" />
                <p className="text-xs font-bold text-ink-900 mb-0.5">{title}</p>
                <p className="text-[11px] text-slate-500 font-medium leading-normal">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* System footer */}
        <div className="relative z-10 flex items-center gap-2 text-xs text-slate-400 font-medium">
          <Zap size={13} className="text-cobalt-600" />
          <span>Bizpulse Financial Operating Engine • v2.4 Production</span>
        </div>
      </motion.div>

      {/* Right panel - auth form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-sm space-y-6"
        >
          {/* Mobile logo + tagline */}
          <div className="mb-4 lg:hidden">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-cobalt-600 rounded-lg flex items-center justify-center">
                <Zap size={16} className="text-white" />
              </div>
              <span className="text-xl font-black text-ink-900">Bizpulse</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Financial intelligence for modern business</p>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-ink-900 mb-1.5 tracking-tight">
              {mode === 'login' ? 'Welcome back 👋' : 'Create your account'}
            </h1>
            <p className="text-slate-500 font-medium text-xs">
              {mode === 'login'
                ? 'Sign in to access your financial intelligence portal'
                : 'Sign up to configure your personalized enterprise workspace.'}
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-vermilion-50 border border-vermilion-200 rounded-xl p-3 text-vermilion-700 text-xs font-semibold flex items-center gap-2"
              >
                <span className="w-4 h-4 rounded-full bg-vermilion-200 text-vermilion-800 flex items-center justify-center text-[10px] font-black">!</span>
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Google Sign-in Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading || !isFirebaseConfigured}
            data-testid="google-sign-in"
            title={isFirebaseConfigured ? undefined : 'Google sign-in is not configured on this build'}
            className={`w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-3 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${isFirebaseConfigured ? 'mb-4' : 'mb-2'}`}
          >
            {googleLoading ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="w-4 h-4 border-2 border-cobalt-600 border-t-transparent rounded-full block"
              />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}</span>
          </motion.button>
          {!isFirebaseConfigured && (
            <p className="text-[11px] text-slate-400 font-medium mb-4 text-center" data-testid="google-not-configured">
              Google sign-in isn't set up on this build yet.
              {import.meta.env.DEV ? ' Add your Firebase web config to frontend/.env (see the README).' : ''}
            </p>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">or continue with email</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'register' && (
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  className="input-field pl-9 text-xs font-semibold"
                  value={form.full_name}
                  onChange={e => update('full_name', e.target.value)}
                />
              </div>
            )}

            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                placeholder="Work email address"
                required
                autoFocus
                className={`input-field pl-9 text-xs font-semibold ${
                  emailError ? 'border-vermilion-400 ring-1 ring-vermilion-300' : ''
                }`}
                value={form.email}
                onChange={e => { update('email', e.target.value); setEmailError(''); }}
                onBlur={e => {
                  const v = e.target.value;
                  if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
                    setEmailError('Please enter a valid email address.');
                  }
                }}
              />
              {emailError && <p className="text-[10.5px] text-vermilion-600 font-semibold mt-1">{emailError}</p>}
            </div>

            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder={mode === 'register' ? 'Password (at least 8 characters)' : 'Password'}
                required
                minLength={mode === 'register' ? 8 : undefined}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="input-field pl-9 pr-10 text-xs font-semibold"
                value={form.password}
                onChange={e => update('password', e.target.value)}
              />
              <button
                type="button"
                aria-label={showPass ? "Hide password" : "Show password"}
                onClick={() => setShowPass(!showPass)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-xs font-extrabold rounded-xl cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full block"
                  />
                  {mode === 'login' ? 'Signing in...' : 'Registering...'}
                </span>
              ) : mode === 'login' ? 'Sign In →' : 'Continue to Workspace Mode →'}
            </motion.button>
          </form>

          <p className="text-center text-xs text-slate-500 font-medium">
            {mode === 'login' ? (
              <>
                Don't have an account? <Link to="/register" className="inline-block py-2 text-cobalt-600 hover:text-cobalt-700 font-bold">Sign up free</Link>
                <span className="mx-2 text-slate-300">•</span>
                <button type="button" onClick={() => setShowForgot(true)} className="py-2 text-cobalt-600 hover:text-cobalt-700 font-bold cursor-pointer">Forgot password?</button>
              </>
            ) : (
              <>Already have an account? <Link to="/login" className="text-cobalt-600 hover:text-cobalt-700 font-bold">Sign in</Link></>
            )}
          </p>

          {/* Forgot Password Modal */}
          {showForgot && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-sm space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-ink-900">Reset Password</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">We'll send a reset link to your email</p>
                  </div>
                  <button type="button" onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer">
                    ×
                  </button>
                </div>

                {forgotSent ? (
                  <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold">
                    ✓ If an account exists for <strong>{forgotEmail}</strong>, a reset link has been sent.
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        autoFocus
                        placeholder="Account email address"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        className="input-field pl-9 text-xs font-semibold w-full"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!forgotEmail}
                      onClick={() => setForgotSent(true)}
                      className="w-full btn-primary py-2.5 text-xs font-extrabold rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      Send Reset Link
                    </button>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
