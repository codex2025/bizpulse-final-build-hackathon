import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Laptop, Wallet, Check, ArrowRight, Zap } from 'lucide-react';
import { usePersona, type AccountPersonaType } from '../../context/PersonaContext';
import api from '../../services/api';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAccountMode } = usePersona();
  const [selectedMode, setSelectedMode] = useState<AccountPersonaType>('business');
  const [baselineAmount, setBaselineAmount] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);

  const modes: Array<{
    id: AccountPersonaType;
    title: string;
    subtitle: string;
    desc: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    tag: string;
    color: string;
    accentBorder: string;
  }> = [
    {
      id: 'business',
      title: 'Business Owner / SME',
      subtitle: 'For Founders, Companies, SMEs & Commercial Entities',
      desc: 'Commercial cashflow tracking, GST invoicing, client accounts, operational burn, and corporate contract intelligence. Includes instant toggle to Personal mode.',
      icon: Building2,
      tag: 'Enterprise & SMEs',
      color: 'text-cobalt-600 bg-cobalt-50',
      accentBorder: 'border-cobalt-500 ring-2 ring-cobalt-500/20 bg-cobalt-50/20',
    },
    {
      id: 'self_employed',
      title: 'Freelancer / Self-Employed',
      subtitle: 'For Independent Contractors, Freelancers & Agencies',
      desc: 'Milestone invoicing, retainer client management, volatility buffer tracking & freelancer micro-loans. Includes instant toggle to Personal mode.',
      icon: Laptop,
      tag: 'Freelance & Agency',
      color: 'text-teal-600 bg-teal-50',
      accentBorder: 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20',
    },
    {
      id: 'personal',
      title: 'Personal & Salaried Employee',
      subtitle: 'For Working Professionals, Employees & Personal Budgeters',
      desc: 'Monthly salary management, take-home budget planning, personal debt-to-income (DTI) health, daily expense logging, and savings goals.',
      icon: Wallet,
      tag: 'Personal & Salaried',
      color: 'text-amber-600 bg-amber-50',
      accentBorder: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20',
    },
  ];

  const handleContinue = async () => {
    setLoading(true);
    try {
      await setAccountMode(selectedMode);
      
      const payload: Record<string, string | number> = { persona_type: selectedMode };
      if (baselineAmount) {
        payload.monthly_income = parseFloat(baselineAmount) || 0;
      }
      if (businessName && selectedMode !== 'personal') {
        payload.business_name = businessName;
      }

      await api.patch('/users/profile', payload);
      localStorage.setItem('bizpulse_onboarded', 'true');
      navigate('/');
    } catch (e) {
      console.warn('Error saving onboarding mode:', e);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cobalt-50 border border-cobalt-100 text-cobalt-700 text-xs font-bold mb-4 shadow-2xs">
            <Zap size={13} className="text-cobalt-600" />
            <span>Select Your Primary Operating Workspace</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight">
            How will you deploy <span className="text-cobalt-600">Bizpulse</span>?
          </h1>
          <p className="text-sm sm:text-base text-slate-500 font-medium max-w-xl mx-auto mt-2">
            Choose your primary account workspace. Your dashboard, tax invoicing schema, and analytical telemetry will be custom-calibrated for your operations.
          </p>
        </div>

        {/* 3 Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {modes.map((m) => {
            const Icon = m.icon;
            const isSelected = selectedMode === m.id;

            return (
              <motion.div
                key={m.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedMode(m.id)}
                className={`p-5 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between bg-white shadow-xs ${
                  isSelected ? m.accentBorder : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.color}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                          isSelected ? 'bg-cobalt-600 text-white' : 'border border-slate-300'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md inline-block mb-1.5 font-mono">
                    {m.tag}
                  </span>
                  <h3 className="text-base font-black text-ink-900 leading-tight">{m.title}</h3>
                  <p className="text-xs font-bold text-cobalt-600 mb-2 mt-0.5">{m.subtitle}</p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{m.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Financial Baseline Inputs */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 max-w-xl mx-auto mb-8">
          <h4 className="text-sm font-extrabold text-ink-900">Establish Initial Operating Baseline</h4>
          
          {selectedMode !== 'personal' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {selectedMode === 'business' ? 'Business / Trade Name' : 'Freelance Brand / Trade Name'}
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={selectedMode === 'business' ? 'Apex Dynamics Precision Engineering Ltd' : 'Apex Creative Studio'}
                className="input-field text-xs font-semibold w-full"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {selectedMode === 'personal' ? 'Estimated Monthly Net Salary (₹)' : 'Average Monthly Inflow / Revenue (₹)'}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
              <input
                type="number"
                value={baselineAmount}
                onChange={(e) => setBaselineAmount(e.target.value)}
                placeholder="150000"
                className="input-field text-xs font-semibold pl-8 w-full font-mono"
              />
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleContinue}
            disabled={loading}
            className="px-8 py-3.5 btn-primary disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl shadow-md inline-flex items-center gap-2 mx-auto transition-all cursor-pointer"
          >
            <span>{loading ? 'Configuring Operating Ledger…' : 'Complete Setup & Launch Workspace'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
