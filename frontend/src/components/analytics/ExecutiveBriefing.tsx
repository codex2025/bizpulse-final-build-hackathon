import React from 'react';
import { Sparkles } from 'lucide-react';

interface Props {
  grossIncome: number;
  totalExpenses: number;
  retainedSavings: number;
  savingsPct: number;
  windowLabel: string;
  pipelineValue?: number;
  immediateActions?: number;
  contractEmiPerMonth?: number;
}

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
// DecisionForge pipeline values are in US dollars (its datasets are USD).
const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

/**
 * Plain-language summary of the numbers on this page. It is assembled by fixed rules from the figures
 * shown (no language model), so every sentence can be checked against a number on screen.
 */
export const ExecutiveBriefing: React.FC<Props> = ({
  grossIncome,
  totalExpenses,
  retainedSavings,
  savingsPct,
  windowLabel,
  pipelineValue,
  immediateActions,
  contractEmiPerMonth,
}) => {
  const outflowRatio = grossIncome > 0 ? Math.round((totalExpenses / grossIncome) * 100) : 0;
  const sentences: string[] = [
    `Over ${windowLabel}, inflow was ${inr(grossIncome)} against outflows of ${inr(totalExpenses)} (${outflowRatio}% of inflow), leaving ${inr(retainedSavings)} retained (${savingsPct}%).`,
  ];

  if (retainedSavings < 0) sentences.push('Outflows exceed inflows in this window, so cash is being drawn down; review the largest expense categories first.');
  else if (outflowRatio >= 80) sentences.push('Outflows take most of the inflow, which leaves a thin buffer for a slow month.');
  else if (savingsPct >= 30) sentences.push('The retained share is healthy; consider whether surplus cash is working (deposits, debt reduction or growth spend).');

  if (contractEmiPerMonth && contractEmiPerMonth > 0 && grossIncome > 0) {
    sentences.push(`Analysed contracts commit ${inr(contractEmiPerMonth)} a month in repayments.`);
  }
  if (pipelineValue && pipelineValue > 0) {
    sentences.push(
      `DecisionForge sees a ${usd(pipelineValue)} sales pipeline${immediateActions ? `, with ${immediateActions} opportunit${immediateActions === 1 ? 'y' : 'ies'} needing immediate action` : ''}.`,
    );
  }

  return (
    <section
      data-testid="executive-briefing"
      aria-label="Executive financial briefing"
      className="relative overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-cobalt-50 p-5"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-sm">
          <Sparkles size={14} />
        </span>
        <h2 className="text-xs font-black uppercase tracking-widest text-violet-700">Executive briefing</h2>
        <span className="ml-auto text-[10px] font-bold text-slate-400">Built from the figures on this page</span>
      </div>
      <p className="text-sm text-slate-800 font-medium leading-relaxed">{sentences.join(' ')}</p>
    </section>
  );
};
