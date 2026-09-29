import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { usePrefersReducedMotion } from '../../utils/motion';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'amber';
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
      'inline-flex items-center justify-center font-semibold rounded-lg transition-colors cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-500/30 disabled:opacity-50 disabled:pointer-events-none';

    const sizeStyles: Record<ButtonSize, string> = {
      xs: 'text-[11px] px-2.5 py-1 gap-1.5 h-7',
      sm: 'text-xs px-3.5 py-1.5 gap-2 h-8',
      md: 'text-xs px-4 py-2 gap-2 h-9',
      lg: 'text-sm px-5 py-2.5 gap-2.5 h-10',
    };

    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-cobalt-500 hover:bg-cobalt-600 active:bg-cobalt-700 text-white shadow-xs border border-cobalt-600/40',
      secondary:
        'bg-white hover:bg-slate-50 active:bg-slate-100 text-ink-900 border border-slate-200 shadow-2xs hover:border-slate-300',
      outline:
        'bg-transparent hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300',
      ghost:
        'bg-transparent hover:bg-slate-100/70 active:bg-slate-100 text-slate-600 hover:text-ink-900',
      danger:
        'bg-vermilion-500 hover:bg-vermilion-600 active:bg-vermilion-700 text-white shadow-xs border border-vermilion-600/30',
      success:
        'bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-white shadow-xs border border-teal-600/30',
      amber:
        'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-ink-900 shadow-xs border border-amber-600/30 font-bold',
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
