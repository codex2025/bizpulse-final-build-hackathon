import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type TrendDirection = 'up' | 'down' | 'neutral';
export type TrendSentiment = 'positive' | 'negative' | 'neutral';

export interface MetricCardProps {
  label: string;
  value: string | number;
  change?: string | number;
  trend?: TrendDirection;
  sentiment?: TrendSentiment;
  period?: string;
  icon?: React.ReactNode;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  change,
  trend,
  sentiment,
  period,
  icon,
  subtitle,
  badge,
  action,
  className = '',
}) => {
  // Infer sentiment if not explicitly provided
  // In finance, up is usually positive, down is negative
  const resolvedSentiment =
    sentiment || (trend === 'up' ? 'positive' : trend === 'down' ? 'negative' : 'neutral');

  const sentimentStyles: Record<TrendSentiment, { text: string; bg: string; icon: React.ReactNode }> = {
    positive: {
      text: 'text-teal-700',
      bg: 'bg-teal-50 border-teal-200/80',
      icon: <TrendingUp size={12} className="stroke-[2.5]" />,
    },
    negative: {
      text: 'text-vermilion-700',
      bg: 'bg-vermilion-50 border-vermilion-200/80',
      icon: <TrendingDown size={12} className="stroke-[2.5]" />,
    },
    neutral: {
      text: 'text-slate-600',
      bg: 'bg-slate-50 border-slate-200/80',
      icon: <Minus size={12} className="stroke-[2.5]" />,
    },
  };

  const currentSentiment = sentimentStyles[resolvedSentiment];

  return (
    <div
      className={`bg-white border border-slate-200 rounded-financial p-4 sm:p-5 shadow-card hover:border-slate-300 transition-all ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
          {label}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {badge}
          {icon && <div className="text-slate-400 p-1 rounded-md bg-slate-50">{icon}</div>}
          {action}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3 mt-1">
        <div className="text-2xl sm:text-3xl font-extrabold text-ink-900 tracking-tight font-mono tabular-nums truncate">
          {value}
        </div>

        {change !== undefined && (
          <div
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${currentSentiment.bg} ${currentSentiment.text} flex-shrink-0 font-mono tabular-nums`}
          >
            {currentSentiment.icon}
            <span>{change}</span>
          </div>
        )}
      </div>

      {(period || subtitle) && (
        <div className="mt-2 text-[11px] text-slate-400 font-medium flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
          {period && <span className="truncate">{period}</span>}
          {subtitle && <span className="text-slate-500 font-semibold truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
