import React from 'react';

export interface ChartContainerProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  height?: number | string;
  children: React.ReactNode;
  legend?: React.ReactNode;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  action,
  height = 300,
  children,
  legend,
  className = '',
}) => {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-financial p-4 sm:p-5 shadow-card ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-ink-900 tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>

      <div style={{ height, minHeight: typeof height === 'number' ? height : 240 }} className="w-full">
        {children}
      </div>

      {legend && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
          {legend}
        </div>
      )}
    </div>
  );
};

export interface ChartTooltipItem {
  color: string;
  name: string;
  value: string | number;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    color?: string;
    name?: string;
    value?: string | number;
    payload?: Record<string, unknown>;
  }>;
  label?: string | number;
  valueFormatter?: (value: number | string) => string;
}

export const FinancialChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  valueFormatter = (v) => String(v),
}) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-elevated text-xs min-w-[140px]">
      {label && <p className="font-semibold text-slate-500 mb-1.5 border-b border-slate-100 pb-1">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 truncate">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color || '#2457FF' }}
              />
              <span className="text-slate-600 truncate">{entry.name}</span>
            </div>
            <span className="font-mono tabular-nums font-bold text-ink-900 flex-shrink-0">
              {entry.value !== undefined ? valueFormatter(entry.value) : '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
