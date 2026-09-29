import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Mail, Lock, User, Eye, EyeOff, TrendingUp, Shield,
  BarChart3, FileText
} from 'lucide-react';
import { authService } from '../../services/authService';

interface AuthPageProps {
  mode: 'login' | 'register';
}

const features = [
  { icon: BarChart3, title: 'Smart Analytics', desc: 'Real-time cash flow insights & trend predictions' },
  { icon: FileText, title: 'Contract AI', desc: 'Analyze contracts with Antigravity Intelligence' },
  { icon: TrendingUp, title: 'Growth Tracking', desc: 'Historical data & profit forecasting' },
  { icon: Shield, title: 'Bank-grade Security', desc: 'Firebase + JWT-secured, encrypted at rest' },
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

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await authService.loginWithGoogle();
      const isOnboarded = localStorage.getItem('bizpulse_onboarded');
      if (isOnboarded) {
        navigate('/');
      } else {
        navigate('/onboarding');
      }
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
        const isOnboarded = localStorage.getItem('bizpulse_onboarded');
        navigate(isOnboarded ? '/' : '/onboarding');
      } else {
        await authService.register({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
        });
        navigate('/onboarding');
      }
    } catch (err: any) {
      setError(err.message || err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden bg-slate-50">
      {/* Left panel - branding */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="hidden lg:flex flex-col justify-between w-1/2 p-16 relative overflow-hidden border-r border-slate-200 bg-white"
      >
        {/* Decorative orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-indigo-500/5 rounded-full blur-2xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30">
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-2xl font-black gradient-text tracking-tight">Bizpulse</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-8">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-5xl font-black text-slate-900 leading-tight mb-4"
            >
              Financial intelligence,<br />
              <span className="gradient-text">customized for you.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-slate-500 text-lg font-medium leading-relaxed"
            >
              Enterprise SME billing, freelancer milestone tracking, employee salary budgets, and personal daily expense management — all in one AI-powered hub.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="grid grid-cols-2 gap-4"
          >
            {features.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + i * 0.08 }}
                className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-brand-500/30 hover:bg-white transition-all shadow-xs hover:shadow-md"
              >
                <Icon size={20} className="text-brand-600 mb-2" />
                <p className="text-sm font-bold text-slate-900 mb-1">{title}</p>
                <p className="text-xs text-slate-500 font-medium">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Powered by */}
        <div className="relative z-10 flex items-center gap-2 text-xs text-slate-400">
          <Zap size={12} className="text-brand-600" />
          <span>Powered by <span className="text-brand-700 font-bold uppercase tracking-tight">Antigravity Intelligence</span></span>
        </div>
      </motion.div>

      {/* Right panel - auth form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-violet-600 rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-xl font-black gradient-text">Bizpulse</span>
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-1.5">
            {mode === 'login' ? 'Welcome back 👋' : 'Create your account'}
          </h1>
          <p className="text-slate-500 font-medium text-xs mb-6">
            {mode === 'login'
              ? 'Sign in to access your financial intelligence portal'
              : 'Sign up to configure your personalized financial workspace.'}
          </p>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-500 text-xs font-semibold flex items-center gap-2"
              >
                <span className="w-4 h-4 rounded-full bg-red-500/30 flex items-center justify-center text-[10px] font-black">!</span>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Google Sign-in Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-3 shadow-xs transition-all cursor-pointer disabled:opacity-50 mb-4"
          >
            {googleLoading ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full block"
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

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">or with email</span>
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
                placeholder="Email address"
                required
                className="input-field pl-9 text-xs font-semibold"
                value={form.email}
                onChange={e => update('email', e.target.value)}
              />
            </div>

            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Password"
                required
                className="input-field pl-9 pr-10 text-xs font-semibold"
                value={form.password}
                onChange={e => update('password', e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {mode === 'login' && (
              <div className="bg-slate-100/70 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
                  <Zap size={12} className="text-brand-600" />
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Try demo: <span className="text-brand-700 font-bold">demo@bizpulse.com</span> / <span className="text-brand-700 font-bold">demo123</span>
                </p>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm font-extrabold rounded-xl mt-2 relative overflow-hidden cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full block"
                  />
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : mode === 'login' ? 'Sign In →' : 'Continue to Mode Selection →'}
            </motion.button>
          </form>

          <p className="text-center text-xs text-slate-500 font-medium mt-5">
            {mode === 'login' ? (
              <>Don't have an account? <Link to="/register" className="text-brand-600 hover:text-brand-700 font-bold transition-colors">Sign up free</Link></>
            ) : (
              <>Already have an account? <Link to="/login" className="text-brand-600 hover:text-brand-700 font-bold transition-colors">Sign in</Link></>
            )}
          </p>
        </motion.div>
      </div>
    </div>
  );
};
