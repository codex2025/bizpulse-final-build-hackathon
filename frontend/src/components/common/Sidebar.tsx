import React from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  BarChart3,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
  LogOut,
  CreditCard,
  Building2,
  Laptop,
  Wallet,
  Target,
  TrendingUp,
  BrainCircuit,
  ArrowLeftRight,
  X,
  User,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { usePersona } from '../../context/PersonaContext';
import { useLayout } from '../../context/useLayout';
import { SPRING_SMOOTH, usePrefersReducedMotion } from '../../utils/motion';
import { Tooltip } from './Tooltip';
import { invoiceService } from '../../services/invoiceService';
import { contractService } from '../../services/contractService';
import { decisionForgeService } from '../../services/decisionForgeService';

interface SidebarProps {
  isMobileDrawer?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

const renderPersonaIcon = (personaType: string, size = 12) => {
  switch (personaType) {
    case 'personal':
    case 'employee':
      return <Wallet size={size} />;
    case 'self_employed':
      return <Laptop size={size} />;
    default:
      return <Building2 size={size} />;
  }
};

export const Sidebar: React.FC<SidebarProps> = ({ isMobileDrawer = false, onCloseMobile }) => {
  const { sidebarCollapsed, toggleSidebar } = useLayout();
  const { persona, config, canSwitchToPersonal, toggleWorkPersonal } = usePersona();
  const prefersReducedMotion = usePrefersReducedMotion();

  // Live counts shown as small badges. A count is only shown when the service answered with a real number.
  const countOf = (x: unknown) => (Array.isArray(x) ? x.length : undefined);
  const { data: invoiceCount } = useQuery({
    queryKey: ['nav-count-invoices'],
    queryFn: () => invoiceService.getAll().then(countOf),
    staleTime: 60_000,
    retry: false,
  });
  const { data: contractCount } = useQuery({
    queryKey: ['nav-count-contracts'],
    queryFn: () => contractService.getAll().then(countOf),
    staleTime: 60_000,
    retry: false,
  });
  const { data: decisionSummary } = useQuery({
    queryKey: ['decision-forge-summary'],
    queryFn: () => decisionForgeService.getSummary(),
    staleTime: 30_000,
    retry: false,
  });
  const navCounts: Record<string, number | undefined> = {
    '/billing': invoiceCount,
    '/contracts': contractCount,
    '/decision-forge': decisionSummary?.hasRun ? decisionSummary.requiresAttention : undefined,
  };

  // In mobile drawer mode, never collapse
  const collapsed = isMobileDrawer ? false : sidebarCollapsed;

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  const getNavGroups = (): NavGroup[] => {
    if (persona === 'personal' || persona === 'employee') {
      return [
        {
          groupName: 'Core Engine',
          items: [
            { to: '/', icon: LayoutDashboard, label: 'Personal Tracker' },
            { to: '/decision-forge', icon: BrainCircuit, label: 'DecisionForge AI' },
          ],
        },
        {
          groupName: 'Cash & Commitments',
          items: [
            { to: '/billing', icon: Receipt, label: 'Salary & Income' },
            { to: '/expenses', icon: CreditCard, label: 'Daily Expenses' },
            { to: '/contracts', icon: FileText, label: 'Agreement Audit' },
          ],
        },
        {
          groupName: 'Planning & Wealth',
          items: [
            { to: '/analytics', icon: BarChart3, label: 'Savings Analytics' },
            { to: '/goals', icon: Target, label: 'Savings Goals' },
            { to: '/wealth', icon: TrendingUp, label: 'Net Worth & Assets' },
          ],
        },
        {
          groupName: 'Workspace',
          items: [{ to: '/settings', icon: Settings, label: 'Settings & Workspace' }],
        },
      ];
    }

    if (persona === 'self_employed') {
      return [
        {
          groupName: 'Core Engine',
          items: [
            { to: '/', icon: LayoutDashboard, label: 'Freelancer Hub' },
            { to: '/decision-forge', icon: BrainCircuit, label: 'DecisionForge AI' },
          ],
        },
        {
          groupName: 'Cash & Commitments',
          items: [
            { to: '/billing', icon: Receipt, label: 'Client Invoices' },
            { to: '/expenses', icon: CreditCard, label: 'Freelance Expenses' },
            { to: '/contracts', icon: FileText, label: 'Contract & NDA Audit' },
          ],
        },
        {
          groupName: 'Planning & Wealth',
          items: [
            { to: '/analytics', icon: BarChart3, label: 'Runway Analytics' },
            { to: '/goals', icon: Target, label: 'Income Goals' },
            { to: '/wealth', icon: TrendingUp, label: 'Net Worth & Assets' },
          ],
        },
        {
          groupName: 'Workspace',
          items: [{ to: '/settings', icon: Settings, label: 'Settings & Workspace' }],
        },
      ];
    }

    // Default: Business SME
    return [
      {
        groupName: 'Core Engine',
        items: [
          { to: '/', icon: LayoutDashboard, label: 'Business Dashboard' },
          { to: '/decision-forge', icon: BrainCircuit, label: 'DecisionForge AI' },
        ],
      },
      {
        groupName: 'Financial Operations',
        items: [
          { to: '/billing', icon: Receipt, label: 'Invoicing & GST' },
          { to: '/expenses', icon: CreditCard, label: 'Corporate Expenses' },
          { to: '/contracts', icon: FileText, label: 'Contract Intelligence' },
        ],
      },
      {
        groupName: 'Planning & Wealth',
        items: [
          { to: '/analytics', icon: BarChart3, label: 'Cash Flow Analytics' },
          { to: '/goals', icon: Target, label: 'Business Goals' },
          { to: '/wealth', icon: TrendingUp, label: 'Net Worth & Assets' },
        ],
      },
      {
        groupName: 'Workspace',
        items: [{ to: '/settings', icon: Settings, label: 'Settings & Workspace' }],
      },
    ];
  };

  const navGroups = getNavGroups();

  const handleLinkClick = () => {
    if (isMobileDrawer && onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside
      className={`relative flex flex-col h-full bg-white/95 backdrop-blur-xl border-r border-slate-200/90 transition-all duration-200 select-none z-30 shadow-[4px_0_24px_-10px_rgba(16,24,47,0.05)] ${
        collapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div
        className={`flex flex-col px-4 py-4 border-b border-slate-100 ${
          collapsed ? 'items-center' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 via-fuchsia-600 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-fuchsia-500/25">
              <Zap size={15} className="text-white fill-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="font-extrabold text-[15.5px] bg-gradient-to-r from-slate-900 via-indigo-950 to-rose-700 bg-clip-text text-transparent tracking-tight block leading-snug">
                  Bizpulse
                </span>
                <div className="flex items-center gap-1.5 -mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9.5px] font-bold text-slate-400 block tracking-wider uppercase">
                    AI Financial Engine
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Close button for mobile drawer */}
          {isMobileDrawer && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1 rounded-md text-slate-400 hover:text-ink-900 hover:bg-slate-100 transition-colors"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Persona Mode Indicator */}
        {!collapsed && (
          <div className="mt-3.5 flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-slate-50 to-violet-50/30 border border-slate-200/80 text-[11px] font-semibold text-slate-700 shadow-2xs">
            <div className="flex items-center gap-2 truncate">
              <div className="w-5 h-5 rounded-md flex items-center justify-center bg-white border border-slate-200/70 text-violet-600 flex-shrink-0 shadow-2xs">
                {renderPersonaIcon(persona, 11)}
              </div>
              <span className="truncate">{config.badge}</span>
            </div>
            {canSwitchToPersonal && (
              <button
                type="button"
                onClick={toggleWorkPersonal}
                title="Switch Work / Personal View"
                className="p-1 rounded hover:bg-white text-slate-400 hover:text-violet-600 border border-transparent hover:border-slate-200 transition-colors cursor-pointer flex-shrink-0"
              >
                <ArrowLeftRight size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grouped Nav Links */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
        {navGroups.map((group, groupIdx) => (
          <div
            key={group.groupName || groupIdx}
            data-tour={groupIdx === 1 ? 'sidebar-operations' : undefined}
            className="space-y-1"
          >
            {!collapsed ? (
              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {group.groupName}
              </div>
            ) : (
              groupIdx > 0 && <div className="border-t border-slate-100 my-2 mx-1" />
            )}

            {group.items.map(({ to, icon: Icon, label }) => {
              const linkNode = (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={handleLinkClick}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? 'text-slate-900 bg-gradient-to-r from-violet-50/90 via-fuchsia-50/50 to-rose-50/30 border border-violet-200/70 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    } ${collapsed ? 'justify-center px-0' : ''}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId={prefersReducedMotion ? undefined : 'sidebarActivePill'}
                          transition={SPRING_SMOOTH}
                          className="absolute left-0 top-1.5 bottom-1.5 w-1.25 bg-gradient-to-b from-rose-500 via-fuchsia-600 to-violet-600 rounded-r shadow-xs shadow-fuchsia-500/50"
                        />
                      )}
                      <Icon
                        size={15}
                        className={`flex-shrink-0 transition-colors ${
                          isActive
                            ? 'text-violet-600'
                            : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      />
                      {!collapsed && <span className="truncate flex-1">{label}</span>}
                      {!collapsed && navCounts[to] ? (
                        <span
                          data-testid={`nav-count-${to.replace('/', '') || 'home'}`}
                          className="ml-auto min-w-5 text-center text-[10px] font-black font-mono tabular-nums px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200"
                          aria-label={`${navCounts[to]} items`}
                        >
                          {navCounts[to]}
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              );

              return collapsed ? (
                <Tooltip key={to} content={label} position="right">
                  {linkNode}
                </Tooltip>
              ) : (
                <React.Fragment key={to}>{linkNode}</React.Fragment>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Area: User Summary & Sign Out */}
      <div className="px-2.5 py-3 border-t border-slate-100 mt-auto space-y-2 bg-gradient-to-b from-transparent to-slate-50/60">
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-rose-500 to-violet-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs shadow-xs">
              <User size={13} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-ink-900 block truncate leading-tight">
                Bizpulse Admin
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-emerald-700 font-semibold truncate">
                  AI Ready &bull; Connected
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50/80 transition-colors cursor-pointer group ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={14} className="flex-shrink-0 text-slate-400 group-hover:text-rose-600" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Desktop Collapse Toggle Button */}
      {!isMobileDrawer && (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:flex absolute -right-3 top-5 w-6 h-6 bg-white rounded-full items-center justify-center text-slate-400 hover:text-cobalt-600 border border-slate-200 shadow-2xs hover:shadow-xs transition-all z-40 cursor-pointer"
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
        </button>
      )}
    </aside>
  );
};
