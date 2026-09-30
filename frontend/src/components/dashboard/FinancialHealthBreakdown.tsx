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
    <div className="bg-white border border-slate-200 rounded-financial p-5 shadow-card space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
              Health Score Components
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              5-Pillar adaptive model calculated by Bizpulse
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200 font-mono tabular-nums">
            {assessment.score}/100 • {assessment.statusLabel}
          </span>
        </div>
      </div>

      {/* 5 Pillar Component Progress Bars */}
      <div className="space-y-3">
        {assessment.components.map((comp, idx) => {
          const percentage = Math.round((comp.score / comp.maxScore) * 100);
          return (
            <div key={idx} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-ink-900 flex items-center gap-1.5">
                  <span>{comp.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({comp.weight})</span>
                </span>
                <span className="text-ink-900 font-mono tabular-nums">
                  {comp.score} <span className="text-slate-400 font-normal">/ {comp.maxScore}</span>
                </span>
              </div>

              <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: idx * 0.04 }}
                  className={`h-full rounded-full ${
                    percentage >= 75 ? 'bg-teal-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-vermilion-500'
                  }`}
                />
              </div>

              <p className="text-[10.5px] text-slate-500 font-medium">{comp.description}</p>
            </div>
          );
        })}
      </div>

      {/* What's Driving vs Areas for Attention */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
        {/* Driving Factors */}
        <div className="p-3.5 rounded-lg border border-teal-200/80 bg-teal-50/40 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800">
            <CheckCircle2 size={14} />
            <span>Score Catalysts</span>
          </div>
          <ul className="space-y-1 text-xs text-teal-950 font-medium">
            {assessment.helpingFactors?.map((h, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px]">
                <span className="text-teal-600 mt-0.5">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Attention Areas */}
        <div className="p-3.5 rounded-lg border border-amber-200/80 bg-amber-50/40 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
            <AlertCircle size={14} />
            <span>Points of Attention</span>
          </div>
          <ul className="space-y-1 text-xs text-amber-950 font-medium">
            {assessment.hurtingFactors?.map((h, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px]">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Highest-Leverage Opportunity */}
      {assessment.biggestOpportunity && (
        <div className="p-3.5 rounded-lg border border-cobalt-200/80 bg-cobalt-50/50 flex items-start gap-3">
          <div className="w-7 h-7 rounded-md bg-cobalt-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
            <Target size={14} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-cobalt-900">Highest-Leverage Action</h4>
            <p className="text-xs text-cobalt-800 font-medium mt-0.5 leading-relaxed">
              {assessment.biggestOpportunity}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
