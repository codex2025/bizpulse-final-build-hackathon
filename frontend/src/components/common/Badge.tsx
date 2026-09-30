import React from 'react';

export type BadgeVariant =
  | 'cobalt'
  | 'teal'
  | 'amber'
  | 'vermilion'
  | 'rose'
  | 'violet'
  | 'emerald'
  | 'neutral'
  | 'outline';
export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  dot = false,
  children,
  className = '',
  icon,
}) => {
  const sizeStyles: Record<BadgeSize, string> = {
    xs: 'text-[10px] px-2 py-0.5 gap-1 rounded-full',
    sm: 'text-[11px] px-2.5 py-0.5 gap-1.5 rounded-full',
    md: 'text-xs px-3 py-1 gap-1.5 rounded-full',
  };

  const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
    cobalt: {
      container: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-bold',
      dot: 'bg-indigo-500',
    },
    teal: {
      container: 'bg-teal-50 text-teal-700 border border-teal-200/80 font-bold',
      dot: 'bg-teal-500',
    },
    emerald: {
      container: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold',
      dot: 'bg-emerald-500',
    },
    amber: {
      container: 'bg-amber-50 text-amber-800 border border-amber-200/80 font-bold',
      dot: 'bg-amber-500',
    },
    vermilion: {
      container: 'bg-rose-50 text-rose-700 border border-rose-200/80 font-bold',
      dot: 'bg-rose-500',
    },
    rose: {
      container: 'bg-rose-50 text-rose-700 border border-rose-200/80 font-bold',
      dot: 'bg-rose-500',
    },
    violet: {
      container: 'bg-violet-50 text-violet-700 border border-violet-200/80 font-bold',
      dot: 'bg-violet-500',
    },
    neutral: {
      container: 'bg-slate-100 text-slate-700 border border-slate-200 font-semibold',
      dot: 'bg-slate-400',
    },
    outline: {
      container: 'bg-transparent text-slate-600 border border-slate-200 font-medium',
      dot: 'bg-slate-400',
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center tracking-tight select-none ${sizeStyles[size]} ${currentVariant.container} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${currentVariant.dot}`}
          aria-hidden="true"
        />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
};
