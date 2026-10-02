import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Laptop, Wallet, Save, LogOut,
  User, Briefcase, DollarSign,
  TrendingDown, Settings as SettingsIcon, Lock, ArrowRightLeft, CheckCircle2, Compass,
  Eye, EyeOff, Key, Sun, Moon, Monitor, Palette
} from 'lucide-react';
import { Topbar } from '../common/Topbar';
import { userService } from '../../services/userService';
import { authService } from '../../services/authService';
import { usePersona, PERSONA_CONFIGS, type PersonaType } from '../../context/PersonaContext';
import { useTour } from '../../context/TourContext';
import { getStoredTheme, setTheme, type ThemeChoice } from '../../utils/theme';

interface ProfileData {
  id?: string;
  full_name?: string;
  business_name?: string;
  monthly_income?: number;
  monthly_expense?: number;
  persona_type?: string;
}

interface FormState {
  full_name: string;
  business_name: string;
  monthly_income: number;
  monthly_expense: number;
}

const SettingsFormInner: React.FC<{
  profile: ProfileData | null | undefined;
  persona: PersonaType;
  accountPersona: PersonaType;
  onSaved: () => void;
}> = ({ profile, persona, accountPersona, onSaved }) => {
  const qc = useQueryClient();
  const currentConfig = PERSONA_CONFIGS[persona] || PERSONA_CONFIGS.business;

  const [form, setForm] = useState<FormState>(() => ({
    full_name: profile?.full_name || '',
    business_name: profile?.business_name || '',
    monthly_income: Number(profile?.monthly_income) || 0,
    monthly_expense: Number(profile?.monthly_expense) || 0,
  }));

  const profileMutation = useMutation({
    mutationFn: (data: FormState & { persona_type: string }) => userService.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['visualizations'] });
      onSaved();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    profileMutation.mutate({ ...form, persona_type: persona });
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 border border-slate-200 rounded-3xl space-y-6 bg-white shadow-xs">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="w-10 h-10 bg-cobalt-50 text-cobalt-600 border border-cobalt-100 rounded-xl flex items-center justify-center">
          <SettingsIcon size={20} />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-ink-900">Financial Profile & Operating Baseline</h2>
          <p className="text-xs text-slate-500 font-medium">
            Baseline revenue and operating disbursement run-rates for your {currentConfig.title}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-600 font-bold uppercase tracking-tight mb-1.5 block">Full Name</label>
          <div className="relative">
            <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input-field pl-10 text-xs font-semibold"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
        </div>

        {accountPersona !== 'personal' && (
          <div>
            <label className="text-xs text-slate-600 font-bold uppercase tracking-tight mb-1.5 block">
              {accountPersona === 'business' ? 'Business / Trade Name' : 'Freelance Brand / Trade Name'}
            </label>
            <div className="relative">
              <Briefcase size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="input-field pl-10 text-xs font-semibold"
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-600 font-bold uppercase tracking-tight mb-1.5 block">
            {currentConfig.inflowLabel} (₹)
          </label>
          <div className="relative">
            <DollarSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="number"
              min="0"
              className="input-field pl-10 text-xs font-semibold font-mono"
              value={form.monthly_income}
              onChange={(e) => setForm({ ...form, monthly_income: Math.max(0, parseFloat(e.target.value) || 0) })}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-600 font-bold uppercase tracking-tight mb-1.5 block">
            {currentConfig.outflowLabel} (₹)
          </label>
          <div className="relative">
            <TrendingDown size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="number"
              min="0"
              className="input-field pl-10 text-xs font-semibold font-mono"
              value={form.monthly_expense}
              onChange={(e) => setForm({ ...form, monthly_expense: Math.max(0, parseFloat(e.target.value) || 0) })}
            />
          </div>
        </div>
      </div>

      {profileMutation.isError && (
        <div className="p-3 rounded-xl bg-vermilion-50 border border-vermilion-200 text-vermilion-700 text-xs font-bold">
          Failed to save settings. Please check your inputs and try again.
        </div>
      )}

      <div className="flex justify-end pt-3 border-t border-slate-100">
        <button
          type="submit"
          disabled={profileMutation.isPending}
          className="btn-primary flex items-center gap-2 text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer"
        >
          <Save size={14} />
          {profileMutation.isPending ? 'Committing Changes...' : 'Save Profile Changes'}
        </button>
      </div>
    </form>
  );
};

export const SettingsPage: React.FC = () => {
  const { persona, accountPersona, toggleWorkPersonal, canSwitchToPersonal } = usePersona();
  const { restartTour } = useTour();
  const [savedSuccess, setSavedSuccess] = useState(false);

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: userService.getProfile,
  });

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  const currentConfig = PERSONA_CONFIGS[persona] || PERSONA_CONFIGS.business;
  const accountConfig = PERSONA_CONFIGS[accountPersona] || PERSONA_CONFIGS.business;

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/4" />
        <div className="h-64 bg-slate-100 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Topbar title="Configuration & Account Settings" subtitle="Manage your financial baseline, workspace profile, and active operational mode" />

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={16} className="text-teal-600 flex-shrink-0" />
          <span>Your operational settings and financial baseline have been saved successfully.</span>
        </div>
      )}

      {/* Account Type Card */}
      <div className="card p-6 border border-slate-200 rounded-3xl bg-white shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cobalt-50 border border-cobalt-100 flex items-center justify-center text-cobalt-600">
              {accountPersona === 'business' ? <Building2 size={20} /> : accountPersona === 'self_employed' ? <Laptop size={20} /> : <Wallet size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-ink-900">{accountConfig.title}</h3>
                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-cobalt-50 text-cobalt-700 border border-cobalt-200">
                  Primary Account Mode
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Configured during authentication. Governs your core tax and ledger schema.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <Lock size={13} className="text-slate-400" />
            <span>Authenticated Mode</span>
          </div>
        </div>

        {/* Work vs Personal Mode Switcher */}
        {canSwitchToPersonal && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Active Workspace View: <span className="text-cobalt-600 font-black">{currentConfig.title}</span>
              </span>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Toggle between commercial enterprise operations and personal treasury view.
              </p>
            </div>

            <button
              type="button"
              onClick={toggleWorkPersonal}
              className="px-4 py-2.5 bg-cobalt-600 hover:bg-cobalt-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition-all cursor-pointer self-start sm:self-auto"
            >
              <ArrowRightLeft size={14} />
              <span>Switch to {persona === 'personal' ? (accountPersona === 'business' ? 'Business Mode' : 'Freelance Mode') : 'Personal Mode'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Profile Form keyed to profile id so state initializes cleanly without useEffect sync-setState */}
      <SettingsFormInner
        key={profile?.id || 'profile-ready'}
        profile={profile}
        persona={persona}
        accountPersona={accountPersona}
        onSaved={() => {
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
        }}
      />

      <AppearanceCard />

      {/* Change Password Card */}
      <ChangePasswordCard />

      {/* Onboarding & Guided Product Tour Card */}
      <div className="card p-6 border border-slate-200/90 rounded-3xl bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-extrabold text-slate-900">Guided Product Tour</h4>
          <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-xl">
            Relaunch the interactive 8-step walkthrough covering the Dashboard hierarchy, Contract Intelligence, DecisionForge AI, and Analytics lenses.
          </p>
        </div>
        <button
          type="button"
          onClick={restartTour}
          className="px-4 py-2.5 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 via-fuchsia-50/50 to-rose-50 hover:from-violet-100 hover:to-rose-100 text-violet-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
        >
          <Compass size={14} className="text-violet-600" />
          <span>Launch Product Tour</span>
        </button>
      </div>

      {/* Danger Zone / Logout */}
      <div className="card p-6 border border-slate-200 rounded-3xl bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-extrabold text-ink-900">Session & Identity Management</h4>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Terminates JWT session token and local cache</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 rounded-xl border border-vermilion-200 bg-vermilion-50 hover:bg-vermilion-100 text-vermilion-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto"
        >
          <LogOut size={14} />
          Sign Out of Account
        </button>
      </div>
    </div>
  );
};

// Appearance: the only place the colour theme is chosen (the top bar deliberately has no theme switch).
const THEME_OPTIONS: { id: ThemeChoice; label: string; hint: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'light', label: 'Light', hint: 'Bright canvas', icon: Sun },
  { id: 'dark', label: 'Dark', hint: 'Low-glare canvas', icon: Moon },
  { id: 'system', label: 'System', hint: 'Follow your device', icon: Monitor },
];

const AppearanceCard: React.FC = () => {
  const [choice, setChoice] = useState<ThemeChoice>(getStoredTheme);

  return (
    <section
      aria-label="Appearance"
      data-testid="appearance-card"
      className="card p-6 border border-slate-200 rounded-3xl bg-white shadow-xs space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-100 text-violet-700 flex items-center justify-center">
          <Palette size={18} />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-ink-900">Appearance</h2>
          <p className="text-xs text-slate-500 font-medium">Applies instantly across the whole workspace and is remembered on this device.</p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {THEME_OPTIONS.map(({ id, label, hint, icon: Icon }) => {
          const active = choice === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setChoice(id);
                setTheme(id);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all cursor-pointer ${
                active ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200' : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <Icon size={16} />
              </span>
              <span>
                <span className="block text-sm font-extrabold text-ink-900">{label}</span>
                <span className="block text-[11px] font-medium text-slate-500">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

// Change Password Component
const ChangePasswordCard: React.FC = () => {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.next !== form.confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (form.next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      // Call the auth service if changePassword is available
      const svc = authService as unknown as { changePassword?: (c: string, n: string) => Promise<void> };
      if (typeof svc.changePassword === 'function') {
        await svc.changePassword(form.current, form.next);
      } else {
        throw new Error('Password change endpoint not yet configured.');
      }
      setSuccess(true);
      setForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 border border-slate-200 rounded-3xl space-y-5 bg-white shadow-xs">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="w-10 h-10 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl flex items-center justify-center">
          <Key size={18} />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-ink-900">Change Password</h2>
          <p className="text-xs text-slate-500 font-medium">Update your account password</p>
        </div>
      </div>

      {success && (
        <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={14} /> Password changed successfully.
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-vermilion-50 border border-vermilion-200 text-vermilion-700 text-xs font-bold">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">Current Password</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showCurrent ? 'text' : 'password'}
              required
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              className="input-field pl-10 pr-10 text-xs font-semibold"
              placeholder="Current password"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} aria-label={showCurrent ? 'Hide current password' : 'Show current password'} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 cursor-pointer">
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">New Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showNew ? 'text' : 'password'}
                required
                minLength={8}
                value={form.next}
                onChange={(e) => setForm({ ...form, next: e.target.value })}
                className="input-field pl-10 pr-10 text-xs font-semibold"
                placeholder="Min. 8 characters"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} aria-label={showNew ? 'Hide new password' : 'Show new password'} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 cursor-pointer">
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Confirm New Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                className={`input-field pl-10 text-xs font-semibold ${
                  form.confirm && form.next !== form.confirm ? 'border-vermilion-400 ring-1 ring-vermilion-300' : ''
                }`}
                placeholder="Repeat new password"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || !form.current || !form.next || !form.confirm}
          className="btn-primary flex items-center gap-2 text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
        >
          <Key size={14} />
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </form>
  );
};
