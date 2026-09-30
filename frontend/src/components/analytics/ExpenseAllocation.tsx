import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { expenseService } from '../../services/invoiceService';
import { aggregateBy, hhi, topShare, type ExpenseLike } from '../../utils/expenseAllocation';

const COLORS = ['#7c3aed', '#2563eb', '#059669', '#f59e0b', '#e11d48', '#0ea5e9', '#64748b', '#a855f7'];
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

/** Where the money goes: category donut and vendor concentration, aggregated over every expense in the window. */
export const ExpenseAllocation: React.FC<{ since: Date }> = ({ since }) => {
  const { data } = useQuery({ queryKey: ['expenses'], queryFn: expenseService.getAll, staleTime: 30_000 });
  const list = useMemo(() => (Array.isArray(data) ? (data as ExpenseLike[]) : []), [data]);
  const categories = useMemo(() => aggregateBy(list, 'category', since), [list, since]);
  const vendors = useMemo(() => aggregateBy(list, 'vendor_or_payee', since), [list, since]);
  const total = categories.reduce((s, c) => s + c.value, 0);
  const concentration = hhi(vendors);

  if (total === 0) {
    return (
      <section data-testid="expense-allocation" className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-extrabold text-slate-900">No expenses in this window</p>
        <p className="text-xs text-slate-500 font-medium mt-1">Record or import expenses to see the category split and vendor concentration.</p>
      </section>
    );
  }

  return (
    <section data-testid="expense-allocation" aria-label="Expense allocation" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-extrabold text-slate-900">Spend by category</h3>
        <div className="h-60 relative" role="img" aria-label="Expense split by category">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categories} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} isAnimationActive={false}>
                {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => inr(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total</span>
            <span data-testid="expense-total" className="text-lg font-black font-mono tabular-nums text-slate-900">{inr(total)}</span>
          </div>
        </div>
        <ul className="mt-2 space-y-1.5">
          {categories.map((c, i) => (
            <li key={c.name} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="font-bold text-slate-700 flex-1 truncate">{c.name}</span>
              <span className="font-mono font-bold tabular-nums text-slate-900">{inr(c.value)}</span>
              <span className="w-12 text-right font-mono tabular-nums text-slate-400">{(c.share * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Vendor concentration</h3>
          <p className="text-xs text-slate-500 font-medium">
            Top 3 vendors take <strong data-testid="top3-share" className="font-mono">{(topShare(vendors, 3) * 100).toFixed(0)}%</strong> of spend ·
            HHI <strong className="font-mono">{concentration.toLocaleString('en-IN')}</strong>{' '}
            ({concentration > 2500 ? 'highly concentrated' : concentration > 1500 ? 'moderately concentrated' : 'diversified'})
          </p>
        </div>
        <ul className="space-y-2.5">
          {vendors.slice(0, 8).map((v) => (
            <li key={v.name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-700 truncate pr-2">{v.name}</span>
                <span className="font-mono font-bold tabular-nums text-slate-900">{inr(v.value)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(2, v.share * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
