import React from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon } from 'lucide-react';

interface HeatmapDay {
  day: string;
  dayNumber: number;
  amount: number;
  intensity: number; // 1 to 4
}

interface Props {
  data: HeatmapDay[];
}

export const CalendarSpendingHeatmap: React.FC<Props> = ({ data = [] }) => {
  const intensityBg: Record<number, string> = {
    1: 'bg-teal-50 text-teal-800 border-teal-100',
    2: 'bg-teal-100 text-teal-900 border-teal-200',
    3: 'bg-amber-100 text-amber-900 border-amber-200',
    4: 'bg-vermilion-500 text-white border-vermilion-600 shadow-xs',
  };

  return (
    <div className="card p-6 border border-slate-200 rounded-3xl space-y-4 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-extrabold text-sm text-ink-900 flex items-center gap-2">
            <CalendarIcon size={16} className="text-amber-500" /> 30-Day Spending Intensity Heatmap
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Daily expenditure load — saturated tiles identify high-burn operational dates
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 font-mono">
          <span>Low</span>
          <span className="w-3 h-3 rounded bg-teal-50 border border-teal-200" />
          <span className="w-3 h-3 rounded bg-teal-100 border border-teal-300" />
          <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
          <span className="w-3 h-3 rounded bg-vermilion-500" />
          <span>High</span>
        </div>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2 pt-2">
        {data.map((item) => (
          <motion.div
            key={item.dayNumber}
            whileHover={{ scale: 1.08 }}
            className={`p-2.5 rounded-xl border text-center transition-all cursor-default flex flex-col justify-between h-16 ${
              intensityBg[item.intensity] || intensityBg[1]
            }`}
            title={`${item.day}: ₹${item.amount.toLocaleString('en-IN')}`}
          >
            <span className="text-[10px] font-bold opacity-75 font-mono">Day {item.dayNumber}</span>
            <span className="text-xs font-black truncate font-mono tabular-nums">
              ₹{(item.amount / 1000).toFixed(1)}k
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
