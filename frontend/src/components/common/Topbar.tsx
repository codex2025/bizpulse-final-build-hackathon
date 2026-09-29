import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Search,
  Menu,
  ArrowLeftRight,
  Building2,
  Laptop,
  Wallet,
  Check,
  ChevronDown,
  Settings as SettingsIcon,
  LogOut,
  AlertTriangle,
  FileText,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { useLayout } from '../../context/useLayout';
import { usePersona, type AccountPersonaType } from '../../context/PersonaContext';
import { authService } from '../../services/authService';
import { dropdownVariants } from '../../utils/motion';

interface TopbarProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const renderPersonaIcon = (personaType: string, size = 12) => {
  switch (personaType) {
    case 'personal':
    case 'employee':
      return <Wallet size={size} className="text-cobalt-600 flex-shrink-0" />;
    case 'self_employed':
      return <Laptop size={size} className="text-cobalt-600 flex-shrink-0" />;
    default:
      return <Building2 size={size} className="text-cobalt-600 flex-shrink-0" />;
  }
};

const routeTitleMap: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Financial Overview', subtitle: 'Real-time performance and financial intelligence' },
  '/decision-forge': { title: 'DecisionForge AI', subtitle: 'Automated policy engine and risk-aware trade-off simulations' },
  '/billing': { title: 'Invoicing & Receivables', subtitle: 'Commercial client billing, invoice generation, and GST logs' },
  '/expenses': { title: 'Cash Outflow & Expenses', subtitle: 'Operational burn rate and business expense tracking' },
  '/contracts': { title: 'Contract Intelligence', subtitle: 'Automated legal clause analysis and covenant risk audit' },
  '/analytics': { title: 'Financial Analytics', subtitle: 'Cash flow velocity, runway health, and variance projections' },
  '/goals': { title: 'Financial Goals', subtitle: 'Target savings and commercial milestones tracking' },
  '/wealth': { title: 'Net Worth & Assets', subtitle: 'Consolidated balance sheet and asset-liability breakdown' },
  '/settings': { title: 'Workspace Settings', subtitle: 'Manage organization preferences and persona configuration' },
};

export const Topbar: React.FC<TopbarProps> = ({ title, subtitle, action }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleMobileMenu } = useLayout();
  const { persona, config, accountPersona, setAccountMode, canSwitchToPersonal, toggleWorkPersonal } =
    usePersona();

  // Dropdown states
  const [personaOpen, setPersonaOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const personaRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Active route title fallback
  const currentRouteMeta = routeTitleMap[location.pathname] || {
    title: 'Financial Workspace',
    subtitle: 'Bizpulse Intelligent Financial System',
  };

  const displayTitle = title || currentRouteMeta.title;
  const displaySubtitle = subtitle || currentRouteMeta.subtitle;

  // Keyboard shortcut Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside listener for all dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (personaRef.current && !personaRef.current.contains(target)) {
        setPersonaOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  const personaOptions: { type: AccountPersonaType; label: string; desc: string }[] = [
    {
      type: 'business',
      label: 'Business Owner / SME',
      desc: 'Company cashflow, GST billing, and credit intelligence',
    },
    {
      type: 'self_employed',
      label: 'Freelancer / Self-Employed',
      desc: 'Client retainers, milestone invoicing, and runway buffer',
    },
    {
      type: 'personal',
      label: 'Personal & Household',
      desc: 'Salary tracking, household expenses, and savings goals',
    },
  ];

  const notifications = [
    {
      id: '1',
      title: 'Overdue Invoice #INV-103',
      desc: 'Acme Corp ($12,500) has exceeded the 30-day payment term.',
      time: '15m ago',
      type: 'danger',
      link: '/billing',
    },
    {
      id: '2',
      title: 'Contract Covenant Flagged',
      desc: 'Late fee interest penalty (4.5%) identified in Master Service Agreement.',
      time: '1h ago',
      type: 'warning',
      link: '/contracts',
    },
    {
      id: '3',
      title: 'DecisionForge Recommendation',
      desc: 'AI simulated $45k working capital buffer; 2 action items pending approval.',
      time: '3h ago',
      type: 'primary',
      link: '/decision-forge',
    },
  ];

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b border-slate-200 bg-white/95 backdrop-blur-xs select-none">
      {/* Left: Mobile Menu Trigger + Breadcrumb / Title Hierarchy */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-ink-900 hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-0.5">
            <Link to="/" className="hover:text-slate-600 transition-colors">
              Bizpulse
            </Link>
            <span>/</span>
            <span className="text-slate-600 truncate">{displayTitle}</span>
          </div>

          <h1 className="text-base sm:text-lg font-bold text-ink-900 tracking-tight truncate leading-tight">
            {displayTitle}
          </h1>
          {displaySubtitle && (
            <p className="text-xs text-slate-500 font-medium truncate hidden sm:block mt-0.5">
              {displaySubtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions, Search, Persona Switcher, Notifications, User Menu */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
        {action && <div className="hidden sm:flex items-center">{action}</div>}

        {/* Global Search Bar */}
        <div className="relative hidden md:block">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records, contracts, invoices..."
            className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-12 py-1.5 text-xs text-ink-900 placeholder-slate-400 focus:outline-none focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-500/15 w-44 lg:w-60 transition-all focus:bg-white font-medium"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
            ⌘K
          </kbd>
        </div>

        {/* Persona Mode Switcher Dropdown */}
        <div className="relative" ref={personaRef}>
          <button
            type="button"
            onClick={() => setPersonaOpen(!personaOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer text-xs font-semibold text-slate-700"
          >
            {renderPersonaIcon(persona, 12)}
            <span className="truncate hidden sm:inline max-w-[130px]">{config.badge}</span>
            <ChevronDown
              size={12}
              className={`text-slate-400 transition-transform ${personaOpen ? 'rotate-180 text-cobalt-600' : ''}`}
            />
          </button>

          <AnimatePresence>
            {personaOpen && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute right-0 mt-1.5 w-72 bg-white rounded-lg border border-slate-200 shadow-dropdown overflow-hidden p-1.5 z-50"
              >
                <div className="px-2.5 py-1.5 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Financial Mode
                  </span>
                  <p className="text-xs font-semibold text-ink-900 mt-0.5">Switch Operational View</p>
                </div>

                <div className="py-1 space-y-0.5">
                  {personaOptions.map((opt) => {
                    const isSelected = accountPersona === opt.type;
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => {
                          setAccountMode(opt.type);
                          setPersonaOpen(false);
                        }}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-md text-left transition-colors cursor-pointer ${
                          isSelected ? 'bg-cobalt-50 text-cobalt-700' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {renderPersonaIcon(opt.type, 13)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold flex items-center justify-between">
                            <span>{opt.label}</span>
                            {isSelected && <Check size={12} className="text-cobalt-600" />}
                          </p>
                          <p className="text-[10.5px] text-slate-400 leading-tight mt-0.5">
                            {opt.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {canSwitchToPersonal && (
                  <div className="pt-1.5 mt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        toggleWorkPersonal();
                        setPersonaOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <ArrowLeftRight size={12} className="text-cobalt-600" />
                        Toggle Work / Personal View
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        Active: {persona}
                      </span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notification Bell with Interactive Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label="View notifications"
            className="relative w-8 h-8 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-ink-900 transition-colors shadow-2xs cursor-pointer"
          >
            <Bell size={14} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-cobalt-500 rounded-full ring-2 ring-white" />
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute right-0 mt-1.5 w-80 bg-white rounded-lg border border-slate-200 shadow-dropdown overflow-hidden z-50"
              >
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-xs font-bold text-ink-900">Notifications</span>
                  <span className="text-[10px] font-semibold text-cobalt-600 bg-cobalt-50 px-1.5 py-0.2 rounded border border-cobalt-100">
                    3 New
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {notifications.map((item) => (
                    <Link
                      key={item.id}
                      to={item.link}
                      onClick={() => setNotifOpen(false)}
                      className="block p-3 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex-shrink-0">
                          {item.type === 'danger' ? (
                            <AlertTriangle size={13} className="text-vermilion-500" />
                          ) : item.type === 'warning' ? (
                            <Clock size={13} className="text-amber-500" />
                          ) : (
                            <FileText size={13} className="text-cobalt-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-ink-900 group-hover:text-cobalt-600 transition-colors truncate">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
                            {item.desc}
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium block mt-1">
                            {item.time}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="p-2 border-t border-slate-100 bg-slate-50/50 text-center">
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-ink-900 transition-colors cursor-pointer"
                  >
                    Mark all as read
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
            aria-label="User profile menu"
          >
            <div className="w-7 h-7 rounded-md bg-cobalt-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              S
            </div>
            <ChevronDown size={11} className="text-slate-400 hidden sm:block" />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute right-0 mt-1.5 w-56 bg-white rounded-lg border border-slate-200 shadow-dropdown overflow-hidden p-1.5 z-50"
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-ink-900 truncate">Sam (Bizpulse Admin)</p>
                  <p className="text-[10.5px] text-slate-400 truncate">admin@bizpulse.com</p>
                </div>

                <div className="py-1 space-y-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-slate-700 hover:bg-slate-50 hover:text-ink-900 transition-colors cursor-pointer"
                  >
                    <SettingsIcon size={13} className="text-slate-400" />
                    <span>Workspace Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/decision-forge');
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-slate-700 hover:bg-slate-50 hover:text-ink-900 transition-colors cursor-pointer"
                  >
                    <ExternalLink size={13} className="text-slate-400" />
                    <span>DecisionForge AI</span>
                  </button>
                </div>

                <div className="pt-1 mt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-vermilion-600 hover:bg-vermilion-50/80 transition-colors cursor-pointer"
                  >
                    <LogOut size={13} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
