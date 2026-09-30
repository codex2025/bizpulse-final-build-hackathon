import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { usePrefersReducedMotion } from '../../utils/motion';

export type ButtonVariant = 'primary' | 'gradient' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'amber';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'sm',
      icon,
      rightIcon,
      loading = false,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const prefersReducedMotion = usePrefersReducedMotion();

    const baseStyles =
      'inline-flex items-center justify-center font-bold rounded-xl transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:opacity-50 disabled:pointer-events-none';

    const sizeStyles: Record<ButtonSize, string> = {
      xs: 'text-[11px] px-2.5 py-1 gap-1.5 h-7',
      sm: 'text-xs px-3.5 py-1.5 gap-2 h-8',
      md: 'text-xs px-4 py-2 gap-2 h-9',
      lg: 'text-sm px-5 py-2.5 gap-2.5 h-10',
    };

    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xs shadow-indigo-500/20 border border-violet-600/30',
      gradient:
        'bg-gradient-to-r from-rose-600 via-fuchsia-600 to-violet-600 hover:from-rose-500 hover:via-fuchsia-500 hover:to-violet-500 text-white shadow-md shadow-fuchsia-500/25 border border-fuchsia-500/40 hover:scale-[1.01] active:scale-[0.98]',
      secondary:
        'bg-white/90 hover:bg-slate-50 text-slate-800 border border-slate-200/90 shadow-2xs hover:border-slate-300',
      outline:
        'bg-transparent hover:bg-slate-50 text-slate-700 border border-slate-200/90 hover:border-slate-300',
      ghost:
        'bg-transparent hover:bg-slate-100/70 text-slate-600 hover:text-slate-900',
      danger:
        'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-xs shadow-rose-500/20 border border-rose-600/30',
      success:
        'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xs shadow-emerald-500/20 border border-emerald-600/30',
      amber:
        'bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 text-slate-950 shadow-xs shadow-amber-500/20 border border-amber-500/30 font-bold',
    };

    const widthStyle = fullWidth ? 'w-full' : '';

    return (
      <motion.button
        ref={ref}
        whileTap={!disabled && !loading && !prefersReducedMotion ? { scale: 0.985 } : undefined}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyle} ${className}`}
        {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
      >
        {loading ? (
          <Loader2 size={size === 'xs' ? 12 : 14} className="animate-spin text-current" />
        ) : (
          icon && <span className="flex-shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
