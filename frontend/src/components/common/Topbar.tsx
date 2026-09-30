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
  Compass,
} from 'lucide-react';
import { useLayout } from '../../context/useLayout';
import { usePersona, type AccountPersonaType } from '../../context/PersonaContext';
import { useTour } from '../../context/TourContext';
import { authService } from '../../services/authService';
import { dropdownVariants } from '../../utils/motion';
import { CommandPalette } from './CommandPalette';
import { ServiceHealthPill } from './ServiceHealthPill';

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
  '/': { title: 'Dashboard', subtitle: 'Financial overview' },
  '/decision-forge': { title: 'DecisionForge', subtitle: 'AI-powered decisions' },
  '/billing': { title: 'Invoicing', subtitle: 'Billing & receivables' },
  '/expenses': { title: 'Expenses', subtitle: 'Outflow tracking' },
  '/contracts': { title: 'Contracts', subtitle: 'Clause & covenant audit' },
  '/analytics': { title: 'Analytics', subtitle: 'Financial insights' },
  '/goals': { title: 'Goals', subtitle: 'Financial targets' },
  '/wealth': { title: 'Net Worth', subtitle: 'Assets & balance sheet' },
  '/settings': { title: 'Settings', subtitle: 'Workspace preferences' },
};

export const Topbar: React.FC<TopbarProps> = ({ title, subtitle, action }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleMobileMenu } = useLayout();
  const { persona, config, accountPersona, setAccountMode, canSwitchToPersonal, toggleWorkPersonal } =
    usePersona();
  const { startTour } = useTour();

  const [personaOpen, setPersonaOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const personaRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const currentRouteMeta = routeTitleMap[location.pathname] || {
    title: 'Bizpulse',
    subtitle: 'Financial workspace',
  };

  const displayTitle = title || currentRouteMeta.title;
  const displaySubtitle = subtitle || currentRouteMeta.subtitle;

  // Ctrl/Cmd+K opens the command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (personaRef.current && !personaRef.current.contains(target)) setPersonaOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
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
      label: 'Business Owner',
      desc: 'Company cashflow, GST billing, and credit intelligence',
    },
    {
      type: 'self_employed',
      label: 'Freelancer',
      desc: 'Client retainers, milestone invoicing, and runway',
    },
    {
      type: 'personal',
      label: 'Personal',
      desc: 'Salary tracking, household expenses, and savings',
    },
  ];

  const notifications = [
    {
      id: '1',
      title: 'Overdue Invoice #INV-103',
      desc: 'Acme Corp ($12,500) exceeded 30-day payment term.',
      time: '15m ago',
      type: 'danger',
      link: '/billing',
    },
    {
      id: '2',
      title: 'Contract Covenant Flagged',
      desc: 'Late fee penalty (4.5%) in Master Service Agreement.',
      time: '1h ago',
      type: 'warning',
      link: '/contracts',
    },
    {
      id: '3',
      title: 'DecisionForge Insight',
      desc: '$45k working capital buffer recommended.',
      time: '3h ago',
      type: 'primary',
      link: '/decision-forge',
    },
  ];

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200/80 bg-white/98 backdrop-blur-sm select-none">
      {/* Left: Mobile menu + Page title */}
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
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-sm font-bold text-ink-900 tracking-tight truncate">
              {displayTitle}
            </h1>
            {displaySubtitle && (
              <span className="text-xs text-slate-400 font-normal truncate hidden sm:inline">
                · {displaySubtitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {action && <div className="hidden sm:flex items-center">{action}</div>}

        <ServiceHealthPill />

        {/* Command palette trigger (Ctrl/Cmd+K) */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open search (Ctrl+K)"
          className="hidden md:flex items-center gap-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg pl-2.5 pr-2 py-1.5 text-xs text-slate-400 font-medium w-40 transition-colors cursor-pointer"
        >
          <Search size={13} />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="text-[10px] font-mono text-slate-400 bg-white px-1 py-0.5 rounded border border-slate-200">Ctrl K</kbd>
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open search"
          className="md:hidden w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
        >
          <Search size={14} />
        </button>

        {/* Persona Mode Switcher */}
        <div className="relative" ref={personaRef}>
          <button
            type="button"
            onClick={() => setPersonaOpen(!personaOpen)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer text-xs font-medium text-slate-600"
            title="Switch persona"
          >
            {renderPersonaIcon(persona, 12)}
            <span className="hidden lg:inline truncate max-w-[90px]">{config.badge}</span>
            <ChevronDown
              size={11}
              className={`text-slate-400 transition-transform ${personaOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {personaOpen && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden p-1.5 z-50"
              >
                <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Financial Mode
                  </span>
                </div>

                <div className="space-y-0.5">
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
                        className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected ? 'bg-cobalt-50 text-cobalt-700' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex-shrink-0">{renderPersonaIcon(opt.type, 13)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold flex items-center justify-between">
                            <span>{opt.label}</span>
                            {isSelected && <Check size={11} className="text-cobalt-600" />}
                          </p>
                          <p className="text-[10.5px] text-slate-400 leading-tight mt-0.5 truncate">
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
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <ArrowLeftRight size={11} className="text-cobalt-600" />
                      <span>Toggle Work / Personal</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label="Notifications"
            className="relative w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-ink-900 transition-colors cursor-pointer"
          >
            <Bell size={14} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-cobalt-500 rounded-full ring-1 ring-white" />
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-50"
              >
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100">
                  <span className="text-xs font-bold text-ink-900">Notifications</span>
                  <span className="text-[10px] font-semibold text-cobalt-600 bg-cobalt-50 px-1.5 py-0.5 rounded border border-cobalt-100">
                    3 new
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {notifications.map((item) => (
                    <Link
                      key={item.id}
                      to={item.link}
                      onClick={() => setNotifOpen(false)}
                      className="block p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex-shrink-0">
                          {item.type === 'danger' ? (
                            <AlertTriangle size={12} className="text-vermilion-500" />
                          ) : item.type === 'warning' ? (
                            <Clock size={12} className="text-amber-500" />
                          ) : (
                            <FileText size={12} className="text-cobalt-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-ink-900 truncate">{item.title}</p>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
                            {item.desc}
                          </p>
                          <span className="text-[10px] text-slate-400 block mt-1">{item.time}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="p-2 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="text-[11px] font-medium text-slate-500 hover:text-ink-900 transition-colors cursor-pointer"
                  >
                    Mark all read
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
            className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
            aria-label="User menu"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-500 to-cobalt-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
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
                className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden p-1.5 z-50"
              >
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-bold text-ink-900 truncate">Bizpulse Admin</p>
                  <p className="text-[10.5px] text-slate-400 truncate">admin@bizpulse.com</p>
                </div>

                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <SettingsIcon size={12} className="text-slate-400" />
                    <span>Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); startTour(); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition-colors cursor-pointer"
                  >
                    <Compass size={12} className="text-violet-500" />
                    <span>Product Tour</span>
                  </button>
                </div>

                <div className="pt-1 mt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-vermilion-600 hover:bg-vermilion-50/80 transition-colors cursor-pointer"
                  >
                    <LogOut size={12} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
};
