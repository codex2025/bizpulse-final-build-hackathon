import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, FileText, Activity, Plus, PlusCircle, FileCode
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Topbar } from '../common/Topbar';
import { analyticsService } from '../../services/analyticsService';
import { decisionForgeService } from '../../services/decisionForgeService';
import { invoiceService, expenseService } from '../../services/invoiceService';
import { userService } from '../../services/userService';
import { AntigravityInsights } from './AntigravityInsights';
import { ForecastWidget } from './ForecastWidget';
import { usePersona } from '../../context/PersonaContext';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const MetricCard = ({ label, value, icon: Icon, color, trend, subtext }: any) => (
  <motion.div 
    variants={itemVariants}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
    className="card relative overflow-hidden group bg-white border border-slate-200"
  >
    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-5 rounded-bl-full pointer-events-none transition-all duration-300 group-hover:scale-110 ${color}`} />
    <div className="flex items-center justify-between mb-4 relative z-10">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${color} shadow-2xs`}>
        <Icon size={20} />
      </div>
      {trend !== undefined && (
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${trend >= 0 ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' : 'text-red-600 bg-red-50 border border-red-100'}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <p className="text-3xl font-extrabold text-slate-900 mb-1 tracking-tight relative z-10">{value}</p>
    <p className="text-sm font-semibold text-slate-700 relative z-10">{label}</p>
    {subtext && <p className="text-[11px] font-medium text-slate-400 relative z-10 mt-0.5">{subtext}</p>}
  </motion.div>
);

const HealthGauge = ({ score, persona }: { score: number; persona: string }) => {
  const color = score >= 75 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626';
  const dash = (score / 100) * 251;
  const label =
    persona === 'personal' || persona === 'employee'
      ? 'Personal Budget & Health'
      : persona === 'self_employed'
      ? 'Freelance Stability Score'
      : 'Business Health Score';

  const getSubtext = () => {
    if (score >= 75) {
      return persona === 'personal' || persona === 'employee'
        ? '🟢 Outstanding Savings Cushion'
        : persona === 'self_employed'
        ? '🟢 Robust Freelance Buffer'
        : '🟢 Strong Operating Margin';
    }
    if (score >= 50) {
      return persona === 'personal' || persona === 'employee'
        ? '🟡 Balanced Spending'
        : persona === 'self_employed'
        ? '🟡 Moderate Runway Buffer'
        : '🟡 Moderate Cash Flow';
    }
    return persona === 'personal' || persona === 'employee'
      ? '🔴 Budget Deficit Risk'
      : persona === 'self_employed'
      ? '🔴 Low Freelance Cushion'
      : '🔴 Liquidity Alert';
  };

  return (
    <motion.div variants={itemVariants} className="card flex flex-col items-center justify-center relative overflow-hidden group bg-white border border-slate-200">
      <div className="flex items-center gap-1.5 mb-4">
        <p className="text-sm text-slate-700 font-bold uppercase tracking-wider">{label}</p>
      </div>

      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke={color}
            strokeWidth={8}
            strokeDasharray={251}
            strokeDashoffset={251 - dash}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-slate-900">{score}</span>
          <span className="text-[11px] font-bold text-slate-400 uppercase">/ 100</span>
        </div>
      </div>
      <p className="text-xs font-bold text-slate-600 mt-4 text-center">
        {getSubtext()}
      </p>
    </motion.div>
  );
};

const QuickAction = ({ icon: Icon, label, color, onClick }: any) => (
  <motion.button 
    variants={itemVariants}
    whileHover={{ y: -2, scale: 1.01 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="card flex items-center gap-3.5 p-4 text-left transition-all group bg-white border border-slate-200 hover:border-slate-300 shadow-xs cursor-pointer"
  >
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${color} shadow-2xs group-hover:scale-105 transition-transform flex-shrink-0`}>
      <Icon size={18} />
    </div>
    <span className="text-xs font-bold text-slate-800 group-hover:text-slate-900 transition-colors">{label}</span>
  </motion.button>
);

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { persona, config } = usePersona();

  // The greeting uses the signed-in person's own first name (it used to say "Sam" to everyone).
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: userService.getProfile, staleTime: 60_000 });
  const firstName = String(profile?.full_name || '').trim().split(/\s+/)[0];

  // Live DecisionForge counts. If the decision service is down the banner simply says so;
  // it never shows placeholder numbers.
  const { data: dfSummary, isError: dfError } = useQuery({
    queryKey: ['decision-forge-summary'],
    queryFn: () => decisionForgeService.getSummary(),
    retry: false,
    staleTime: 30_000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics', persona],
    queryFn: () => analyticsService.getDashboard(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: invoiceService.getAll,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: expenseService.getAll,
  });

  if (metricsLoading) return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full"
      />
    </div>
  );

  const recentItems = [
    ...invoices.slice(0, 3).map((i: any) => ({ ...i, type: 'invoice' })),
    ...expenses.slice(0, 3).map((e: any) => ({ ...e, type: 'expense' }))
  ].sort((a, b) => new Date(b.created_at || b.expense_date || 0).getTime() - new Date(a.created_at || a.expense_date || 0).getTime()).slice(0, 5);

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto"
    >
      <Topbar title={firstName ? `Good Day, ${firstName}` : 'Good Day'} subtitle={config.tagline} />

      {/* Metrics Row Adapted by Persona */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <MetricCard 
          label={config.inflowLabel} 
          value={fmt(metrics?.totalRevenue || 0)} 
          icon={TrendingUp} 
          color="bg-emerald-50 text-emerald-600"
          subtext={persona === 'personal' || persona === 'employee' ? 'Monthly salary credit' : 'Total cash inflow'}
        />
        <MetricCard 
          label={config.outflowLabel} 
          value={fmt(metrics?.totalExpenses || 0)} 
          icon={TrendingDown} 
          color="bg-red-50 text-red-600"
          subtext={persona === 'personal' || persona === 'employee' ? 'Rent & living expenses' : 'Operational burn'}
        />
        <MetricCard 
          label={config.surplusLabel} 
          value={fmt(metrics?.netProfit || 0)} 
          icon={DollarSign} 
          color="bg-brand-50 text-brand-600"
          subtext={persona === 'personal' || persona === 'employee' ? 'Free savings cushion' : 'Net cash surplus'}
        />
        <MetricCard 
          label={persona === 'personal' || persona === 'employee' ? 'Active Records' : persona === 'self_employed' ? 'Client Accounts' : 'Active Invoices'} 
          value={metrics?.invoiceCount || 0} 
          icon={Activity} 
          color="bg-purple-50 text-purple-600"
          subtext="Processed to date"
        />
      </div>

      {/* Forecast Widget — Month-End Projection */}
      <ForecastWidget />

      {/* DecisionForge AI Intelligence Banner */}
      <motion.div
        variants={itemVariants}
        className="p-5 rounded-2xl bg-gradient-to-r from-rose-900 via-slate-900 to-slate-900 text-white shadow-md border border-rose-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-rose-500/50 transition-all"
        onClick={() => navigate('/decision-forge')}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-600/30 border border-rose-500/40 flex items-center justify-center text-rose-400 flex-shrink-0">
            <Activity className="w-6 h-6 text-rose-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-extrabold tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full">
                DecisionForge AI Active
              </span>
              <span className="text-xs text-slate-300">B2B Deal Prioritization</span>
            </div>
            <p className="text-sm font-bold text-white mt-0.5">
              {dfError || (dfSummary && !dfSummary.hasRun)
                ? 'Decision data is temporarily unavailable.'
                : !dfSummary
                ? 'Loading decisions…'
                : dfSummary.requiresAttention
                ? `${dfSummary.requiresAttention} decision${dfSummary.requiresAttention === 1 ? '' : 's'} require attention`
                : 'No decisions need attention right now'}
            </p>
            {dfSummary?.hasRun && (
              <p className="text-xs text-slate-300 mt-0.5">
                {dfSummary.immediateActions} immediate action{dfSummary.immediateActions === 1 ? '' : 's'} ·{' '}
                {dfSummary.staleOpportunities} stale · {dfSummary.awaitingApproval} awaiting approval ·{' '}
                ${Math.round(dfSummary.pipelineTotal || 0).toLocaleString()} pipeline
                {dfSummary.datasetKey && dfSummary.datasetKey !== 'real' ? ' (synthetic data)' : ''}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate('/decision-forge');
          }}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-center flex-shrink-0 shadow-sm"
        >
          <span>Open Decision Center</span>
          <span>→</span>
        </button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Actions & Feed */}
        <div className="lg:col-span-2 space-y-8">

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            <QuickAction 
              icon={PlusCircle} 
              label={persona === 'personal' || persona === 'employee' ? 'Add Income Entry' : persona === 'self_employed' ? 'New Client Invoice' : 'New Invoice'} 
              color="bg-brand-50 text-brand-600" 
              onClick={() => navigate('/billing')} 
            />
            <QuickAction 
              icon={Plus} 
              label={persona === 'personal' || persona === 'employee' ? 'Log Expense' : persona === 'self_employed' ? 'Add Client' : 'Add Client'} 
              color="bg-amber-50 text-amber-600" 
              onClick={() => navigate(persona === 'personal' || persona === 'employee' ? '/expenses' : '/billing')} 
            />
            <QuickAction 
              icon={FileCode} 
              label={persona === 'personal' || persona === 'employee' ? 'Analyze Loan / Offer' : 'Analyze Agreement'} 
              color="bg-purple-50 text-purple-600" 
              onClick={() => navigate('/contracts')} 
            />
          </div>

          <motion.div variants={itemVariants} className="card bg-white border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-brand-600" />
                <h3 className="font-extrabold text-base text-slate-900">Recent Financial Ledger Feed</h3>
              </div>
              <button 
                onClick={() => navigate('/billing')}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors"
              >
                View full ledger →
              </button>
            </div>

            <div className="space-y-3">
              <AnimatePresence>
                {recentItems.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-4 text-center">No recent records yet.</p>
                ) : (
                  recentItems.map((item: any, i: number) => {
                    const isInv = item.type === 'invoice';
                    const title = isInv 
                      ? (item.client_name || `Invoice #${item.invoice_number || i + 1}`) 
                      : (item.vendor_or_payee || item.description || 'Expense Entry');
                    const subtitle = isInv
                      ? (item.status ? `Status: ${item.status.toUpperCase()}` : 'Receivable')
                      : (item.category || 'Disbursement');
                    const amount = isInv ? item.total_amount : item.amount;
                    const date = item.created_at || item.expense_date;

                    return (
                      <motion.div 
                        key={item.id || i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/60 border border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isInv ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                          }`}>
                            {isInv ? '+' : '−'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{title}</p>
                            <p className="text-[11px] text-slate-400 font-medium">{subtitle} • {date ? new Date(date).toLocaleDateString() : 'Recent'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-black ${isInv ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {isInv ? '+' : '−'}{fmt(amount || 0)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Right Column: AI Insights & Health Gauge */}
        <div className="space-y-8">
          <HealthGauge score={metrics?.financialHealthScore || 78} persona={persona} />
          <AntigravityInsights metrics={metrics} />
        </div>
      </div>
    </motion.div>
  );
};
