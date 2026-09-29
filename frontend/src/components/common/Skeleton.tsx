import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/70 rounded-md ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
};

export const MetricSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`metric-skeleton-${i}`}
          className="bg-white border border-slate-200 rounded-financial p-4 space-y-3"
        >
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
          <Skeleton className="h-8 w-32" />
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 300 }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-financial p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
      <div style={{ height }} className="flex items-end gap-3 pt-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={`bar-skel-${i}`}
            className="flex-1 rounded-t"
            style={{ height: `${20 + ((i * 17) % 75)}%` }}
          />
        ))}
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => {
  return (
    <div className="border border-slate-200 rounded-financial overflow-hidden bg-white">
      <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`head-skel-${i}`} className="h-3.5 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`row-skel-${r}`} className="px-4 py-3.5 flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={`cell-skel-${r}-${c}`} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
