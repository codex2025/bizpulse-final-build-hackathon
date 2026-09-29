import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Laptop, Wallet, Save, LogOut,
  User, Briefcase, DollarSign,
  TrendingDown, Settings as SettingsIcon, Lock, ArrowRightLeft, CheckCircle2
} from 'lucide-react';
import { Topbar } from '../common/Topbar';
import { userService } from '../../services/userService';
import { authService } from '../../services/authService';
import { usePersona, PERSONA_CONFIGS, type PersonaType } from '../../context/PersonaContext';

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
    onError: () => {
      alert('Failed to update settings. Please try again.');
    }
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
              className="input-field pl-10 text-xs font-semibold font-mono"
              value={form.monthly_income}
              onChange={(e) => setForm({ ...form, monthly_income: parseFloat(e.target.value) || 0 })}
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
              className="input-field pl-10 text-xs font-semibold font-mono"
              value={form.monthly_expense}
              onChange={(e) => setForm({ ...form, monthly_expense: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

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
