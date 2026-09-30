import React from 'react';

export type CardVariant = 'default' | 'subtle' | 'interactive' | 'bordered';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  ...props
}) => {
  const paddingStyles: Record<string, string> = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6',
  };

  const variantStyles: Record<CardVariant, string> = {
    default: 'bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(16,24,47,0.04)]',
    subtle: 'bg-slate-50/80 backdrop-blur-md border border-slate-200/80',
    interactive:
      'bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(16,24,47,0.04)] hover:border-violet-300 hover:shadow-[0_12px_28px_-6px_rgba(124,58,237,0.12)] hover:-translate-y-0.5 transition-all cursor-pointer',
    bordered: 'bg-transparent border border-slate-200/90',
  };

  return (
    <div
      className={`rounded-2xl overflow-hidden ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  action,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`flex items-start justify-between gap-4 pb-3 mb-3 border-b border-slate-100 last:border-b-0 last:mb-0 last:pb-0 ${className}`}
      {...props}
    >
      <div className="space-y-0.5 min-w-0">{children}</div>
      {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <h3
      className={`text-sm font-bold text-ink-900 tracking-tight leading-snug truncate ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <p
      className={`text-xs text-slate-500 font-medium leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`space-y-3 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
