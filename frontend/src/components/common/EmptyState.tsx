import React from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-dashed border-slate-200 rounded-financial bg-white ${className}`}
    >
      <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3.5">
        {icon || <FolderOpen size={20} />}
      </div>

      <h3 className="text-sm font-bold text-ink-900 tracking-tight mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 font-medium max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
