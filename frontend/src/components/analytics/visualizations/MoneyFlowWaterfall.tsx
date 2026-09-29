import React from 'react';
import { DollarSign, Wallet, PiggyBank } from 'lucide-react';

interface FlowProps {
  data: {
    grossIncome: number;
    totalExpenses: number;
    retainedSavings: number;
    savingsPercentage: number;
    categories: Array<{ category: string; amount: number; percentage: number }>;
  };
}

export const MoneyFlowWaterfall: React.FC<FlowProps> = ({ data }) => {
  if (!data) return null;

  return (
    <div className="card p-6 border border-slate-200 rounded-3xl space-y-6 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-600" /> Income → Outflow → Savings Flow
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Where your monthly inflows actually went and how much was retained
          </p>
        </div>
        <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          {data.savingsPercentage}% Retained
        </span>
      </div>

      {/* Visual Flow Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
        {/* Node 1: Gross Inflow */}
        <div className="p-5 rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Step 1 • Inflow</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <DollarSign size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">₹{data.grossIncome.toLocaleString('en-IN')}</p>
            <p className="text-xs text-indigo-700 font-bold mt-0.5">Total Monthly Income</p>
          </div>
        </div>

        {/* Node 2: Dispatched Outflows */}
        <div className="p-5 rounded-2xl border-2 border-rose-200 bg-rose-50/50 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider">Step 2 • Outflow</span>
            <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <Wallet size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">₹{data.totalExpenses.toLocaleString('en-IN')}</p>
            <p className="text-xs text-rose-700 font-bold mt-0.5">Monthly Living & Ops Burn</p>
          </div>
        </div>

        {/* Node 3: Retained Cushion */}
        <div className="p-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Step 3 • Surplus</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <PiggyBank size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">₹{data.retainedSavings.toLocaleString('en-IN')}</p>
            <p className="text-xs text-emerald-700 font-bold mt-0.5">Net Retained Savings</p>
          </div>
        </div>
      </div>

      {/* Category Inflow Allocation Stack */}
      <div className="pt-2">
        <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
          Detailed Inflow Distribution
        </p>
        <div className="flex h-4 w-full rounded-xl overflow-hidden bg-slate-100 p-0.5 gap-1">
          {data.categories.map((c, i) => {
            const colors = ['bg-rose-500', 'bg-indigo-500', 'bg-purple-500', 'bg-amber-500', 'bg-cyan-500'];
            return (
              <div
                key={c.category}
                style={{ width: `${Math.max(10, c.percentage)}%` }}
                className={`${colors[i % colors.length]} h-full rounded-md`}
                title={`${c.category}: ₹${c.amount.toLocaleString('en-IN')} (${c.percentage}%)`}
              />
            );
          })}
          <div
            style={{ width: `${Math.max(15, data.savingsPercentage)}%` }}
            className="bg-emerald-500 h-full rounded-md"
            title={`Savings: ₹${data.retainedSavings.toLocaleString('en-IN')} (${data.savingsPercentage}%)`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-bold text-slate-600">
          {data.categories.map((c, i) => {
            const dotColors = ['bg-rose-500', 'bg-indigo-500', 'bg-purple-500', 'bg-amber-500', 'bg-cyan-500'];
            return (
              <span key={c.category} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${dotColors[i % dotColors.length]}`} />
                {c.category} ({c.percentage}%)
              </span>
            );
          })}
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Retained Savings ({data.savingsPercentage}%)
          </span>
        </div>
      </div>
    </div>
  );
};
