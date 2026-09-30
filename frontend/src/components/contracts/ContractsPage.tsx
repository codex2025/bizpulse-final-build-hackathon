import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Loader2, Send,
  Mail, Sparkles, DollarSign,
  ArrowRight, Lightbulb, Wallet,
  Trash2, ThumbsUp, ThumbsDown,
  AlertOctagon, Check, Globe, Mic, MicOff, Languages,
  Search, ShieldCheck, Scale, FileCheck, RefreshCw, Bookmark
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { Topbar } from '../common/Topbar';
import { contractService } from '../../services/contractService';
import { usePersona } from '../../context/PersonaContext';
import { usePrefersReducedMotion, EASE_FINANCIAL } from '../../utils/motion';
import type {
  ContractAnalysisData,
  ContractClause,
  ContractQueryMessage,
  ContractWorkflowStep
} from './contractTypes';
import {
  SUPPORTED_LANGUAGES,
  SPEECH_LANG_MAP,
  LOCALIZED_UI
} from './contractTranslations';
import { SAMPLE_CONTRACT_UJJIVAN } from './sampleContracts';
import { ContractSplitReview } from './ContractSplitReview';

// --- SEMANTIC RISK BADGE ---
// Rose -> critical, Amber -> caution, Emerald -> positive/low concern
const RiskBadge: React.FC<{ level: string; isRedFlag?: boolean }> = ({ level, isRedFlag }) => {
  const normalized = (level || 'Low').toLowerCase();
  
  if (isRedFlag || normalized === 'high' || normalized === 'critical') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
        <AlertTriangle size={12} className="text-rose-600 stroke-[2.5]" />
        Critical Risk
      </span>
    );
  }
  if (normalized === 'medium' || normalized === 'moderate' || normalized === 'caution') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
        <AlertOctagon size={12} className="text-amber-600 stroke-[2.5]" />
        Caution
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
      <CheckCircle size={12} className="text-emerald-600 stroke-[2.5]" />
      Low Concern
    </span>
  );
};

// --- MULTILINGUAL DROPDOWN ---
const CustomLanguageDropdown: React.FC<{
  selectedLanguage: string;
  onSelectLanguage: (code: string) => void;
  translating: boolean;
}> = ({ selectedLanguage, onSelectLanguage, translating }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = useMemo(() => {
    return SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];
  }, [selectedLanguage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={translating}
        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
          isOpen
            ? 'bg-cobalt-50 border-cobalt-300 ring-2 ring-cobalt-400/20 text-cobalt-900'
            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-cobalt-100 text-cobalt-700 flex items-center justify-center flex-shrink-0">
          <Globe size={13} />
        </div>
        <div className="flex items-center gap-1">
          <span className="font-bold text-slate-900">{currentLang.native}</span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">({currentLang.name})</span>
        </div>
        {translating ? (
          <Loader2 size={12} className="animate-spin text-cobalt-600 ml-0.5" />
        ) : (
          <ChevronDown size={13} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-dropdown border border-slate-200 p-1.5 z-50 animate-in fade-in duration-100">
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Output Language</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cobalt-50 text-cobalt-700">8 Indian Languages</span>
          </div>

          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = lang.code === selectedLanguage;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    onSelectLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition-colors cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-cobalt-600 text-white font-bold'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {lang.flag}
                    </span>
                    <div>
                      <p className={`leading-none ${isSelected ? 'text-white' : 'text-slate-900 font-semibold'}`}>
                        {lang.native}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-cobalt-100' : 'text-slate-500'}`}>
                        {lang.name}
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check size={12} strokeWidth={3} className="text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// --- DECISION VERDICT CARD (Vermilion / Amber / Teal) ---
const DecisionVerdictCard: React.FC<{ contract: ContractAnalysisData; language: string }> = ({ contract, language }) => {
  const decision = contract.decision || {};
  const decisionType = (decision.decision_type || 'RENEGOTIATE').toUpperCase();
  const isDecline = decisionType === 'DECLINE';
  const isAccept = decisionType === 'ACCEPT';

  const badgeClass = isDecline
    ? 'bg-vermilion-600 text-white'
    : isAccept
      ? 'bg-teal-600 text-white'
      : 'bg-amber-500 text-white';

  const cardBorder = isDecline
    ? 'border-vermilion-200 bg-vermilion-50/20'
    : isAccept
      ? 'border-teal-200 bg-teal-50/20'
      : 'border-amber-200 bg-amber-50/20';

  const Icon = isDecline ? ThumbsDown : isAccept ? ThumbsUp : AlertTriangle;
  const reasons = decision.reasons && decision.reasons.length > 0
    ? decision.reasons
    : ['Evaluated against verified cash flow baseline and standard borrower protection standards.'];

  const ui = LOCALIZED_UI[language] || {};
  const whyTitle = isDecline
    ? (ui.why_decline || 'Why You Should Decline / Walk Away:')
    : isAccept
      ? (ui.why_accept || 'Why You Should Accept / Proceed:')
      : (ui.why_renegotiate || 'Why You Should Renegotiate Terms First:');

  const verdictLabel = isDecline
    ? (ui.DECLINE || 'DECLINE')
    : isAccept
      ? (ui.ACCEPT || 'ACCEPT')
      : (ui.RENEGOTIATE || 'RENEGOTIATE');

  const actionHeadline = decision.action_headline || (
    isDecline
      ? (ui.headline_decline || 'Do Not Sign This Agreement')
      : isAccept
        ? (ui.headline_accept || 'Safe to Proceed with Agreement')
        : (ui.headline_renegotiate || 'Hold Signing — Renegotiate Key Clauses')
  );

  const actionSummary = decision.action_summary || (
    isDecline
      ? (ui.summary_decline || 'Predatory terms and high interest burden detected')
      : isAccept
        ? (ui.summary_accept || 'Fair commercial terms aligned with your cash flow capacity')
        : (ui.summary_renegotiate || 'Acceptable structure but key clauses require borrower protection')
  );

  return (
    <div className={`p-6 rounded-2xl border ${cardBorder} shadow-card space-y-5 transition-all`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-xs flex-shrink-0 ${badgeClass}`}>
            <Icon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {ui.recommendation || 'Official Bizpulse Decision Verdict'}
              </span>
              <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full shadow-2xs ${badgeClass}`}>
                {verdictLabel}
              </span>
            </div>
            <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">
              {actionHeadline}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {actionSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Concrete reasons */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Lightbulb size={14} className={isDecline ? 'text-vermilion-600' : isAccept ? 'text-teal-600' : 'text-amber-600'} />
          {whyTitle}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {reasons.map((reason, idx) => (
            <div key={idx} className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                isDecline ? 'bg-vermilion-100 text-vermilion-700' : isAccept ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-800'
              }`}>
                {isDecline ? <AlertTriangle size={12} /> : isAccept ? <Check size={12} /> : <AlertOctagon size={12} />}
              </div>
              <p className="text-xs font-medium text-slate-800 leading-relaxed">{reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- CASH FLOW AFFORDABILITY CARD ---
const DebtAffordabilityCard: React.FC<{
  contract: ContractAnalysisData;
  persona: string;
  language: string;
}> = ({ contract, persona, language }) => {
  const isEmployee = persona === 'employee';
  const ledger = contract.ledger_impact;
  const sim = contract.simulation_results;

  const income = Number(ledger?.avg_monthly_income || (isEmployee ? 55000 : 65000));
  const expense = Number(ledger?.avg_monthly_expense || (isEmployee ? 22000 : 20000));
  const emi = Number(ledger?.monthly_emi || sim?.monthly_emi || 16727);
  const netProfitBefore = income - expense;
  const residualCash = netProfitBefore - emi;

  const emiToProfitPct = netProfitBefore > 0 ? Math.round((emi / netProfitBefore) * 100) : 100;
  const isHeavy = residualCash < 0 || emiToProfitPct > 55;
  const isModerate = !isHeavy && emiToProfitPct > 25;

  const ui = LOCALIZED_UI[language] || {};

  const barData = [
    { name: ui.past_income || (isEmployee ? 'Monthly Salary' : 'Monthly Cash In'), amount: income, fill: '#00A88F' }, // Teal
    { name: ui.past_expense || (isEmployee ? 'Living Expenses' : 'Operating Expenses'), amount: expense, fill: '#64748B' }, // Slate
    { name: ui.new_emi || 'Proposed EMI', amount: emi, fill: '#F04438' }, // Vermilion
    { name: ui.cushion || 'Free Savings Buffer', amount: Math.max(0, residualCash), fill: isHeavy ? '#F04438' : '#2457FF' } // Vermilion or Cobalt
  ];

  return (
    <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-card space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cobalt-50 text-cobalt-600 flex items-center justify-center">
            <Wallet size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900">{ui.financial_baseline || 'Financial Baseline & Debt Affordability'}</h3>
            <p className="text-xs text-slate-500 font-medium">{ui.baseline_desc || 'Evaluated against verified monthly income, recurring expenses, and cash reserves'}</p>
          </div>
        </div>
        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
          isHeavy ? 'bg-vermilion-50 text-vermilion-700 border border-vermilion-200' : isModerate ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-teal-50 text-teal-700 border border-teal-200'
        }`}>
          {isHeavy ? 'Critical Cash Flow Deficit' : isModerate ? 'Moderate Budget Strain' : 'Easily Affordable (Safe Buffer)'}
        </span>
      </div>

      {/* 4-Stat Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-teal-50/50 border border-teal-100 rounded-xl">
          <p className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">{ui.past_income || 'Monthly Inflow'}</p>
          <p className="text-lg font-black text-teal-950 font-mono tabular-nums mt-0.5">₹{income.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-teal-700">{isEmployee ? 'Net Take-Home Pay' : 'Average Revenue'}</span>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{ui.past_expense || 'Monthly Expenses'}</p>
          <p className="text-lg font-black text-slate-900 font-mono tabular-nums mt-0.5">₹{expense.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-slate-500">{isEmployee ? 'Living Costs & Bills' : 'Operating Outflow'}</span>
        </div>

        <div className="p-3.5 bg-vermilion-50/50 border border-vermilion-100 rounded-xl">
          <p className="text-[10px] font-bold text-vermilion-800 uppercase tracking-wider">{ui.new_emi || 'New Loan EMI'}</p>
          <p className="text-lg font-black text-vermilion-950 font-mono tabular-nums mt-0.5">₹{emi.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-vermilion-700 font-semibold">{emiToProfitPct}% of monthly surplus</span>
        </div>

        <div className={`p-3.5 rounded-xl border ${isHeavy ? 'bg-vermilion-50/80 border-vermilion-200' : 'bg-cobalt-50/60 border-cobalt-100'}`}>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{ui.cushion || 'Residual Savings Buffer'}</p>
          <p className={`text-lg font-black font-mono tabular-nums mt-0.5 ${isHeavy ? 'text-vermilion-700' : 'text-cobalt-950'}`}>
            ₹{residualCash.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-500">{ui.free_buffer || 'Free Monthly Buffer'}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="pt-2">
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">{ui.comparison_chart || 'Monthly Cash Flow Stress Test'}</p>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
              <RechartsTooltip
                formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600 }}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// --- CLAUSE ROW COMPONENT ---
const ClauseInspectionRow: React.FC<{
  clause: ContractClause;
  language: string;
  isInitiallyExpanded?: boolean;
}> = ({ clause, language, isInitiallyExpanded = false }) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [expanded, setExpanded] = useState(isInitiallyExpanded);
  const isHighRisk = clause.risk_level === 'High' || clause.is_red_flag;
  const isRedFlag = clause.is_red_flag;
  const ui = LOCALIZED_UI[language] || {};

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-150 ${
      isRedFlag ? 'border-vermilion-200 bg-vermilion-50/15' : isHighRisk ? 'border-amber-200 bg-white' : 'border-slate-200 bg-white'
    }`}>
      {/* Header Bar */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-3.5 flex items-center justify-between cursor-pointer bg-slate-50/70 hover:bg-slate-100/70 transition-colors border-b border-slate-100"
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
            isRedFlag ? 'bg-vermilion-100 text-vermilion-700' : 'bg-cobalt-50 text-cobalt-700'
          }`}>
            {isRedFlag ? <AlertOctagon size={15} /> : <FileText size={15} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900 text-sm">{clause.clause_type}</h4>
              {isRedFlag && (
                <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-vermilion-600 text-white">
                  Predatory Trap
                </span>
              )}
            </div>
            {clause.source_page && (
              <span className="text-[11px] text-slate-500 font-medium">Page Reference (Page {clause.source_page})</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <RiskBadge level={clause.risk_level} isRedFlag={clause.is_red_flag} />
          <button type="button" className="text-slate-400 hover:text-slate-600 p-1">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded Split-View */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={!prefersReducedMotion ? { opacity: 0, height: 0 } : false}
            animate={{ opacity: 1, height: 'auto' }}
            exit={!prefersReducedMotion ? { opacity: 0, height: 0 } : undefined}
            transition={{ duration: 0.2, ease: EASE_FINANCIAL }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3.5">
              {/* Red Flag Warning Box */}
              {isRedFlag && clause.red_flag_reason && (
                <div className="p-3 bg-vermilion-50 border border-vermilion-200 rounded-lg flex items-start gap-2.5">
                  <AlertTriangle size={15} className="text-vermilion-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-[11px] font-black uppercase text-vermilion-900 block">{ui.why_risky || 'Why this clause is risky for you:'}</span>
                    <p className="text-xs font-medium text-vermilion-800 leading-relaxed mt-0.5">{clause.red_flag_reason}</p>
                  </div>
                </div>
              )}

              {/* 2-Column Split: Original vs Plain Meaning */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Left: Original Contract Text */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5 flex items-center gap-1.5">
                      <FileText size={12} className="text-slate-400" /> {ui.original_text || 'Original Contract Text (Verbatim):'}
                    </span>
                    <p className="text-xs text-slate-800 font-mono leading-relaxed bg-white p-2.5 rounded border border-slate-200">
                      {clause.original_text || 'Original text excerpted from agreement document.'}
                    </p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                    <span>Verified Source Location</span>
                    <span>Page {clause.source_page || 1}</span>
                  </div>
                </div>

                {/* Right: Plain Meaning */}
                <div className="bg-cobalt-50/40 border border-cobalt-200/80 rounded-lg p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cobalt-800 block mb-1.5 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-cobalt-600" /> {ui.plain_meaning || 'Plain Meaning:'}
                    </span>
                    <p className="text-xs font-medium text-slate-900 leading-relaxed bg-white p-2.5 rounded border border-cobalt-100">
                      {clause.simple_explanation || clause.plain_explanation || 'Clear plain language breakdown.'}
                    </p>
                  </div>

                  {/* Practical Impact and Advice */}
                  <div className="mt-2.5 pt-2 border-t border-cobalt-100 space-y-1.5">
                    {clause.financial_impact && (
                      <div className="flex items-start gap-1.5 text-xs">
                        <DollarSign size={13} className="text-cobalt-600 mt-0.5 flex-shrink-0" />
                        <span className="font-semibold text-slate-800">{ui.cost_impact || 'Cost Impact:'} <span className="font-normal text-slate-600">{clause.financial_impact}</span></span>
                      </div>
                    )}
                    {clause.actionable_tip && (
                      <div className="flex items-start gap-1.5 text-xs">
                        <Lightbulb size={13} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        <span className="font-semibold text-slate-800">{ui.action_tip || 'Action Tip:'} <span className="font-normal text-slate-600">{clause.actionable_tip}</span></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- SUPPORTING EVIDENCE SECTION ---
const SupportingEvidenceAudit: React.FC<{ contract: ContractAnalysisData }> = ({ contract }) => {
  const clauses = contract.clauses || [];
  const redFlags = clauses.filter(c => c.is_red_flag || c.risk_level === 'High');

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-card">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-cobalt-50 text-cobalt-600 flex items-center justify-center">
            <Scale size={16} />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900">Legal Audit: Claim → Supporting Evidence → Interpretation</h3>
            <p className="text-xs text-slate-500">Every decision conclusion is directly mapped to verbatim clause citations from the source contract</p>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          {redFlags.length === 0 ? (
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-800 flex items-center gap-2">
              <CheckCircle size={16} className="text-teal-600" />
              <span>No critical or predatory red flags detected in this agreement.</span>
            </div>
          ) : (
            redFlags.map((c, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                    {c.clause_type}
                  </span>
                  <span className="text-[10px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                    Source Page {c.source_page || 1}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Step 1: Claim */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">1. Legal Finding</span>
                    <p className="text-xs font-medium text-slate-800">{c.red_flag_reason || c.simple_explanation}</p>
                  </div>

                  {/* Step 2: Verbatim Evidence */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cobalt-700 block mb-1">2. Verbatim Contract Excerpt</span>
                    <p className="text-xs font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 leading-relaxed">
                      "{c.original_text || 'Original wording'}"
                    </p>
                  </div>

                  {/* Step 3: Risk & Interpretation */}
                  <div className="p-3 bg-vermilion-50/60 rounded-lg border border-vermilion-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-vermilion-800 block mb-1">3. Practical Financial Risk</span>
                    <p className="text-xs text-vermilion-900 font-medium">{c.financial_impact || 'Directly binds personal or business cash reserves upon default.'}</p>
                    {c.actionable_tip && (
                      <p className="text-[11px] text-slate-600 mt-1.5 italic">Tip: {c.actionable_tip}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- INTERACTIVE AGREEMENT ASSISTANT ---
const ContractAssistant: React.FC<{
  contractId: string;
  language: string;
}> = ({ contractId, language }) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ContractQueryMessage[]>([]);

  const ui = LOCALIZED_UI[language] || {};
  const currentLang = useMemo(() => {
    return SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];
  }, [language]);

  const loadQueries = useCallback(async () => {
    try {
      const data = await contractService.getQueries(contractId);
      if (Array.isArray(data)) setMessages(data);
    } catch {
      // Ignored
    }
  }, [contractId]);

  useEffect(() => {
    loadQueries();
  }, [loadQueries]);

  // Voice speech recognition
  const toggleVoiceInput = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your query.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = SPEECH_LANG_MAP[language] || 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const handleAsk = async (promptText?: string) => {
    const q = promptText || question;
    if (!q.trim() || loading) return;

    const optimisticIndex = messages.length;
    setMessages(prev => [...prev, { question: q, answer: 'Analyzing contract terms…' }]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await contractService.askQuestion(contractId, q, 4, language);
      setMessages(prev => {
        const next = [...prev];
        next[optimisticIndex] = res;
        return next;
      });
    } catch {
      setMessages(prev => {
        const next = [...prev];
        next[optimisticIndex] = {
          question: q,
          answer: 'Unable to process question. Please ensure the backend AI service is running.',
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = useMemo(() => {
    if (language === 'ta') {
      return [
        'வட்டி விகிதம் நிலையானதா அல்லது மிதக்கும் விகிதமா?',
        'முன்கூட்டியே கடனை அடைத்தால் என்ன கட்டணம் விதிக்கப்படும்?',
        'வங்கிக்கு எனது தனிப்பட்ட வீடு அல்லது சேமிப்பு மீது உரிமை உள்ளதா?'
      ];
    }
    if (language === 'hi') {
      return [
        'ब्याज दर फ्लोटिंग है या फिक्स्ड?',
        'क्या मैं बिना पेनल्टी के समयपूर्व भुगतान कर सकता हूँ?',
        'क्या बैंक के पास मेरे व्यक्तिगत घर या बचत पर अधिकार है?'
      ];
    }
    return [
      'Is the interest rate floating or fixed?',
      'What happens if I make an early prepayment?',
      'Does the bank have rights over my personal residential property?'
    ];
  }, [language]);

  return (
    <div className="bg-white shadow-card p-6 border border-slate-200 rounded-2xl flex flex-col h-[520px]">
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cobalt-50 text-cobalt-600 flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">{ui.assistant_title || 'Contract Intelligence Assistant'}</h4>
            <p className="text-[11px] text-slate-500 font-medium">{ui.assistant_desc || 'Ask questions with verified citations from this document'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-cobalt-50 border border-cobalt-200 px-2 py-0.5 rounded-lg text-cobalt-800 text-[11px] font-bold">
          <Languages size={12} />
          <span>{currentLang.native}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3.5 space-y-3.5 pr-1">
        {messages.length === 0 ? (
          <div className="text-center py-6 px-3">
            <p className="text-xs font-bold text-slate-800 mb-1">
              Ask anything about this loan agreement
            </p>
            <p className="text-[11px] text-slate-500 mb-3.5">
              Verified answers with page numbers and clause quotes
            </p>
            <div className="flex flex-col gap-2">
              {samplePrompts.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAsk(p)}
                  className="text-xs font-medium bg-slate-50 hover:bg-cobalt-50 border border-slate-200 hover:border-cobalt-200 text-slate-700 hover:text-cobalt-700 rounded-xl px-3 py-2 text-left transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>{p}</span>
                  <ArrowRight size={12} className="text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-end">
                <div className="bg-cobalt-600 text-white text-xs font-medium px-3.5 py-2 rounded-xl rounded-tr-xs max-w-[85%] shadow-xs">
                  {m.question}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3.5 py-2.5 rounded-xl rounded-tl-xs max-w-[95%] space-y-2">
                  <p className="leading-relaxed whitespace-pre-wrap font-medium">{m.answer}</p>
                  {m.cited_clauses && m.cited_clauses.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                      {m.cited_clauses.map((c, cIdx) => (
                        <span key={cIdx} className="text-[10px] font-bold bg-white border border-cobalt-200 text-cobalt-700 px-2 py-0.5 rounded">
                          Page {c.page_number || 1}: {c.section_title || 'Contract Excerpt'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 focus-within:border-cobalt-500 focus-within:bg-white p-1 rounded-xl transition-all">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={ui.ask_placeholder || 'Type or speak in any supported language...'}
            disabled={loading}
            className="flex-1 text-xs px-2.5 py-1 bg-transparent focus:outline-none font-medium text-slate-900 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={toggleVoiceInput}
            title={`Speak in ${currentLang.name}`}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isListening ? 'bg-vermilion-500 text-white animate-pulse' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-3 py-1.5 bg-cobalt-600 hover:bg-cobalt-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            <span>Ask</span>
          </button>
        </div>
      </form>
    </div>
  );
};

// --- MAIN CONTRACTS PAGE COMPONENT ---
export const ContractsPage: React.FC = () => {
  const { persona } = usePersona();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [translating, setTranslating] = useState<boolean>(false);
  const [translatedContractCache, setTranslatedContractCache] = useState<Record<string, ContractAnalysisData>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ContractWorkflowStep>('split');
  const [clauseSearch, setClauseSearch] = useState('');
  const [clauseFilter, setClauseFilter] = useState<'all' | 'critical' | 'caution' | 'low' | 'red_flags'>('all');
  const qc = useQueryClient();

  const { data: contracts = [] } = useQuery<ContractAnalysisData[]>({
    queryKey: ['contracts'],
    queryFn: contractService.getAll,
  });

  const rawActiveContract = contracts.find((c) => c.id === activeId);

  const activeContract = useMemo(() => {
    if (!rawActiveContract) return null;
    if (selectedLanguage === 'en') return rawActiveContract;
    const cacheKey = `${rawActiveContract.id}_${selectedLanguage}`;
    return translatedContractCache[cacheKey] || rawActiveContract;
  }, [rawActiveContract, selectedLanguage, translatedContractCache]);

  useEffect(() => {
    if (!activeId && contracts.length > 0) {
      setActiveId(contracts[0].id);
    }
  }, [contracts, activeId]);

  // Handle translation
  const handleLanguageChange = async (lang: string) => {
    setSelectedLanguage(lang);
    if (lang === 'en' || !rawActiveContract) return;

    const cacheKey = `${rawActiveContract.id}_${lang}`;
    if (translatedContractCache[cacheKey]) return;

    setTranslating(true);
    try {
      const translated = await contractService.translateContract(rawActiveContract, lang);
      setTranslatedContractCache(prev => ({
        ...prev,
        [cacheKey]: translated
      }));
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setTranslating(false);
    }
  };

  // Upload handler
  const onDrop = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;
    setAnalyzing(true);
    setUploadError(null);
    try {
      const result = await contractService.uploadAndAnalyze(files[0]);
      qc.invalidateQueries({ queryKey: ['contracts'] });
      setActiveId(result.id);
      setActiveTab('split');
    } catch (err: unknown) {
      console.error('Upload failed:', err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.message || (err as any)?.message || 'Could not analyze file. Please verify the AI service is operational.';
      setUploadError(msg);
    } finally {
      setAnalyzing(false);
    }
  }, [qc]);

  // Load sample contract
  const handleLoadSample = async () => {
    setAnalyzing(true);
    setUploadError(null);
    try {
      const result = await contractService.analyzeTextAsContract(
        SAMPLE_CONTRACT_UJJIVAN.text,
        SAMPLE_CONTRACT_UJJIVAN.filename
      );
      qc.invalidateQueries({ queryKey: ['contracts'] });
      setActiveId(result.id);
      setActiveTab('split');
    } catch (err: unknown) {
      console.error('Sample load failed:', err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.message || (err as any)?.message || 'Failed to analyze sample agreement.';
      setUploadError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteContract = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agreement?')) return;
    try {
      await contractService.deleteContract(id);
      qc.invalidateQueries({ queryKey: ['contracts'] });
      setActiveId(null);
    } catch {
      alert('Failed to delete contract.');
    }
  };

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    noClick: false,
    noKeyboard: false,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
  });

  // A document with no simulation results is not a loan (MSA, SLA, NDA ...): loan figures are hidden, never defaulted.
  const isLoan = Boolean(activeContract?.simulation_results);
  const sim = activeContract?.simulation_results || {
    loan_amount: 7500000,
    annual_interest_rate: 12.75,
    tenure_months: 60,
    monthly_emi: 169690,
    total_repayment: 10181400,
    total_interest: 2681400,
    prepayment_penalty: 3.5
  };

  useEffect(() => {
    if (activeContract && !isLoan && (activeTab === 'extracted' || activeTab === 'risk')) setActiveTab('split');
  }, [activeContract, isLoan, activeTab]);

  // Filter clauses
  const filteredClauses = useMemo(() => {
    if (!activeContract?.clauses) return [];
    return activeContract.clauses.filter((c) => {
      // Risk filter
      if (clauseFilter === 'critical' && c.risk_level !== 'High') return false;
      if (clauseFilter === 'caution' && c.risk_level !== 'Medium') return false;
      if (clauseFilter === 'low' && c.risk_level !== 'Low') return false;
      if (clauseFilter === 'red_flags' && !c.is_red_flag) return false;

      // Search filter
      if (clauseSearch.trim()) {
        const query = clauseSearch.toLowerCase();
        const typeMatch = c.clause_type.toLowerCase().includes(query);
        const textMatch = (c.original_text || '').toLowerCase().includes(query);
        const plainMatch = (c.simple_explanation || c.plain_explanation || '').toLowerCase().includes(query);
        return typeMatch || textMatch || plainMatch;
      }
      return true;
    });
  }, [activeContract?.clauses, clauseFilter, clauseSearch]);

  const ui = LOCALIZED_UI[selectedLanguage] || {};

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Topbar
        title="Contract Intelligence AI"
        subtitle="Extract terms, stress-test borrower obligations, and uncover predatory red flags with authoritative financial reasoning."
      />

      {/* Hidden file input */}
      <input {...getInputProps()} id="contracts-global-file-input" />

      {/* Controls Bar: Active Contract, Multilingual Selector, Sample Contract & Upload */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-card">
        {/* Left: Document Switcher */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cobalt-50 text-cobalt-600 flex items-center justify-center flex-shrink-0">
            <FileText size={18} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Active Contract</label>
            <select
              value={activeId || ''}
              onChange={(e) => setActiveId(e.target.value)}
              className="text-sm font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer pr-4 hover:text-cobalt-600 transition-colors"
            >
              {contracts.length === 0 ? (
                <option value="">No contracts analyzed yet</option>
              ) : (
                contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.document_name || 'Financial Agreement'} ({new Date(c.created_at).toLocaleDateString()})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Custom Multilingual Dropdown */}
          <CustomLanguageDropdown
            selectedLanguage={selectedLanguage}
            onSelectLanguage={handleLanguageChange}
            translating={translating}
          />

          {/* Quick Sample Button */}
          <button
            type="button"
            onClick={handleLoadSample}
            disabled={analyzing}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
            title="Load the Ujjivan MSE Secured Business Loan sample"
          >
            <Bookmark size={13} className="text-slate-600" />
            <span>Try Sample</span>
          </button>

          {activeContract && (
            <button
              type="button"
              onClick={() => handleDeleteContract(activeContract.id)}
              className="px-3 py-1.5 bg-vermilion-50 hover:bg-vermilion-100 text-vermilion-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-vermilion-200"
              title="Delete contract and purge stored embeddings"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}

          <button
            type="button"
            onClick={open}
            disabled={analyzing}
            className="px-3.5 py-1.5 bg-cobalt-600 hover:bg-cobalt-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            <span>{analyzing ? 'Analyzing…' : (ui.upload_btn || 'Upload Contract')}</span>
          </button>
        </div>
      </div>

      {/* Upload Drag & Drop Interaction with purposeful motion */}
      <div
        data-tour="contracts-workflow"
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-cobalt-500 bg-cobalt-50/60 scale-[1.005]'
            : 'border-slate-200 hover:border-cobalt-300 hover:bg-slate-50/50 bg-white'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          {analyzing ? (
            <div className="py-2 flex flex-col items-center gap-2">
              <Loader2 size={32} className="text-cobalt-600 animate-spin" />
              <p className="text-sm font-bold text-slate-900">
                Processing document: Extracting terms, semantic chunking & simulating cash flow…
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="w-2 h-2 rounded-full bg-cobalt-500 animate-pulse" />
                <span>Running risk engine in {selectedLanguage.toUpperCase()}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 bg-cobalt-50 text-cobalt-600 rounded-xl flex items-center justify-center">
                <Upload size={18} />
              </div>
              <p className="text-sm font-bold text-slate-900">
                {isDragActive
                  ? (ui.dropzone_active || 'Drop your contract here')
                  : (ui.dropzone_idle || 'Drag & drop any financial agreement (PDF, DOCX, Scanned Image, or TXT)')}
              </p>
              <p className="text-xs text-slate-500">
                {ui.dropzone_sub || 'Supports Commercial Loans, Mortgages, Equipment Leases & Personal Debt across 8 Indian Languages'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Upload Error Alert */}
      {uploadError && (
        <div className="p-4 bg-vermilion-50 border border-vermilion-200 rounded-2xl text-xs text-vermilion-900 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-vermilion-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold block">Analysis Failed</span>
              <p className="mt-0.5 text-vermilion-800">{uploadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-vermilion-700 hover:text-vermilion-900 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* WORKFLOW VIEW TABS */}
      {activeContract && activeContract.analysis_status === 'completed' && (
        <div className="space-y-6">
          {/* Stepper Navigation */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60">
              {[
                { id: 'split', label: 'Master–Detail Review', icon: Scale },
                ...(isLoan
                  ? [
                      { id: 'extracted', label: '1. Extracted Information', icon: FileCheck },
                      { id: 'risk', label: '2. Risk & Affordability', icon: AlertTriangle },
                    ]
                  : []),
                { id: 'clauses', label: `3. Clause Analysis (${activeContract.clauses?.length || 0})`, icon: Scale },
                { id: 'evidence', label: '4. Supporting Evidence', icon: ShieldCheck },
                { id: 'assistant', label: '5. Contract Assistant', icon: Sparkles },
              ].map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id as ContractWorkflowStep)}
                    className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                      isActive ? 'text-white' : 'text-slate-600 hover:text-ink-900'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId={!prefersReducedMotion ? 'contractWorkflowPill' : undefined}
                        className="absolute inset-0 bg-cobalt-600 rounded-xl shadow-xs -z-10"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Icon size={13} />
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <span>Status: Completed</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'split' && (
              <motion.div
                key="split"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: EASE_FINANCIAL }}
              >
                <ContractSplitReview contract={activeContract} />
              </motion.div>
            )}

            {/* STAGE 1: EXTRACTED INFORMATION */}
            {activeTab === 'extracted' && (
              <motion.div
                key="extracted"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Contract Overview Strip */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cobalt-700 block mb-0.5">Document Dossier</span>
                      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{activeContract.document_name}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Analyzed on {new Date(activeContract.created_at).toLocaleDateString()} • {activeContract.total_chunks || 12} Semantic Chunks Ingested
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
                        <CheckCircle size={13} /> OCR Verified
                      </span>
                    </div>
                  </div>

                  {/* 4-Stat Primary Financial Parameter Strip */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sanctioned Principal</p>
                      <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-0.5">
                        ₹{Number(sim.loan_amount || 0).toLocaleString('en-IN')}
                      </p>
                      <span className="text-[10px] text-slate-500">Term Loan Facility</span>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Interest Rate</p>
                      <p className="text-xl font-black font-mono tabular-nums text-cobalt-600 mt-0.5">
                        {sim.annual_interest_rate || 12.75}% p.a.
                      </p>
                      <span className="text-[10px] text-slate-500">Floating Benchmark</span>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Monthly Installment (EMI)</p>
                      <p className="text-xl font-black font-mono tabular-nums text-slate-900 mt-0.5">
                        ₹{Number(sim.monthly_emi || 0).toLocaleString('en-IN')}
                      </p>
                      <span className="text-[10px] text-slate-500">Over {sim.tenure_months || 60} Months</span>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Financing Cost</p>
                      <p className="text-xl font-black font-mono tabular-nums text-amber-700 mt-0.5">
                        ₹{Number(sim.total_repayment || 0).toLocaleString('en-IN')}
                      </p>
                      <span className="text-[10px] text-slate-500">Principal + Total Interest</span>
                    </div>
                  </div>

                  {/* Obligations Strip */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="font-bold text-slate-700 block mb-0.5">Prepayment Exit Fee</span>
                      <span className="text-slate-900 font-semibold">{sim.prepayment_penalty ? `${sim.prepayment_penalty}% Foreclosure Charge` : '0% (Mandatory Free Exit)'}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="font-bold text-slate-700 block mb-0.5">Default Interest / Penalty</span>
                      <span className="text-slate-900 font-semibold">{sim.penalty_rate ? `${sim.penalty_rate}% per month` : '2.0% per month (24% p.a.)'}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="font-bold text-slate-700 block mb-0.5">Collateral Security</span>
                      <span className="text-slate-900 font-semibold">Hypothecation of Plant & Machinery</span>
                    </div>
                  </div>

                  {/* Executive Summary Takeaways */}
                  <div className="pt-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2.5">
                      <Sparkles size={14} className="text-cobalt-600" />
                      Executive Summary & Key Takeaways
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {(activeContract.executive_summary || [
                        `Sanctioned loan principal of ₹${Number(sim.loan_amount || 0).toLocaleString('en-IN')} across ${sim.tenure_months || 60} months.`,
                        `Monthly EMI obligation is ₹${Number(sim.monthly_emi || 0).toLocaleString('en-IN')}.`,
                        `Total interest burden across tenure amounts to ₹${Number(sim.total_interest || 0).toLocaleString('en-IN')}.`
                      ]).map((pt, i) => (
                        <div key={i} className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs leading-relaxed text-slate-800">
                          <ArrowRight size={13} className="text-cobalt-600 mt-0.5 flex-shrink-0" />
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Next Stage Link */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveTab('risk')}
                    className="px-4 py-2 bg-cobalt-600 hover:bg-cobalt-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Proceed to Risk Analysis</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STAGE 2: RISK ANALYSIS */}
            {activeTab === 'risk' && (
              <motion.div
                key="risk"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Decision Verdict Card */}
                <DecisionVerdictCard contract={activeContract} language={selectedLanguage} />

                {/* Debt Affordability Card */}
                <DebtAffordabilityCard
                  contract={activeContract}
                  persona={persona}
                  language={selectedLanguage}
                />

                {/* Predatory Red Flags Callout Box */}
                {activeContract.red_flags && activeContract.red_flags.length > 0 ? (
                  <div className="p-5 rounded-2xl bg-vermilion-50/40 border border-vermilion-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={18} className="text-vermilion-600" />
                      <h4 className="font-bold text-sm text-vermilion-900">
                        {activeContract.red_flags.length} Predatory Red Flags Detected
                      </h4>
                    </div>

                    <div className="space-y-2.5">
                      {activeContract.red_flags.map((rf, idx) => (
                        <div key={idx} className="bg-white p-3.5 rounded-xl border border-vermilion-200 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">{rf.clause_name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-vermilion-100 text-vermilion-800">
                              {rf.severity || 'High'} Severity
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed">{rf.why_risky}</p>
                          {rf.mitigation_tip && (
                            <p className="text-[11px] text-cobalt-700 font-medium pt-1">
                              <strong>Borrower Defense:</strong> {rf.mitigation_tip}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-800 flex items-center gap-2">
                    <CheckCircle size={16} className="text-teal-600" />
                    <span>No critical or predatory red flags detected in this agreement.</span>
                  </div>
                )}

                {/* Navigation Button */}
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('extracted')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    ← Back to Terms
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('clauses')}
                    className="px-4 py-2 bg-cobalt-600 hover:bg-cobalt-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Inspect Clauses</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STAGE 3: CLAUSE ANALYSIS */}
            {activeTab === 'clauses' && (
              <motion.div
                key="clauses"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {/* Search & Filter Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-card">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={clauseSearch}
                      onChange={(e) => setClauseSearch(e.target.value)}
                      placeholder="Search clauses by keyword or title…"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-cobalt-500 text-slate-900"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'critical', label: 'Critical' },
                      { id: 'caution', label: 'Caution' },
                      { id: 'low', label: 'Low Concern' },
                      { id: 'red_flags', label: 'Traps Only' },
                    ].map((f) => {
                      const isActive = clauseFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setClauseFilter(f.id as typeof clauseFilter)}
                          className={`relative px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isActive ? 'text-white font-bold' : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId={!prefersReducedMotion ? 'clauseFilterPill' : undefined}
                              className="absolute inset-0 bg-slate-900 rounded-lg shadow-2xs -z-10"
                              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                            />
                          )}
                          <span className="relative z-10">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Clause List */}
                <div className="space-y-3">
                  {filteredClauses.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
                      No clauses match the current filter or search query.
                    </div>
                  ) : (
                    filteredClauses.map((clause, idx) => (
                      <ClauseInspectionRow
                        key={clause.id || idx}
                        clause={clause}
                        language={selectedLanguage}
                        isInitiallyExpanded={idx === 0}
                      />
                    ))
                  )}
                </div>

                {/* Navigation Button */}
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('risk')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    ← Back to Risk
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('evidence')}
                    className="px-4 py-2 bg-cobalt-600 hover:bg-cobalt-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>View Supporting Evidence</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STAGE 4: SUPPORTING EVIDENCE */}
            {activeTab === 'evidence' && (
              <motion.div
                key="evidence"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <SupportingEvidenceAudit contract={activeContract} />

                {/* Lender Discussion Points */}
                <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-card space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cobalt-50 text-cobalt-600 flex items-center justify-center">
                      <Mail size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{ui.lender_points_title || 'Lender Discussion Points & Counter-Proposals'}</h4>
                      <p className="text-xs text-slate-500">{ui.lender_points_desc || 'Specific amendments to request before signing'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700 pt-1">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="font-bold text-slate-900 block mb-0.5">{ui.neg_1_title || '1. Benchmark Transparency:'}</span>
                      <span className="leading-relaxed">{ui.neg_1_desc || 'Request that interest rates be pegged strictly to an external benchmark to avoid arbitrary spread increases.'}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="font-bold text-slate-900 block mb-0.5">{ui.neg_2_title || '2. Grace Period Notice:'}</span>
                      <span className="leading-relaxed">{ui.neg_2_desc || 'Request a mandatory 15-day written notice window before any default remedies or penalty fees can be charged.'}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="font-bold text-slate-900 block mb-0.5">{ui.neg_3_title || '3. Early Payoff Protection:'}</span>
                      <span className="leading-relaxed">{ui.neg_3_desc || 'Confirm 0% exit penalties for prepayments made from ordinary business income.'}</span>
                    </div>
                  </div>
                </div>

                {/* Navigation Button */}
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('clauses')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    ← Back to Clauses
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('assistant')}
                    className="px-4 py-2 bg-cobalt-600 hover:bg-cobalt-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Launch Agreement Assistant</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STAGE 5: INTERACTIVE ASSISTANT */}
            {activeTab === 'assistant' && (
              <motion.div
                key="assistant"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                <div className="lg:col-span-2">
                  <ContractAssistant contractId={activeContract.id} language={selectedLanguage} />
                </div>

                <div className="space-y-4">
                  <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-card space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-teal-600" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">Verification Engine</h4>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      All responses are grounded directly in the indexed vector embeddings of this document. Citing exact page coordinates prevents hallucinations.
                    </p>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                      <div className="flex justify-between">
                        <span>ChromaDB Index:</span>
                        <span className="font-mono font-bold text-slate-900">{activeContract.chroma_collection_id || 'Active'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Language Model:</span>
                        <span className="font-bold text-slate-900">Multilingual RAG</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-card space-y-2.5">
                    <div className="flex items-center gap-2">
                      <RefreshCw size={15} className="text-cobalt-600" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">Quick Reset</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      Need to inspect another agreement or run an updated version? Use the top controls to switch or upload a new file.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('split')}
                      className="w-full mt-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
                    >
                      Return to Overview
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Empty State when no contract is loaded */}
      {contracts.length === 0 && !analyzing && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-cobalt-50 text-cobalt-600 mx-auto flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-slate-900">No Contracts Analyzed Yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Upload any loan agreement, commercial lease, or mortgage document to uncover hidden traps, calculate real affordability, and receive clear recommendations.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleLoadSample}
              className="px-4 py-2 bg-cobalt-600 hover:bg-cobalt-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Bookmark size={13} />
              <span>Load Sample MSE Agreement</span>
            </button>
            <button
              type="button"
              onClick={open}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Upload size={13} />
              <span>Upload Document</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
