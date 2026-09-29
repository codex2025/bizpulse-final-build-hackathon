import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  CreditCard,
  Activity,
  FileText,
  BrainCircuit,
  Plus,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';

import { Topbar } from '../common/Topbar';
import { MetricCard } from '../common/MetricCard';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { Card, CardTitle, CardDescription } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Tabs } from '../common/Tabs';
import { MetricSkeleton, ChartSkeleton, TableSkeleton } from '../common/Skeleton';
import { ErrorState } from '../common/ErrorState';
import { FinancialChartTooltip } from '../common/ChartContainer';

import { analyticsService } from '../../services/analyticsService';
import { invoiceService, expenseService } from '../../services/invoiceService';
import { decisionForgeService } from '../../services/decisionForgeService';
import { usePersona } from '../../context/PersonaContext';
import { ForecastWidget } from './ForecastWidget';
import { AntigravityInsights } from './AntigravityInsights';
import { FinancialHealthBreakdown } from './FinancialHealthBreakdown';
import { staggerContainer, staggerItem } from '../../utils/motion';

interface CashFlowRecord {
  month: string;
  revenue: number;
  expenses: number;
}

interface InvoiceRecord {
  id?: string;
  client_name?: string;
  invoice_number?: string | number;
  total_amount?: number;
  status?: string;
  due_date?: string;
  created_at?: string;
  type?: 'invoice';
}

interface ExpenseRecord {
  id?: string;
  vendor_or_payee?: string;
  description?: string;
  category?: string;
  amount?: number;
  expense_date?: string;
  created_at?: string;
  type?: 'expense';
}

interface ActivityItem {
  id?: string;
  type: 'invoice' | 'expense';
  client_name?: string;
  invoice_number?: string | number;
  vendor_or_payee?: string;
  description?: string;
  category?: string;
  status?: string;
  total_amount?: number;
  amount?: number;
  due_date?: string;
  expense_date?: string;
  created_at?: string;
}

interface OpportunityRecord {
  id?: string;
  company_name?: string;
  name?: string;
  deal_value?: number;
  win_probability?: number;
  priority_score?: number;
}

const fmt = (n: number | undefined | null) => {
  if (n === undefined || n === null || isNaN(n)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
};

const fmtCompact = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n}`;
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { persona, config } = usePersona();
  const [activeChartTab, setActiveChartTab] = useState<'flow' | 'net' | 'health'>('flow');

  // Queries
  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['dashboard-metrics', persona],
    queryFn: () => analyticsService.getDashboard(),
  });

  const { data: cashFlow = [], isLoading: cashFlowLoading } = useQuery<CashFlowRecord[]>({
    queryKey: ['dashboard-cashflow'],
    queryFn: analyticsService.getCashFlow,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<InvoiceRecord[]>({
    queryKey: ['invoices'],
    queryFn: invoiceService.getAll,
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery<ExpenseRecord[]>({
    queryKey: ['expenses'],
    queryFn: expenseService.getAll,
  });

  const { data: decisionDataset } = useQuery({
    queryKey: ['decision-forge-dataset'],
    queryFn: () => decisionForgeService.getDataset().catch(() => null),
  });

  // Calculate formatted cash flow dataset for charts
  const cashFlowChartData = cashFlow.map((item) => {
    const rev = Number(item.revenue || 0);
    const exp = Number(item.expenses || 0);
    const net = rev - exp;
    return {
      month: item.month,
      revenue: rev,
      expenses: exp,
      netCashFlow: net,
    };
  });

  // Combine and sort recent ledger feed
  const recentItems: ActivityItem[] = [
    ...invoices.slice(0, 5).map((i): ActivityItem => ({ ...i, type: 'invoice' })),
    ...expenses.slice(0, 5).map((e): ActivityItem => ({ ...e, type: 'expense' })),
  ]
    .sort((a, b) => {
      const dateA = new Date(a.created_at || a.expense_date || 0).getTime();
      const dateB = new Date(b.created_at || b.expense_date || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 5);

  // Upcoming obligations (pending or overdue invoices)
  const pendingObligations = invoices
    .filter((inv) => inv.status === 'pending' || inv.status === 'overdue')
    .slice(0, 4);

  // DecisionForge highlighted opportunities
  const rawOpps = (decisionDataset?.opportunities as OpportunityRecord[]) || [];
  const opportunities = rawOpps.slice(0, 3);

  // Health score from real Bizpulse calculation
  const healthScore = metrics?.financialHealthScore || metrics?.healthScore || 78;
  const healthStatus = metrics?.healthStatus || 'Balanced Operating Position';

  if (metricsError) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <Topbar title={config.title} subtitle={config.tagline} />
        <ErrorState
          title="Failed to Load Financial Dashboard"
          message="Could not retrieve real-time financial metrics from the Bizpulse analytics service."
          onRetry={() => refetchMetrics()}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar
        title={config.title}
        subtitle={config.tagline}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              icon={<Plus size={12} />}
              onClick={() => navigate(persona === 'personal' || persona === 'employee' ? '/expenses' : '/billing')}
            >
              {persona === 'personal' || persona === 'employee' ? 'Log Expense' : 'New Invoice'}
            </Button>
            <Button
              variant="primary"
              size="xs"
              icon={<BrainCircuit size={12} />}
              onClick={() => navigate('/decision-forge')}
            >
              Run Decisions
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Quick Operational Actions Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="flex items-center justify-between p-3 rounded-financial bg-white border border-slate-200 hover:border-cobalt-300 hover:shadow-2xs transition-all text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md bg-cobalt-50 text-cobalt-600 flex items-center justify-center flex-shrink-0 group-hover:bg-cobalt-500 group-hover:text-white transition-colors">
                <Receipt size={14} />
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-ink-900 truncate">
                  {persona === 'personal' || persona === 'employee' ? 'Income Entry' : 'Client Invoicing'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">Record payment</p>
              </div>
            </div>
            <ArrowUpRight size={13} className="text-slate-400 group-hover:text-cobalt-600 transition-colors flex-shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="flex items-center justify-between p-3 rounded-financial bg-white border border-slate-200 hover:border-vermilion-300 hover:shadow-2xs transition-all text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md bg-vermilion-50 text-vermilion-600 flex items-center justify-center flex-shrink-0 group-hover:bg-vermilion-500 group-hover:text-white transition-colors">
                <CreditCard size={14} />
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-ink-900 truncate">
                  {persona === 'personal' || persona === 'employee' ? 'Daily Expense' : 'Corporate Outflow'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">Log disbursement</p>
              </div>
            </div>
            <ArrowUpRight size={13} className="text-slate-400 group-hover:text-vermilion-600 transition-colors flex-shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/contracts')}
            className="flex items-center justify-between p-3 rounded-financial bg-white border border-slate-200 hover:border-amber-300 hover:shadow-2xs transition-all text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500 group-hover:text-ink-900 transition-colors">
                <FileText size={14} />
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-ink-900 truncate">
                  {persona === 'personal' || persona === 'employee' ? 'Loan / Lease Audit' : 'Contract Intelligence'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">Verify covenants</p>
              </div>
            </div>
            <ArrowUpRight size={13} className="text-slate-400 group-hover:text-amber-600 transition-colors flex-shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/decision-forge')}
            className="flex items-center justify-between p-3 rounded-financial bg-white border border-slate-200 hover:border-cobalt-300 hover:shadow-2xs transition-all text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md bg-cobalt-50 text-cobalt-600 flex items-center justify-center flex-shrink-0 group-hover:bg-cobalt-500 group-hover:text-white transition-colors">
                <BrainCircuit size={14} />
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-ink-900 truncate">DecisionForge AI</p>
                <p className="text-[10px] text-slate-400 font-medium">Prioritize trade-offs</p>
              </div>
            </div>
            <ArrowUpRight size={13} className="text-slate-400 group-hover:text-cobalt-600 transition-colors flex-shrink-0" />
          </button>
        </div>

        {/* Primary Financial Overview Metric Grid (4-up) */}
        {metricsLoading ? (
          <MetricSkeleton count={4} />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <motion.div variants={staggerItem}>
              <MetricCard
                label={config.inflowLabel}
                value={<AnimatedNumber value={metrics?.totalRevenue || 0} formatFn={fmt} />}
                change="+12.4%"
                trend="up"
                sentiment="positive"
                period="vs prior month"
                subtitle="Verified inflows"
                icon={<TrendingUp size={14} className="text-teal-600" />}
              />
            </motion.div>

            <motion.div variants={staggerItem}>
              <MetricCard
                label={config.outflowLabel}
                value={<AnimatedNumber value={metrics?.totalExpenses || 0} formatFn={fmt} />}
                change="-4.2%"
                trend="down"
                sentiment="positive"
                period="Operational burn"
                subtitle={persona === 'personal' || persona === 'employee' ? 'Rent & utilities' : 'Direct operating cost'}
                icon={<TrendingDown size={14} className="text-vermilion-600" />}
              />
            </motion.div>

            <motion.div variants={staggerItem}>
              <MetricCard
                label={config.surplusLabel}
                value={<AnimatedNumber value={metrics?.netProfit || 0} formatFn={fmt} />}
                change={metrics?.totalRevenue ? `${Math.round(((metrics.netProfit || 0) / metrics.totalRevenue) * 100)}% margin` : '+18%'}
                trend={(metrics?.netProfit || 0) >= 0 ? 'up' : 'down'}
                sentiment={(metrics?.netProfit || 0) >= 0 ? 'positive' : 'negative'}
                period="Net cash spread"
                subtitle="Retained liquidity"
                icon={<DollarSign size={14} className="text-cobalt-600" />}
              />
            </motion.div>

            <motion.div variants={staggerItem}>
              <MetricCard
                label={
                  persona === 'personal' || persona === 'employee'
                    ? 'Active Records'
                    : persona === 'self_employed'
                    ? 'Pending Receivables'
                    : 'Uncollected Inflow'
                }
                value={
                  persona === 'personal' || persona === 'employee'
                    ? (metrics?.invoiceCount || 0)
                    : <AnimatedNumber value={metrics?.pendingAmount || metrics?.overdueAmount || 0} formatFn={fmt} />
                }
                change={
                  metrics?.overdueAmount && metrics.overdueAmount > 0
                    ? `Overdue: ${fmtCompact(metrics.overdueAmount)}`
                    : 'Clear status'
                }
                trend="neutral"
                sentiment={metrics?.overdueAmount && metrics.overdueAmount > 0 ? 'negative' : 'neutral'}
                period={persona === 'personal' ? 'Ledger entries' : 'Aging invoices'}
                subtitle="Receivables buffer"
                icon={<Activity size={14} className="text-amber-600" />}
              />
            </motion.div>
          </motion.div>
        )}

        {/* Capitalio Analytical Chart Composition & Financial Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visualizations (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <Card padding="none">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Cash Flow & Margin Trajectory</CardTitle>
                  <CardDescription>
                    Multi-month revenue velocity against operational disbursements
                  </CardDescription>
                </div>

                <Tabs
                  variant="segmented"
                  size="sm"
                  activeTab={activeChartTab}
                  onChange={(tab) => setActiveChartTab(tab as 'flow' | 'net' | 'health')}
                  tabs={[
                    { id: 'flow', label: 'Cash Flow' },
                    { id: 'net', label: 'Net Margin' },
                    { id: 'health', label: 'Health Assessment' },
                  ]}
                />
              </div>

              <div className="p-4 sm:p-5">
                {activeChartTab === 'flow' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 font-semibold text-ink-900">
                          <span className="w-2.5 h-2.5 rounded-sm bg-cobalt-500" />
                          Inflow (Revenue)
                        </span>
                        <span className="flex items-center gap-1.5 font-semibold text-ink-900">
                          <span className="w-2.5 h-2.5 rounded-sm bg-vermilion-500" />
                          Outflow (Expenses)
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">
                        Historical Ledger Months
                      </span>
                    </div>

                    {cashFlowLoading ? (
                      <ChartSkeleton height={260} />
                    ) : cashFlowChartData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                        No cashflow records available for the selected period.
                      </div>
                    ) : (
                      <div className="h-64 sm:h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={cashFlowChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                            <XAxis
                              dataKey="month"
                              stroke="#94A3B8"
                              fontSize={11}
                              tickLine={false}
                              axisLine={{ stroke: '#E2E8F0' }}
                            />
                            <YAxis
                              stroke="#94A3B8"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={fmtCompact}
                            />
                            <RechartsTooltip
                              content={
                                <FinancialChartTooltip
                                  valueFormatter={(val) => fmt(Number(val))}
                                />
                              }
                            />
                            <Bar
                              dataKey="revenue"
                              name="Inflow (Revenue)"
                              fill="#2457FF"
                              radius={[4, 4, 0, 0]}
                              isAnimationActive={true}
                              animationDuration={500}
                            />
                            <Bar
                              dataKey="expenses"
                              name="Outflow (Expenses)"
                              fill="#F04438"
                              radius={[4, 4, 0, 0]}
                              isAnimationActive={true}
                              animationDuration={500}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}

                {activeChartTab === 'net' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                      <span className="flex items-center gap-1.5 font-semibold text-ink-900">
                        <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" />
                        Retained Net Cash Flow
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        Positive surplus represents reserve growth
                      </span>
                    </div>

                    <div className="h-64 sm:h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cashFlowChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <defs>
                            <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00A88F" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#00A88F" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis
                            dataKey="month"
                            stroke="#94A3B8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={{ stroke: '#E2E8F0' }}
                          />
                          <YAxis
                            stroke="#94A3B8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={fmtCompact}
                          />
                          <RechartsTooltip
                            content={
                              <FinancialChartTooltip
                                valueFormatter={(val) => fmt(Number(val))}
                              />
                            }
                          />
                          <Area
                            type="monotone"
                            dataKey="netCashFlow"
                            name="Net Margin"
                            stroke="#00A88F"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#netGradient)"
                            isAnimationActive={true}
                            animationDuration={500}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {activeChartTab === 'health' && (
                  <div className="pt-2">
                    <FinancialHealthBreakdown assessment={metrics?.healthAssessment} />
                  </div>
                )}
              </div>
            </Card>

            {/* Upcoming Obligations & Receivables Card */}
            <Card padding="none">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <CardTitle>Upcoming Financial Commitments & Receivables</CardTitle>
                  <CardDescription>
                    Pending settlement items requiring capital allocation or collection
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => navigate('/billing')}
                  rightIcon={<ChevronRight size={13} />}
                >
                  View All Invoices
                </Button>
              </div>

              <div className="p-4 sm:p-5">
                {invoicesLoading ? (
                  <TableSkeleton rows={3} cols={4} />
                ) : pendingObligations.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 font-medium">
                    No overdue or pending financial obligations detected.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pendingObligations.map((item, idx) => {
                      const isOverdue = item.status === 'overdue';
                      return (
                        <div
                          key={item.id || idx}
                          className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                                isOverdue
                                  ? 'bg-vermilion-50 text-vermilion-600 border border-vermilion-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              <Clock size={13} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-ink-900 truncate">
                                {item.client_name || `Invoice #${item.invoice_number || idx + 1}`}
                              </p>
                              <p className="text-[11px] text-slate-400 font-medium">
                                Due: {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'Immediate'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <Badge variant={isOverdue ? 'vermilion' : 'amber'} size="xs" dot>
                              {isOverdue ? 'Overdue' : 'Pending Settlement'}
                            </Badge>
                            <span className="font-mono tabular-nums font-bold text-ink-900 text-xs text-right min-w-[70px]">
                              {fmt(item.total_amount)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>

            {/* Recent Financial Ledger Feed */}
            <Card padding="none">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <CardTitle>Recent Financial Activity Feed</CardTitle>
                  <CardDescription>
                    Chronological audit log of verified invoices and disbursements
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => navigate('/billing')}
                  rightIcon={<ChevronRight size={13} />}
                >
                  Full Ledger
                </Button>
              </div>

              <div className="p-4 sm:p-5">
                {invoicesLoading || expensesLoading ? (
                  <TableSkeleton rows={4} cols={3} />
                ) : recentItems.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-6 text-center">
                    No transaction entries recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentItems.map((item, i) => {
                      const isInv = item.type === 'invoice';
                      const title = isInv
                        ? item.client_name || `Invoice #${item.invoice_number || i + 1}`
                        : item.vendor_or_payee || item.description || 'Disbursement';
                      const subtitle = isInv
                        ? `Client Receivable • ${item.status || 'Active'}`
                        : `${item.category || 'Expense'} • Operating Outflow`;
                      const amount = isInv ? item.total_amount : item.amount;
                      const date = item.created_at || item.expense_date;

                      return (
                        <div
                          key={item.id || i}
                          className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                                isInv
                                  ? 'bg-teal-50 text-teal-700 border border-teal-200/80'
                                  : 'bg-vermilion-50 text-vermilion-700 border border-vermilion-200/80'
                              }`}
                            >
                              {isInv ? '+' : '−'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-ink-900 truncate">{title}</p>
                              <p className="text-[11px] text-slate-400 font-medium truncate">
                                {subtitle} • {date ? new Date(date).toLocaleDateString() : 'Recent'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p
                              className={`font-mono tabular-nums font-bold text-xs ${
                                isInv ? 'text-teal-700' : 'text-ink-900'
                              }`}
                            >
                              {isInv ? '+' : '−'}{fmt(amount || 0)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Financial Health Gauge, DecisionForge, and Forecast */}
          <div className="space-y-6">
            {/* Financial Health Analytical Gauge */}
            <Card>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-teal-600" />
                  <CardTitle>Financial Health Index</CardTitle>
                </div>
                <Badge
                  variant={healthScore >= 75 ? 'teal' : healthScore >= 50 ? 'amber' : 'vermilion'}
                  size="xs"
                >
                  {healthScore >= 75 ? 'Optimal' : healthScore >= 50 ? 'Moderate' : 'Caution'}
                </Badge>
              </div>

              <div className="flex flex-col items-center justify-center py-2">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke={healthScore >= 75 ? '#00A88F' : healthScore >= 50 ? '#F5B700' : '#F04438'}
                      strokeWidth="8"
                      strokeDasharray={251}
                      strokeDashoffset={251 - (healthScore / 100) * 251}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black font-mono tabular-nums text-ink-900">
                      {healthScore}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      / 100
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <p className="text-xs font-bold text-ink-900">{healthStatus}</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {persona === 'personal' || persona === 'employee'
                      ? 'Personal budget discipline & emergency buffer'
                      : persona === 'self_employed'
                      ? 'Freelance cash cushion & client concentration'
                      : 'Commercial liquidity & operating margin'}
                  </p>
                </div>
              </div>

              {metrics?.healthAssessment?.biggestOpportunity && (
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <span className="font-bold text-ink-900 block mb-0.5">Focus Strategy:</span>
                  {metrics.healthAssessment.biggestOpportunity}
                </div>
              )}
            </Card>

            {/* DecisionForge Pipeline Insights Banner */}
            <Card>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3.5">
                <div className="flex items-center gap-2">
                  <BrainCircuit size={16} className="text-cobalt-600" />
                  <CardTitle>DecisionForge Intelligence</CardTitle>
                </div>
                <Badge variant="cobalt" size="xs">
                  Active Model
                </Badge>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Financial Data → Risk → Decision Engine connected. Automated trade-off simulations ready.
                </p>

                {opportunities.length > 0 ? (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Prioritized Deals Pending Review
                    </span>
                    {opportunities.map((opp, idx) => (
                      <div
                        key={opp.id || idx}
                        className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/60 flex items-center justify-between text-xs"
                      >
                        <div className="truncate min-w-0 mr-2">
                          <p className="font-bold text-ink-900 truncate">
                            {opp.company_name || opp.name || `Opportunity #${idx + 1}`}
                          </p>
                          <p className="text-[10.5px] text-slate-400 font-mono tabular-nums">
                            {fmt(opp.deal_value || 500000)} • Win: {opp.win_probability ? Math.round(opp.win_probability * 100) : 75}%
                          </p>
                        </div>
                        <Badge variant="cobalt" size="xs">
                          Score: {opp.priority_score || 82}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 text-xs text-slate-500">
                    B2B opportunity pipeline synchronized with revenue forecast.
                  </div>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  rightIcon={<ExternalLink size={12} />}
                  onClick={() => navigate('/decision-forge')}
                >
                  Open DecisionForge Center
                </Button>
              </div>
            </Card>

            {/* Month-End Forecast Widget */}
            <ForecastWidget />

            {/* AI Actionable Insights */}
            <AntigravityInsights metrics={metrics} />
          </div>
        </div>
      </div>
    </div>
  );
};
