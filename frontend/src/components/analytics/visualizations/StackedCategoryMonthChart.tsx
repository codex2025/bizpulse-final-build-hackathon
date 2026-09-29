import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface Props {
  data: any[];
}

export const StackedCategoryMonthChart: React.FC<Props> = ({ data = [] }) => {
  return (
    <div className="card p-6 border border-slate-200 rounded-3xl space-y-4 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <BarChart3 size={16} className="text-purple-600" /> Category × Month Evolution
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Multi-month stacked category breakdown revealing spending shifts
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
              formatter={(val: any, name: any) => [`₹${Number(val).toLocaleString('en-IN')}`, name]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 10 }}
              formatter={(value) => <span className="text-slate-700">{value}</span>}
            />
            <Bar dataKey="Housing" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Food" stackId="a" fill="#e11d48" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Software" stackId="a" fill="#a855f7" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Transport" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Utilities" stackId="a" fill="#06b6d4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
