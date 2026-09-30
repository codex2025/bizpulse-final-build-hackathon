import React from 'react';
import { Clock, Sun, Coffee, Moon, Sparkles } from 'lucide-react';

interface TimeItem {
  period: string;
  amount: number;
  count: number;
  icon: string;
  peak?: boolean;
}

interface Props {
  data: TimeItem[];
}

export const TimeOfDayRadar: React.FC<Props> = ({ data = [] }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'sun':
        return <Sun size={18} className="text-amber-500" />;
      case 'coffee':
        return <Coffee size={18} className="text-amber-700" />;
      case 'moon':
        return <Moon size={18} className="text-cobalt-600" />;
      default:
        return <Sparkles size={18} className="text-teal-600" />;
    }
  };

  return (
    <div className="card p-6 border border-slate-200 rounded-3xl space-y-4 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-extrabold text-sm text-ink-900 flex items-center gap-2">
            <Clock size={16} className="text-cobalt-600" /> Spending Velocity by Time Window
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Behavioral habit analysis revealing peak operational disbursement windows
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
        {data.map((item) => (
          <div
            key={item.period}
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
              item.peak ? 'border-cobalt-300 bg-cobalt-50/40 shadow-xs ring-2 ring-cobalt-500/10' : 'border-slate-100 bg-slate-50/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-white shadow-xs flex items-center justify-center border border-slate-100">
                {getIcon(item.icon)}
              </div>
              {item.peak && (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-cobalt-600 text-white font-mono">
                  Peak Window
                </span>
              )}
            </div>

            <div>
              <p className="text-lg font-black text-ink-900 font-mono tabular-nums">
                ₹{item.amount.toLocaleString('en-IN')}
              </p>
              <p className="text-xs font-bold text-slate-600 mt-0.5">{item.period}</p>
              <p className="text-[11px] text-slate-400 font-medium font-mono tabular-nums">
                {item.count} logged dispatches
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
