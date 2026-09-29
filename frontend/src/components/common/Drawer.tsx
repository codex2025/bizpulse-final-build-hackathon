import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { drawerRight, drawerLeft, fadeIn } from '../../utils/motion';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  position?: 'right' | 'left';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  position = 'right',
  size = 'md',
  children,
  footer,
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
    sm: 'max-w-xs',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  const positionStyles: Record<string, string> = {
    right: 'inset-y-0 right-0',
    left: 'inset-y-0 left-0',
  };

  const variants = position === 'left' ? drawerLeft : drawerRight;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
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

          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className={`fixed ${positionStyles[position]} flex max-w-full pointer-events-auto`}>
              <motion.div
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                role="dialog"
                aria-modal="true"
                className={`w-screen ${sizeStyles[size]} bg-white border-l border-slate-200 shadow-dialog flex flex-col ${className}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="space-y-0.5 min-w-0">
                    {title && (
                      <h2 className="text-base font-bold text-ink-900 tracking-tight truncate">
                        {title}
                      </h2>
                    )}
                    {subtitle && (
                      <p className="text-xs text-slate-500 font-medium truncate">{subtitle}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-md text-slate-400 hover:text-ink-900 hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
                    aria-label="Close drawer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">{children}</div>

                {/* Optional Footer */}
                {footer && (
                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
                    {footer}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
