import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load financial data',
  message = 'An unexpected error occurred while communicating with the Bizpulse financial engine.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`p-6 sm:p-8 rounded-financial border border-vermilion-200/80 bg-vermilion-50/50 flex flex-col items-center justify-center text-center ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-vermilion-100 flex items-center justify-center text-vermilion-600 mb-3">
        <AlertCircle size={20} />
      </div>

      <h3 className="text-sm font-bold text-ink-900 tracking-tight mb-1">{title}</h3>
      <p className="text-xs text-slate-600 font-medium max-w-md mb-4 leading-relaxed">
        {message}
      </p>

      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={13} />}
          onClick={onRetry}
          className="border-slate-300 text-ink-900 bg-white"
        >
          Retry Request
        </Button>
      )}
    </div>
  );
};
