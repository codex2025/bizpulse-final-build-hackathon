import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Target, TrendingDown, TrendingUp } from 'lucide-react';

interface BudgetActualItem {
  category: string;
  actual: number;
  budget: number;
  isOver: boolean;
  variance: number;
  statusText: string;
}

interface Props {
  data: BudgetActualItem[];
}

export const BudgetVsActualChart: React.FC<Props> = ({ data = [] }) => {
  return (
    <div className="card p-6 border border-slate-200 rounded-3xl space-y-4 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Target size={16} className="text-brand-600" /> Budget vs. Actual Outflow
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Category limit adherence with real-time over/under variance indicators
          </p>
        </div>
      </div>

      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
              itemStyle={{ fontSize: 12, fontWeight: 700 }}
              formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 10 }}
              formatter={(value) => <span className="text-slate-700">{value}</span>}
            />
            <Bar dataKey="budget" name="Budget Limit" fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={16} />
            <Bar dataKey="actual" name="Actual Spent" fill="#e11d48" radius={[6, 6, 0, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Variance Tags */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
        {data.slice(0, 3).map((item) => (
          <div
            key={item.category}
            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
              item.isOver ? 'bg-red-50/70 border-red-200 text-red-700' : 'bg-emerald-50/70 border-emerald-200 text-emerald-700'
            }`}
          >
            <span className="truncate">{item.category}</span>
            <span className="text-[11px] font-black flex items-center gap-1">
              {item.isOver ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {item.statusText}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
