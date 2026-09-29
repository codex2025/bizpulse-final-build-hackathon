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

  const categoryFills = ['#F04438', '#2457FF', '#00A88F', '#F5B700', '#64748B'];

  return (
    <div className="card p-6 border border-slate-200 rounded-3xl space-y-6 bg-white shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-extrabold text-sm text-ink-900 flex items-center gap-2">
            <DollarSign size={16} className="text-teal-600" /> Capital Waterfall: Inflow → Operating Burn → Retained Surplus
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Dynamic distribution mapping gross operational revenues into expenses and retained liquidity
          </p>
        </div>
        <span className="text-xs font-black px-3 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 self-start sm:self-auto font-mono tabular-nums">
          {data.savingsPercentage}% Retained Margin
        </span>
      </div>

      {/* Visual Flow Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
        {/* Node 1: Gross Inflow */}
        <div className="p-5 rounded-2xl border-2 border-cobalt-200 bg-cobalt-50/40 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-cobalt-600 uppercase tracking-wider">Step 1 • Total Inflow</span>
            <div className="w-8 h-8 rounded-lg bg-cobalt-600 text-white flex items-center justify-center shadow-xs">
              <DollarSign size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-ink-900 font-mono tabular-nums">
              ₹{data.grossIncome.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-cobalt-700 font-bold mt-0.5">Commercial Revenue & Inflows</p>
          </div>
        </div>

        {/* Node 2: Dispatched Outflows */}
        <div className="p-5 rounded-2xl border-2 border-vermilion-200 bg-vermilion-50/40 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-vermilion-600 uppercase tracking-wider">Step 2 • Operating Burn</span>
            <div className="w-8 h-8 rounded-lg bg-vermilion-600 text-white flex items-center justify-center shadow-xs">
              <Wallet size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-ink-900 font-mono tabular-nums">
              ₹{data.totalExpenses.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-vermilion-700 font-bold mt-0.5">Total Dispatched Outflows</p>
          </div>
        </div>

        {/* Node 3: Retained Cushion */}
        <div className="p-5 rounded-2xl border-2 border-teal-200 bg-teal-50/40 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-teal-600 uppercase tracking-wider">Step 3 • Retained Surplus</span>
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <PiggyBank size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-ink-900 font-mono tabular-nums">
              ₹{data.retainedSavings.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-teal-700 font-bold mt-0.5">Net Retained Working Capital</p>
          </div>
        </div>
      </div>

      {/* Category Inflow Allocation Stack */}
      <div className="pt-2">
        <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
          Proportional Allocation Across Operational Buckets
        </p>
        <div className="flex h-4 w-full rounded-xl overflow-hidden bg-slate-100 p-0.5 gap-1">
          {data.categories.map((c, i) => (
            <div
              key={c.category}
              style={{
                width: `${Math.max(10, c.percentage)}%`,
                backgroundColor: categoryFills[i % categoryFills.length],
              }}
              className="h-full rounded-md"
              title={`${c.category}: ₹${c.amount.toLocaleString('en-IN')} (${c.percentage}%)`}
            />
          ))}
          <div
            style={{ width: `${Math.max(15, data.savingsPercentage)}%` }}
            className="bg-teal-500 h-full rounded-md"
            title={`Retained Surplus: ₹${data.retainedSavings.toLocaleString('en-IN')} (${data.savingsPercentage}%)`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-bold text-slate-600 font-mono tabular-nums">
          {data.categories.map((c, i) => (
            <span key={c.category} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: categoryFills[i % categoryFills.length] }}
              />
              {c.category} ({c.percentage}%)
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-teal-700">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            Retained Surplus ({data.savingsPercentage}%)
          </span>
        </div>
      </div>
    </div>
  );
};
