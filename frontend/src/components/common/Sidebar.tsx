import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Receipt, BarChart3, Settings,
  Zap, ChevronLeft, ChevronRight, LogOut, CreditCard,
  Building2, Laptop, Wallet, Target, TrendingUp, BrainCircuit
} from 'lucide-react';
import { authService } from '../../services/authService';
import { usePersona } from '../../context/PersonaContext';

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { persona, config } = usePersona();

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  const getLinks = () => {
    if (persona === 'personal' || persona === 'employee') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'Personal Tracker' },
        { to: '/billing', icon: Receipt, label: 'Salary & Income' },
        { to: '/expenses', icon: CreditCard, label: 'Daily Expenses' },
        { to: '/goals', icon: Target, label: 'Savings Goals' },
        { to: '/wealth', icon: TrendingUp, label: 'Net Worth' },
        { to: '/contracts', icon: FileText, label: 'Agreement Audit' },
        { to: '/decision-forge', icon: BrainCircuit, label: 'DecisionForge AI' },
        { to: '/analytics', icon: BarChart3, label: 'Savings Analytics' },
        { to: '/settings', icon: Settings, label: 'Settings & Workspace' },
      ];
    }
    if (persona === 'self_employed') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'Freelancer Hub' },
        { to: '/decision-forge', icon: BrainCircuit, label: 'DecisionForge AI' },
        { to: '/billing', icon: Receipt, label: 'Client Invoices' },
        { to: '/expenses', icon: CreditCard, label: 'Freelance Expenses' },
        { to: '/goals', icon: Target, label: 'Income Goals' },
        { to: '/wealth', icon: TrendingUp, label: 'Net Worth' },
        { to: '/contracts', icon: FileText, label: 'Contract & NDA Audit' },
        { to: '/analytics', icon: BarChart3, label: 'Runway Analytics' },
        { to: '/settings', icon: Settings, label: 'Settings & Workspace' },
      ];
    }
    return [
      { to: '/', icon: LayoutDashboard, label: 'Business Dashboard' },
      { to: '/decision-forge', icon: BrainCircuit, label: 'DecisionForge AI' },
      { to: '/billing', icon: Receipt, label: 'Invoicing & GST' },
      { to: '/expenses', icon: CreditCard, label: 'Corporate Expenses' },
      { to: '/goals', icon: Target, label: 'Business Goals' },
      { to: '/wealth', icon: TrendingUp, label: 'Net Worth' },
      { to: '/contracts', icon: FileText, label: 'Contract Intelligence' },
      { to: '/analytics', icon: BarChart3, label: 'Cash Flow Analytics' },
      { to: '/settings', icon: Settings, label: 'Settings & Workspace' },
    ];
  };


  const links = getLinks();
  const getPersonaIcon = () => {
    switch (persona) {
      case 'personal':
      case 'employee':
        return Wallet;
      case 'self_employed':
        return Laptop;
      default:
        return Building2;
    }
  };

  const PersonaIcon = getPersonaIcon();

  return (
    <aside className={`relative flex flex-col h-screen glass border-r border-slate-200/50 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
      {/* Logo & Persona Badge */}
      <div className={`flex flex-col px-4 py-4 border-b border-slate-200/50 ${collapsed ? 'items-center' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div>
              <span className="font-black text-lg gradient-text tracking-tight">Bizpulse</span>
              <span className="text-[10px] font-extrabold text-slate-400 block -mt-1 tracking-wider uppercase">Fintech Engine</span>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/70 text-[11px] font-bold text-slate-700">
            <PersonaIcon size={12} className="text-brand-600 flex-shrink-0" />
            <span className="truncate">{config.badge}</span>
          </div>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-brand-50 text-brand-600 border border-brand-100 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <Icon size={16} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-4 space-y-2 mt-auto">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 group cursor-pointer ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? "Logout" : ""}
        >
          <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-brand-600 border border-slate-200 shadow-sm hover:shadow-md transition-all z-50 cursor-pointer"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
};
