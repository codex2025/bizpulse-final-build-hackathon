import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';

interface Anomaly {
  id: string;
  title: string;
  category: string;
  amount: number;
  averageAmount: number;
  factor: string;
  date: string;
  reason: string;
}

interface Props {
  data: Anomaly[];
}

export const AnomalyAlertCard: React.FC<Props> = ({ data = [] }) => {
  if (data.length === 0) return null;

  return (
    <div className="card p-6 border border-amber-200 bg-amber-50/40 rounded-3xl space-y-4">
      <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
            <ShieldAlert size={16} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">Spending Anomaly Radar</h3>
            <p className="text-xs text-slate-600 font-medium">
              AI outlier detection flagging transactions deviating significantly from normal spending
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-200/70 text-amber-900">
          {data.length} Outliers Detected
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.map((anom) => (
          <motion.div
            key={anom.id}
            whileHover={{ scale: 1.01 }}
            className="p-4 rounded-2xl border border-amber-200 bg-white shadow-xs space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900">{anom.title}</span>
              <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                {anom.factor} higher
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-slate-900">₹{anom.amount.toLocaleString('en-IN')}</span>
              <span className="text-xs text-slate-400 font-medium">(vs avg ₹{anom.averageAmount.toLocaleString('en-IN')})</span>
            </div>

            <p className="text-xs text-slate-600 font-medium">{anom.reason}</p>
            <p className="text-[10px] text-slate-400 font-bold">{anom.date} • {anom.category}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
