import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Activity, AlertCircle } from 'lucide-react';

interface WeeklyPoint {
  period: string;
  spending: number;
  budgetLimit: number;
  isHigh?: boolean;
}

interface Props {
  data: WeeklyPoint[];
}

export const SpendingTimeLineChart: React.FC<Props> = ({ data = [] }) => {
  return (
    <div className="card p-6 border border-slate-200 rounded-3xl space-y-4 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-extrabold text-sm text-ink-900 flex items-center gap-2">
            <Activity size={16} className="text-cobalt-600" /> Outflow Velocity Trajectory
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Periodic spending rhythm compared against operational target limits
          </p>
        </div>
      </div>

      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
              itemStyle={{ fontSize: 12, fontWeight: 700 }}
              formatter={(val: unknown) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Outflow']}
            />
            <Line
              type="monotone"
              dataKey="spending"
              name="Outflow"
              stroke="#2457FF"
              strokeWidth={3}
              dot={{ r: 5, fill: '#2457FF', strokeWidth: 2, stroke: '#ffffff' }}
              activeDot={{ r: 7, fill: '#F04438' }}
            />
            <Line
              type="monotone"
              dataKey="budgetLimit"
              name="Target Limit"
              stroke="#cbd5e1"
              strokeDasharray="4 4"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {data.some((d) => d.isHigh) && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
          <AlertCircle size={15} className="text-amber-600 flex-shrink-0" />
          <span>Periodic outflow exceeded benchmark baseline due to non-recurring procurement.</span>
        </div>
      )}
    </div>
  );
};
