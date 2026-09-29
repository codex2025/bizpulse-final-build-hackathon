import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, CalendarDays } from 'lucide-react';
import { analyticsService } from '../../services/analyticsService';
import { Badge } from '../common/Badge';

interface OverrunAlert {
  category: string;
  currentSpend: number;
  budgetAmount: number;
  projectedOverrun: number;
}

interface ForecastData {
  projectedMonthEndBalance: number;
  forecastConfidence?: string;
  dayOfMonth: number;
  daysInMonth: number;
  daysRemaining: number;
  summary: string;
  totalSpentSoFar: number;
  dailyBurnRate: number;
  overrunAlerts?: OverrunAlert[];
}

const fmt = (n: number) =>
  '₹' + (n >= 100000 ? (n / 100000).toFixed(1) + 'L' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n.toLocaleString('en-IN'));

export const ForecastWidget: React.FC = () => {
  const { data: forecast, isLoading } = useQuery<ForecastData>({
    queryKey: ['forecast'],
    queryFn: analyticsService.getForecast,
  });

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-financial p-5 shadow-card animate-pulse space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-4 bg-slate-100 rounded w-40" />
          <div className="h-5 bg-slate-100 rounded w-20" />
        </div>
        <div className="h-16 bg-slate-100 rounded-lg" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-12 bg-slate-100 rounded-lg" />
          <div className="h-12 bg-slate-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!forecast) return null;

  const isPositive = forecast.projectedMonthEndBalance >= 0;
  const confidence = (forecast.forecastConfidence as 'high' | 'medium' | 'low') || 'medium';
  const daysProgress =
    forecast.daysInMonth > 0 ? Math.round((forecast.dayOfMonth / forecast.daysInMonth) * 100) : 0;

  const overrunAlerts = forecast.overrunAlerts || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-white border border-slate-200 rounded-financial p-5 shadow-card space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cobalt-50 text-cobalt-600 border border-cobalt-100 flex items-center justify-center flex-shrink-0">
            <CalendarDays size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
              Month-End Projection
            </h3>
            <p className="text-[11px] font-medium text-slate-500">
              Velocity-based • Day {forecast.dayOfMonth}/{forecast.daysInMonth}
            </p>
          </div>
        </div>

        <Badge
          variant={confidence === 'high' ? 'teal' : confidence === 'medium' ? 'amber' : 'neutral'}
          size="xs"
        >
          {confidence} confidence
        </Badge>
      </div>

      {/* Month Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <span>Month progress</span>
          <span className="font-mono tabular-nums text-slate-600">
            {daysProgress}% ({forecast.daysRemaining} days left)
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-cobalt-500 rounded-full transition-all duration-500"
            style={{ width: `${daysProgress}%` }}
          />
        </div>
      </div>

      {/* Projected Balance Hero */}
      <div
        className={`p-3.5 rounded-lg border ${
          isPositive ? 'bg-teal-50/60 border-teal-200/80' : 'bg-vermilion-50/60 border-vermilion-200/80'
        }`}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          {isPositive ? (
            <TrendingUp size={14} className="text-teal-600 flex-shrink-0" />
          ) : (
            <TrendingDown size={14} className="text-vermilion-600 flex-shrink-0" />
          )}
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              isPositive ? 'text-teal-800' : 'text-vermilion-800'
            }`}
          >
            Projected Month-End Position
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <p
            className={`text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight ${
              isPositive ? 'text-teal-900' : 'text-vermilion-900'
            }`}
          >
            {isPositive ? '' : '-'}{fmt(Math.abs(forecast.projectedMonthEndBalance))}
          </p>
          <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[200px]">
            {forecast.summary}
          </span>
        </div>
      </div>

      {/* Spending Velocity */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Spent to Date
          </p>
          <p className="text-sm font-bold font-mono tabular-nums text-ink-900 mt-0.5">
            {fmt(forecast.totalSpentSoFar)}
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Daily Burn Velocity
          </p>
          <p className="text-sm font-bold font-mono tabular-nums text-ink-900 mt-0.5">
            {fmt(forecast.dailyBurnRate)}/day
          </p>
        </div>
      </div>

      {/* Budget Alerts */}
      {overrunAlerts.length > 0 ? (
        <div className="space-y-1.5 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
            <AlertTriangle size={12} className="text-amber-600" />
            <span>Budget Overrun Notifications</span>
          </div>
          {overrunAlerts.slice(0, 2).map((alert: OverrunAlert, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-md bg-amber-50/70 border border-amber-200/80 text-xs"
            >
              <div className="truncate min-w-0 mr-2">
                <span className="font-semibold text-amber-900 truncate block">
                  {alert.category}
                </span>
                <span className="text-[10.5px] text-amber-700 font-mono tabular-nums">
                  ₹{alert.currentSpend?.toLocaleString('en-IN')} / ₹{alert.budgetAmount?.toLocaleString('en-IN')} budget
                </span>
              </div>
              <span className="text-[11px] font-bold font-mono tabular-nums text-vermilion-700 flex-shrink-0">
                +₹{alert.projectedOverrun?.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-teal-50/70 border border-teal-200/70 text-xs">
          <CheckCircle2 size={13} className="text-teal-600 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-teal-800">
            All budget categories currently within target parameters
          </span>
        </div>
      )}
    </motion.div>
  );
};
