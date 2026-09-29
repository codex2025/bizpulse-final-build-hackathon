import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface Props {
  data: Array<Record<string, string | number>>;
}

export const StackedCategoryMonthChart: React.FC<Props> = ({ data = [] }) => {
  return (
    <div className="card p-6 border border-slate-200 rounded-3xl space-y-4 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-extrabold text-sm text-ink-900 flex items-center gap-2">
            <BarChart3 size={16} className="text-cobalt-600" /> Category × Month Structural Trend
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Multi-month stacked category breakdown revealing operational spending shifts
          </p>
        </div>
      </div>

      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
              itemStyle={{ fontSize: 12, fontWeight: 700 }}
              formatter={(val: unknown, name: unknown) => [`₹${Number(val).toLocaleString('en-IN')}`, String(name)]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 10 }}
              formatter={(value) => <span className="text-slate-700">{value}</span>}
            />
            {/* Bizpulse Semantic Palette */}
            <Bar dataKey="Housing" stackId="a" fill="#2457FF" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Food" stackId="a" fill="#F04438" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Software" stackId="a" fill="#00A88F" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Transport" stackId="a" fill="#F5B700" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Utilities" stackId="a" fill="#64748B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
