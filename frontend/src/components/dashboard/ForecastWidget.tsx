import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, AlertTriangle, Zap, CalendarDays } from 'lucide-react';
import { analyticsService } from '../../services/analyticsService';

const fmt = (n: number) =>
  '₹' + (n >= 100000 ? (n / 100000).toFixed(1) + 'L' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n.toLocaleString('en-IN'));

const confidenceColors = {
  high: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-slate-500 bg-slate-50 border-slate-200',
};

export const ForecastWidget: React.FC = () => {
  const { data: forecast, isLoading } = useQuery({
    queryKey: ['forecast'],
    queryFn: analyticsService.getForecast,
  });

  if (isLoading) return (
    <div className="card border border-slate-200 bg-white p-6 animate-pulse">
      <div className="h-4 bg-slate-100 rounded w-48 mb-4" />
      <div className="h-12 bg-slate-100 rounded mb-3" />
      <div className="h-3 bg-slate-100 rounded w-3/4" />
    </div>
  );

  if (!forecast) return null;

  const isPositive = forecast.projectedMonthEndBalance >= 0;
  const confidence = forecast.forecastConfidence as 'high' | 'medium' | 'low';
  const daysProgress = forecast.daysInMonth > 0
    ? Math.round((forecast.dayOfMonth / forecast.daysInMonth) * 100)
    : 0;

  const overrunAlerts = forecast.overrunAlerts || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card border border-slate-200 bg-white p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
            <CalendarDays size={18} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Month-End Forecast</h3>
            <p className="text-[11px] font-medium text-slate-500">Based on spending velocity · Day {forecast.dayOfMonth}/{forecast.daysInMonth}</p>
          </div>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${confidenceColors[confidence]}`}>
          {confidence} confidence
        </span>
      </div>

      {/* Month Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
          <span>Month progress</span>
          <span>{daysProgress}% · {forecast.daysRemaining} days left</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${daysProgress}%` }}
          />
        </div>
      </div>

      {/* Projected Balance Hero */}
      <div className={`p-4 rounded-2xl border ${isPositive ? 'bg-emerald-50/60 border-emerald-200' : 'bg-red-50/60 border-red-200'}`}>
        <div className="flex items-center gap-2 mb-1">
          {isPositive
            ? <TrendingUp size={16} className="text-emerald-600" />
            : <TrendingDown size={16} className="text-red-600" />
          }
          <span className={`text-xs font-black uppercase tracking-wider ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
            Projected Month-End Balance
          </span>
        </div>
        <p className={`text-2xl font-black tracking-tight ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
          {isPositive ? '' : '-'}{fmt(Math.abs(forecast.projectedMonthEndBalance))}
        </p>
        <p className="text-[11px] font-medium text-slate-600 mt-1">{forecast.summary}</p>
      </div>

      {/* Spending Velocity */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
          <p className="text-[10px] font-black text-slate-500 uppercase">Spent So Far</p>
          <p className="text-base font-black text-slate-900">{fmt(forecast.totalSpentSoFar)}</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
          <p className="text-[10px] font-black text-slate-500 uppercase">Daily Burn Rate</p>
          <p className="text-base font-black text-slate-900">{fmt(forecast.dailyBurnRate)}/day</p>
        </div>
      </div>

      {/* Budget Alerts */}
      {overrunAlerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-amber-700">
            <AlertTriangle size={13} />
            <span>Budget Overrun Alerts</span>
          </div>
          {overrunAlerts.slice(0, 3).map((alert: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-xs">
              <div>
                <span className="font-bold text-amber-900">{alert.category}</span>
                <span className="text-amber-600 font-medium ml-1.5">
                  ₹{alert.currentSpend.toLocaleString('en-IN')} / ₹{alert.budgetAmount.toLocaleString('en-IN')} budget
                </span>
              </div>
              <span className="font-black text-red-600">+₹{alert.projectedOverrun.toLocaleString('en-IN')} projected</span>
            </div>
          ))}
        </div>
      )}

      {overrunAlerts.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
          <Zap size={14} className="text-emerald-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-emerald-800">All budget categories on track for this month 🎉</p>
        </div>
      )}
    </motion.div>
  );
};
