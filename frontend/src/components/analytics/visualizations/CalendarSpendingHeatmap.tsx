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
  const intensityBg = {
    1: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    2: 'bg-emerald-200 text-emerald-900 border-emerald-300',
    3: 'bg-amber-200 text-amber-900 border-amber-300',
    4: 'bg-rose-500 text-white border-rose-600 shadow-xs',
  };

  return (
    <div className="card p-6 border border-slate-200 rounded-3xl space-y-4 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <CalendarIcon size={16} className="text-amber-600" /> 30-Day Spending Intensity Heatmap
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Daily expenditure load — darker tiles represent high-spend peaks
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
          <span>Low</span>
          <span className="w-3 h-3 rounded bg-emerald-100" />
          <span className="w-3 h-3 rounded bg-emerald-300" />
          <span className="w-3 h-3 rounded bg-amber-300" />
          <span className="w-3 h-3 rounded bg-rose-500" />
          <span>High</span>
        </div>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2 pt-2">
        {data.map((item) => (
          <motion.div
            key={item.dayNumber}
            whileHover={{ scale: 1.08 }}
            className={`p-2.5 rounded-xl border text-center transition-all cursor-default flex flex-col justify-between h-16 ${
              intensityBg[item.intensity as 1 | 2 | 3 | 4] || intensityBg[1]
            }`}
            title={`${item.day}: ₹${item.amount.toLocaleString('en-IN')}`}
          >
            <span className="text-[10px] font-bold opacity-75">Aug {item.dayNumber}</span>
            <span className="text-xs font-black truncate">₹{(item.amount / 1000).toFixed(1)}k</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
