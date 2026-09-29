import React, { useState } from 'react';
import { Sparkles, Sliders, ArrowUpRight } from 'lucide-react';

interface WhatIfProps {
  currentScore: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  persona?: string;
}

export const WhatIfSimulator: React.FC<WhatIfProps> = ({
  currentScore = 82,
  monthlyIncome = 150000,
  monthlyExpenses = 45000,
}) => {
  const [cutSpending, setCutSpending] = useState(4000);
  const [boostIncome, setBoostIncome] = useState(0);

  // Dynamic deterministic projection
  const adjIncome = monthlyIncome + boostIncome;
  const adjExpenses = Math.max(8000, monthlyExpenses - cutSpending);
  const adjSavings = Math.max(0, adjIncome - adjExpenses);
  const adjSavingsRate = adjIncome > 0 ? Math.round((adjSavings / adjIncome) * 100) : 0;

  // Compute projected score
  let projectedScore = currentScore;
  const savingsGain = (cutSpending + boostIncome);
  if (savingsGain > 0) {
    const pointsToAdd = Math.min(18, Math.round(savingsGain / 1500) + (adjSavingsRate >= 35 ? 3 : 1));
    projectedScore = Math.min(99, currentScore + pointsToAdd);
  }

  const scoreDiff = projectedScore - currentScore;

  return (
    <div className="card p-6 border border-slate-200 rounded-3xl space-y-5 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
            <Sliders size={16} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
              "What-If?" Financial Simulator
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Experiment with spending adjustments to see real-time score projections
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          Interactive
        </span>
      </div>

      {/* Projection Score Header */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-brand-500/5 to-transparent border border-purple-200 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Current Score</span>
          <p className="text-2xl font-black text-slate-900">{currentScore} <span className="text-xs font-bold text-slate-400">/ 100</span></p>
        </div>

        <div className="text-center">
          <span className="text-xs font-bold text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
            <ArrowUpRight size={13} /> +{scoreDiff} pts
          </span>
          <p className="text-[11px] font-bold text-slate-500 mt-1">Projected Gain</p>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider">Projected Score</span>
          <p className="text-2xl font-black text-purple-700">{projectedScore} <span className="text-xs font-bold text-purple-400">/ 100</span></p>
        </div>
      </div>

      {/* Interactive Sliders */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
            <span>Cut Discretionary Shopping / Dining</span>
            <span className="text-emerald-700 font-black">Save ₹{cutSpending.toLocaleString('en-IN')}/mo</span>
          </div>
          <input
            type="range"
            min="0"
            max="15000"
            step="500"
            value={cutSpending}
            onChange={(e) => setCutSpending(Number(e.target.value))}
            className="w-full accent-brand-600 h-2 bg-slate-100 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold mt-1">
            <span>₹0</span>
            <span>₹7,500</span>
            <span>₹15,000</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
            <span>Increase Side / Bonus Inflows</span>
            <span className="text-indigo-700 font-black">+₹{boostIncome.toLocaleString('en-IN')}/mo</span>
          </div>
          <input
            type="range"
            min="0"
            max="30000"
            step="1000"
            value={boostIncome}
            onChange={(e) => setBoostIncome(Number(e.target.value))}
            className="w-full accent-indigo-600 h-2 bg-slate-100 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold mt-1">
            <span>₹0</span>
            <span>₹15,000</span>
            <span>₹30,000</span>
          </div>
        </div>
      </div>

      {/* Outcome Summary */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 space-y-1">
        <p className="flex items-center gap-1.5 text-slate-900 font-bold">
          <Sparkles size={14} className="text-purple-600" />
          Projected Impact:
        </p>
        <p className="text-slate-600 leading-relaxed">
          Reducing discretionary burn by ₹{cutSpending.toLocaleString('en-IN')}/mo elevates your savings rate to <strong className="text-slate-900">{adjSavingsRate}%</strong> (₹{adjSavings.toLocaleString('en-IN')}/mo retained surplus), projecting your financial health to <strong className="text-purple-700">{projectedScore}/100</strong>.
        </p>
      </div>
    </div>
  );
};
