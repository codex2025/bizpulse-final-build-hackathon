import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { modalVariants, fadeIn } from '../../utils/motion';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  className = '',
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  const sizeStyles: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-ink-950/40 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Modal Panel */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            className={`relative w-full ${sizeStyles[size]} bg-white rounded-financial border border-slate-200 shadow-dialog overflow-hidden z-10 my-auto ${className}`}
          >
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
                <div className="space-y-1">
                  {title && (
                    <h2 className="text-base font-bold text-ink-900 tracking-tight">{title}</h2>
                  )}
                  {description && (
                    <p className="text-xs text-slate-500 font-medium">{description}</p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-md text-slate-400 hover:text-ink-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Close dialog"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}

            <div className="px-5 py-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const DialogFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-end gap-2.5 pt-3 mt-4 border-t border-slate-100 ${className}`}
    >
      {children}
    </div>
  );
};
