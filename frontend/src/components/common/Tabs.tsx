import React from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion, SPRING_SMOOTH } from '../../utils/motion';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'underline' | 'pills' | 'segmented';
  size?: 'sm' | 'md';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  size = 'md',
  className = '',
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  const sizeStyles: Record<string, string> = {
    sm: 'text-xs py-1.5 px-3',
    md: 'text-xs sm:text-sm py-2 px-3.5',
  };

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center p-1 bg-slate-100/90 rounded-lg border border-slate-200/80 ${className}`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`relative z-10 flex items-center gap-2 font-semibold transition-colors rounded-md cursor-pointer select-none ${sizeStyles[size]} ${
                isActive ? 'text-ink-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId={prefersReducedMotion ? undefined : 'segmentedTabIndicator'}
                  transition={SPRING_SMOOTH}
                  className="absolute inset-0 bg-white rounded-md shadow-2xs border border-slate-200/70 -z-10"
                />
              )}
              {tab.icon && <span className="flex-shrink-0 text-current">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    isActive ? 'bg-cobalt-50 text-cobalt-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'pills') {
    return (
      <div className={`flex items-center gap-1.5 overflow-x-auto pb-1 ${className}`} role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`relative flex items-center gap-2 font-semibold rounded-lg transition-colors cursor-pointer select-none whitespace-nowrap ${sizeStyles[size]} ${
                isActive
                  ? 'bg-cobalt-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-ink-900 hover:bg-slate-100'
              }`}
            >
              {tab.icon && <span className="flex-shrink-0 text-current">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Default: underline
  return (
    <div
      className={`flex items-center gap-6 border-b border-slate-200 overflow-x-auto ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 pb-3 pt-1 font-semibold transition-colors cursor-pointer select-none whitespace-nowrap ${sizeStyles[size]} ${
              isActive ? 'text-cobalt-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.icon && <span className="flex-shrink-0 text-current">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                  isActive ? 'bg-cobalt-50 text-cobalt-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.badge}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId={prefersReducedMotion ? undefined : 'underlineTabIndicator'}
                transition={SPRING_SMOOTH}
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-cobalt-500 rounded-t"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
