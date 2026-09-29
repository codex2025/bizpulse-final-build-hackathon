import React from 'react';
import { NavLink } from 'react-router-dom';
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
      className={`relative flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-200 select-none z-30 ${
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
            <div className="w-8 h-8 bg-cobalt-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs">
              <Zap size={15} className="text-white fill-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="font-extrabold text-[15px] text-ink-900 tracking-tight block leading-snug">
                  Bizpulse
                </span>
                <span className="text-[9.5px] font-bold text-slate-400 block -mt-0.5 tracking-wider uppercase">
                  Financial Engine
                </span>
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
          <div className="mt-3.5 flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-semibold text-slate-700">
            <div className="flex items-center gap-2 truncate">
              <div className="w-5 h-5 rounded flex items-center justify-center bg-white border border-slate-200/70 text-cobalt-600 flex-shrink-0 shadow-2xs">
                {renderPersonaIcon(persona, 11)}
              </div>
              <span className="truncate">{config.badge}</span>
            </div>
            {canSwitchToPersonal && (
              <button
                type="button"
                onClick={toggleWorkPersonal}
                title="Switch Work / Personal View"
                className="p-1 rounded hover:bg-white text-slate-400 hover:text-cobalt-600 border border-transparent hover:border-slate-200 transition-colors cursor-pointer flex-shrink-0"
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
          <div key={group.groupName || groupIdx} className="space-y-1">
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
                    `relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? 'text-cobalt-600 bg-cobalt-50/70'
                        : 'text-slate-600 hover:text-ink-900 hover:bg-slate-50'
                    } ${collapsed ? 'justify-center px-0' : ''}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId={prefersReducedMotion ? undefined : 'sidebarActivePill'}
                          transition={SPRING_SMOOTH}
                          className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-cobalt-500 rounded-r"
                        />
                      )}
                      <Icon
                        size={15}
                        className={`flex-shrink-0 transition-colors ${
                          isActive ? 'text-cobalt-600' : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      />
                      {!collapsed && <span className="truncate">{label}</span>}
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
      <div className="px-2.5 py-3 border-t border-slate-100 mt-auto space-y-2 bg-slate-50/50">
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-white border border-slate-200/80">
            <div className="w-7 h-7 rounded-md bg-cobalt-50 border border-cobalt-100 text-cobalt-600 flex items-center justify-center flex-shrink-0 font-bold text-xs">
              <User size={13} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-ink-900 block truncate leading-tight">
                Bizpulse User
              </span>
              <span className="text-[10px] text-slate-400 block truncate font-medium">
                Verified Account
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-vermilion-600 hover:bg-vermilion-50/80 transition-colors cursor-pointer group ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={14} className="flex-shrink-0 text-slate-400 group-hover:text-vermilion-600" />
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
