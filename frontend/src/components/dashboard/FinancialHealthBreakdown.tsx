import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, CheckCircle2, AlertCircle, Target } from 'lucide-react';

interface ComponentItem {
  name: string;
  score: number;
  maxScore: number;
  weight: string;
  description: string;
  status: 'positive' | 'warning' | 'danger';
}

interface Props {
  assessment: {
    score: number;
    statusLabel: string;
    statusColor: string;
    components: ComponentItem[];
    helpingFactors: string[];
    hurtingFactors: string[];
    biggestOpportunity: string;
    historicalTrend: Array<{ month: string; score: number }>;
  };
}

export const FinancialHealthBreakdown: React.FC<Props> = ({ assessment }) => {
  if (!assessment || !assessment.components) return null;

  return (
    <div className="card p-6 border border-slate-200 rounded-3xl space-y-6 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">
              Persona-Weighted Health Score Breakdown
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Adaptive scoring engine — weights differ by your financial persona
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {assessment.score} / 100 • {assessment.statusLabel}
          </span>
        </div>
      </div>

      {/* 5 Pillar Component Progress Bars */}
      <div className="space-y-3.5">
        {assessment.components.map((comp, idx) => {
          const percentage = Math.round((comp.score / comp.maxScore) * 100);
          return (
            <div key={idx} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-800 flex items-center gap-2">
                  <span>{comp.name}</span>
                  <span className="text-[10px] text-slate-400 font-extrabold">({comp.weight})</span>
                </span>
                <span className="text-slate-900 font-black">
                  {comp.score} <span className="text-slate-400 font-semibold">/ {comp.maxScore}</span>
                </span>
              </div>

              <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.05 }}
                  className={`h-full rounded-full ${
                    percentage >= 75 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                />
              </div>

              <p className="text-[11px] text-slate-500 font-medium">{comp.description}</p>
            </div>
          );
        })}
      </div>

      {/* What's Helping You vs What's Hurting You */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
        {/* Helping Factors */}
        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
            <CheckCircle2 size={15} />
            <span>What's Driving Your Score</span>
          </div>
          <ul className="space-y-1.5 text-xs text-emerald-950 font-medium">
            {assessment.helpingFactors.map((h, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-emerald-600 mt-0.5">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Hurting Factors */}
        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-amber-800">
            <AlertCircle size={15} />
            <span>Areas for Attention</span>
          </div>
          <ul className="space-y-1.5 text-xs text-amber-950 font-medium">
            {assessment.hurtingFactors.map((h, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Biggest Opportunity Banner */}
      <div className="p-4 rounded-2xl border border-brand-200 bg-brand-50/50 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
          <Target size={16} />
        </div>
        <div>
          <h4 className="text-xs font-black text-brand-900">Your Highest-Leverage Opportunity</h4>
          <p className="text-xs text-brand-800 font-medium mt-0.5 leading-relaxed">
            {assessment.biggestOpportunity}
          </p>
        </div>
      </div>
    </div>
  );
};
