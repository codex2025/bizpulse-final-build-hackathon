import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { usePrefersReducedMotion, EASE_FINANCIAL } from '../../utils/motion';

export type TrendDirection = 'up' | 'down' | 'neutral';
export type TrendSentiment = 'positive' | 'negative' | 'neutral';

export interface MetricCardProps {
  label: string;
  value: React.ReactNode | string | number;
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
  const prefersReducedMotion = usePrefersReducedMotion();

  // Infer sentiment if not explicitly provided
  const resolvedSentiment =
    sentiment || (trend === 'up' ? 'positive' : trend === 'down' ? 'negative' : 'neutral');

  const sentimentStyles: Record<TrendSentiment, { text: string; bg: string; icon: React.ReactNode; glow: string }> = {
    positive: {
      text: 'text-emerald-700 font-extrabold',
      bg: 'bg-emerald-50/90 border-emerald-200 text-emerald-700',
      icon: <TrendingUp size={12} className="stroke-[2.5]" />,
      glow: 'from-emerald-500/20 to-transparent',
    },
    negative: {
      text: 'text-rose-700 font-extrabold',
      bg: 'bg-rose-50/90 border-rose-200 text-rose-700',
      icon: <TrendingDown size={12} className="stroke-[2.5]" />,
      glow: 'from-rose-500/20 to-transparent',
    },
    neutral: {
      text: 'text-violet-700 font-extrabold',
      bg: 'bg-violet-50/90 border-violet-200 text-violet-700',
      icon: <Minus size={12} className="stroke-[2.5]" />,
      glow: 'from-violet-500/20 to-transparent',
    },
  };

  const currentSentiment = sentimentStyles[resolvedSentiment];

  return (
    <motion.div
      whileHover={!prefersReducedMotion ? { y: -3, transition: { duration: 0.2, ease: EASE_FINANCIAL } } : undefined}
      className={`relative overflow-hidden bg-white/90 backdrop-blur-xl border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_-2px_rgba(16,24,47,0.04)] hover:shadow-[0_12px_28px_-6px_rgba(16,24,47,0.08)] hover:border-slate-300 transition-all ${className}`}
    >
      {/* Top subtle ambient glow strip */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${currentSentiment.glow}`} />

      {/* Zone 1: label + icon on the left, change pill / badge on the right. Nothing here can reach the value. */}
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1 basis-[9rem]">
          {icon && (
            <div className="p-1.5 rounded-xl bg-slate-50/90 border border-slate-100 text-slate-600 shadow-2xs shrink-0">
              {icon}
            </div>
          )}
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-tight line-clamp-2" title={label}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {change !== undefined && (
            <span
              data-testid="metric-change"
              className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs whitespace-nowrap font-mono tabular-nums ${currentSentiment.bg} ${currentSentiment.text}`}
            >
              {currentSentiment.icon}
              <span>{change}</span>
            </span>
          )}
          {badge}
          {action}
        </div>
      </div>

      {/* Zone 2: the figure, on its own row, never truncated */}
      <div
        data-testid="metric-value"
        className="text-[clamp(1.25rem,1.9vw,1.875rem)] leading-tight font-black text-slate-900 tracking-tight font-mono tabular-nums whitespace-nowrap"
      >
        {value}
      </div>

      {(period || subtitle) && (
        <div className="mt-3 text-[11px] text-slate-400 font-medium flex items-center justify-between gap-2 border-t border-slate-100/80 pt-2.5">
          {period && <span className="truncate">{period}</span>}
          {subtitle && <span className="text-slate-600 font-bold truncate">{subtitle}</span>}
        </div>
      )}
    </motion.div>
  );
};
