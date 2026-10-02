import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
  Users, PieChart as PieIcon, Calendar,
  TrendingDown, TrendingUp, DollarSign, ShieldAlert,
  CheckCircle2, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Topbar } from '../common/Topbar';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { analyticsService } from '../../services/analyticsService';
import { contractService } from '../../services/contractService';
import { useDecisionWorkspace } from '../../hooks/useDecisionWorkspace';
import { decisionForgeService } from '../../services/decisionForgeService';
import { usePersona } from '../../context/PersonaContext';
import { usePrefersReducedMotion, EASE_FINANCIAL } from '../../utils/motion';

// Visualizations
import { HorizontalCategoryBar } from './visualizations/HorizontalCategoryBar';
import { BudgetVsActualChart } from './visualizations/BudgetVsActualChart';
import { MoneyFlowWaterfall } from './visualizations/MoneyFlowWaterfall';
import { SpendingTimeLineChart } from './visualizations/SpendingTimeLineChart';
import { StackedCategoryMonthChart } from './visualizations/StackedCategoryMonthChart';
import { CalendarSpendingHeatmap } from './visualizations/CalendarSpendingHeatmap';
import { TimeOfDayRadar } from './visualizations/TimeOfDayRadar';
import { AnomalyAlertCard } from './visualizations/AnomalyAlertCard';
import { ContractExposureChart } from './visualizations/ContractExposureChart';
import { DecisionPipelineChart } from './visualizations/DecisionPipelineChart';
import { ExecutiveBriefing } from './ExecutiveBriefing';
import { MonteCarloForecast } from './MonteCarloForecast';
import { UnitEconomics } from './UnitEconomics';
import { ExpenseAllocation } from './ExpenseAllocation';

const BIZPULSE_COLORS = ['#E11D48', '#7C3AED', '#059669', '#2457FF', '#F5B700', '#111827'];

const TIMEFRAME_PRESETS = [
  { id: '1m', label: '1 Month' },
  { id: '3m', label: '3 Months' },
  { id: '6m', label: '6 Months' },
  { id: '1y', label: '1 Year' },
  { id: '2y', label: '2 Years' },
  { id: 'custom', label: 'Custom' },
];

type AnalyticsTab = 'ALL' | 'UNIT' | 'SPRAWL' | 'CASH_FLOW' | 'BUDGET' | 'FORECAST' | 'CONTRACTS' | 'DECISIONS';

const WINDOW_MONTHS: Record<string, number> = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, '2y': 24 };

export const AnalyticsPage: React.FC = () => {
  const { persona } = usePersona();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('ALL');
  const [timeframe, setTimeframe] = useState('1m');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Real Bizpulse API queries
  const { data: advanced, isLoading: loadingAdv, isError: errorAdv, refetch: refetchAdv } = useQuery({
    queryKey: ['advanced-metrics'],
    queryFn: analyticsService.getAdvanced,
  });

  const { data: visData, isLoading: loadingVis, isError: errorVis, refetch: refetchVis } = useQuery({
    queryKey: ['visualizations', timeframe, customStart, customEnd],
    queryFn: () => analyticsService.getVisualizations({
      timeframe,
      startDate: timeframe === 'custom' ? customStart : undefined,
      endDate: timeframe === 'custom' ? customEnd : undefined,
    }),
  });

  const { data: contracts, isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts-analytics'],
    queryFn: contractService.getAll,
  });

  const contractObligations = React.useMemo(() => {
    if (!contracts || !Array.isArray(contracts) || contracts.length === 0) return undefined;
    interface RawContractItem {
      id: string;
      document_name?: string;
      overall_risk_rating?: string;
      simulation_results?: {
        loan_amount?: number;
        monthly_emi?: number;
        annual_interest_rate?: number;
        tenure_months?: number;
        prepayment_penalty?: number;
      } | null;
    }
    // Only analysed loans carry repayment terms. Everything shown here comes from the contract's own simulation
    // results; documents without them (MSA, SLA, NDA) are not obligations of this kind and are left out.
    return (contracts as RawContractItem[])
      .filter((c) => Number(c.simulation_results?.monthly_emi) > 0)
      .map((c) => {
        const sim = c.simulation_results!;
        const rating = (c.overall_risk_rating || '').toLowerCase();
        return {
          id: c.id,
          title: c.document_name || 'Loan agreement',
          institution: 'As stated in the agreement',
          facilityType: 'Loan agreement',
          principalAmount: Number(sim.loan_amount || 0),
          monthlyEmi: Number(sim.monthly_emi || 0),
          interestRate: Number(sim.annual_interest_rate || 0),
          tenorRemainingMonths: Number(sim.tenure_months || 0),
          foreclosureFeePercent: Number(sim.prepayment_penalty || 0),
          riskLevel: (rating.includes('high') ? 'critical' : rating.includes('moderate') ? 'caution' : 'nominal') as 'critical' | 'caution' | 'nominal',
          covenants: [] as string[],
        };
      });
  }, [contracts]);

  const decisionWorkspace = useDecisionWorkspace();
  const { data: decisionsData, isLoading: loadingDecisions } = useQuery({
    queryKey: ['decisions-analytics'],
    queryFn: () => decisionForgeService.runDecisions(),
    enabled: decisionWorkspace.configured,
  });

  // Start of the selected window, used by the tabs that read raw ledger rows.
  const windowStart = React.useMemo(() => {
    if (timeframe === 'custom') return new Date(customStart);
    const d = new Date();
    d.setMonth(d.getMonth() - (WINDOW_MONTHS[timeframe] || 1));
    return d;
  }, [timeframe, customStart]);
  const isLoading = loadingAdv || loadingVis;
  const isError = errorAdv || errorVis;

  if (isError) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-4">
        <Topbar title="Financial Analytics & Intelligence" subtitle="System diagnostics" />
        <div className="card p-8 border border-vermilion-200 bg-vermilion-50/30 rounded-3xl text-center space-y-4">
          <ShieldAlert size={36} className="text-vermilion-600 mx-auto" />
          <h3 className="text-base font-extrabold text-ink-900">Analytics Service Unreachable</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Unable to stream aggregated metrics from the Bizpulse financial ledger. Please check network connectivity or refresh your authentication session.
          </p>
          <button
            type="button"
            onClick={() => { refetchAdv(); refetchVis(); }}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl cursor-pointer"
          >
            <RotateCcw size={14} /> Retry Query
          </button>
        </div>
      </div>
    );
  }

  const topClients = advanced?.topClients || [];
  const incomeFlow = visData?.incomeFlow;
  // No stand-in figures: an account with no ledger entries reads zero.
  const grossIncome = incomeFlow?.grossIncome ?? 0;
  const totalExpenses = incomeFlow?.totalExpenses ?? 0;
  const retainedSavings = incomeFlow?.retainedSavings ?? (grossIncome - totalExpenses);
  const savingsPct = incomeFlow?.savingsPercentage ?? (grossIncome > 0 ? Math.round((retainedSavings / grossIncome) * 100) : 0);

  const windowMonths =
    timeframe === 'custom'
      ? Math.max(1, (new Date(customEnd).getTime() - new Date(customStart).getTime()) / (30 * 86400000))
      : WINDOW_MONTHS[timeframe] || 1;
  const windowLabel = TIMEFRAME_PRESETS.find((p) => p.id === timeframe)?.label.toLowerCase() || 'the selected window';
  const contractEmiPerMonth = (contractObligations || []).reduce((s, c) => s + c.monthlyEmi, 0);
  const contractPrincipal = (contractObligations || []).reduce((s, c) => s + c.principalAmount, 0);
  const fmtLakh = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2)}Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Topbar
        title="Financial Analytics & Capital Intelligence"
        subtitle={`Unified analytical telemetry adapted for ${persona.toUpperCase()} mode`}
      />

      <ExecutiveBriefing
        grossIncome={grossIncome}
        totalExpenses={totalExpenses}
        retainedSavings={retainedSavings}
        savingsPct={savingsPct}
        windowLabel={windowLabel}
        pipelineValue={decisionsData?.pipeline_total_value}
        immediateActions={decisionsData?.high_priority_count}
        contractEmiPerMonth={contractEmiPerMonth}
      />

      {/* High-Level Financial Executive Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          whileHover={!prefersReducedMotion ? { y: -3 } : undefined}
          transition={{ duration: 0.18, ease: EASE_FINANCIAL }}
          className="relative overflow-hidden p-5 border border-slate-200/90 rounded-2xl bg-white/95 backdrop-blur-xl space-y-2 shadow-[0_4px_20px_-2px_rgba(16,24,47,0.04)] hover:shadow-[0_12px_28px_-6px_rgba(16,24,47,0.08)] transition-all"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Inflow / Gross</span>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <DollarSign size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">
              <AnimatedNumber value={grossIncome} formatFn={(v) => '₹' + Math.round(v).toLocaleString('en-IN')} />
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 mt-1">
              <TrendingUp size={13} />
              <span>Inflow pacing benchmark</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          whileHover={!prefersReducedMotion ? { y: -3 } : undefined}
          transition={{ duration: 0.18, ease: EASE_FINANCIAL }}
          className="relative overflow-hidden p-5 border border-slate-200/90 rounded-2xl bg-white/95 backdrop-blur-xl space-y-2 shadow-[0_4px_20px_-2px_rgba(16,24,47,0.04)] hover:shadow-[0_12px_28px_-6px_rgba(16,24,47,0.08)] transition-all"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500/30 to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Operating Outflows</span>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
              <TrendingDown size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">
              <AnimatedNumber value={totalExpenses} formatFn={(v) => '₹' + Math.round(v).toLocaleString('en-IN')} />
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 mt-1 font-mono tabular-nums">
              <span>{grossIncome > 0 ? `${Math.round((totalExpenses / grossIncome) * 100)}% of gross revenue` : 'No inflow recorded yet'}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          whileHover={!prefersReducedMotion ? { y: -3 } : undefined}
          transition={{ duration: 0.18, ease: EASE_FINANCIAL }}
          className="relative overflow-hidden p-5 border border-slate-200/90 rounded-2xl bg-white/95 backdrop-blur-xl space-y-2 shadow-[0_4px_20px_-2px_rgba(16,24,47,0.04)] hover:shadow-[0_12px_28px_-6px_rgba(16,24,47,0.08)] transition-all"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500/30 to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Net Retained Margin</span>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-violet-700 font-mono tabular-nums">
              <AnimatedNumber value={retainedSavings} formatFn={(v) => '₹' + Math.round(v).toLocaleString('en-IN')} />
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-700 mt-1 font-mono tabular-nums">
              <span>{savingsPct}% retained working capital</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          whileHover={!prefersReducedMotion ? { y: -3 } : undefined}
          transition={{ duration: 0.18, ease: EASE_FINANCIAL }}
          className="relative overflow-hidden p-5 border border-slate-200/90 rounded-2xl bg-white/95 backdrop-blur-xl space-y-2 shadow-[0_4px_20px_-2px_rgba(16,24,47,0.04)] hover:shadow-[0_12px_28px_-6px_rgba(16,24,47,0.08)] transition-all"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Contract Obligations</span>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">
              {contractEmiPerMonth > 0 ? fmtLakh(contractEmiPerMonth) : '₹0'}<span className="text-xs font-semibold text-slate-400">/mo</span>
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 mt-1">
              <span>
                {contractPrincipal > 0
                  ? `${fmtLakh(contractPrincipal)} principal across ${contractObligations?.length} contract${contractObligations?.length === 1 ? '' : 's'}`
                  : 'No contracts analysed yet'}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Control Bar: Timeframe Preset & Lens Selector */}
      <div
        data-tour="analytics-lenses"
        className="card p-4 border border-slate-200 rounded-3xl bg-white space-y-3 shadow-xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Analytical Lenses */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            {[
              { id: 'ALL', label: 'Overview' },
              { id: 'UNIT', label: 'Unit Economics' },
              { id: 'SPRAWL', label: 'Expense Allocation' },
              { id: 'CASH_FLOW', label: 'Cash Flow' },
              { id: 'BUDGET', label: 'Budget & Variance' },
              { id: 'FORECAST', label: 'Monte Carlo Forecast' },
              { id: 'CONTRACTS', label: 'Contract Exposure' },
              { id: 'DECISIONS', label: 'Commercial Decisions' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as AnalyticsTab)}
                  className={`relative px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                    isActive ? 'text-ink-900' : 'text-slate-600 hover:text-ink-900'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId={!prefersReducedMotion ? 'activeAnalyticsLens' : undefined}
                      className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200 -z-10"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Timeframe Presets */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 pl-2 pr-1 flex items-center gap-1">
              <Calendar size={13} /> Window:
            </span>
            {TIMEFRAME_PRESETS.map((preset) => {
              const isActive = timeframe === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTimeframe(preset.id)}
                  className={`relative px-2.5 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isActive ? 'text-ink-900 font-extrabold' : 'text-slate-600 hover:text-ink-900'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId={!prefersReducedMotion ? 'activeAnalyticsPreset' : undefined}
                      className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200 -z-10"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {timeframe === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Start:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="input-field py-1 text-xs font-semibold w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">End:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="input-field py-1 text-xs font-semibold w-36"
              />
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              Aggregating live transactions across {customStart} → {customEnd}
            </span>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="card p-8 border border-slate-200 rounded-3xl bg-white space-y-4 animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="h-48 bg-slate-50 rounded-2xl" />
        </div>
      )}

      {/* Main Tabbed Analytics Views */}
      {!isLoading && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + timeframe}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Anomaly Card Banner */}
            {visData?.spendingAnomalies && visData.spendingAnomalies.length > 0 && (
              <AnomalyAlertCard data={visData.spendingAnomalies} />
            )}

            {/* TAB: ALL / OVERVIEW */}
            {activeTab === 'ALL' && (
              <>
                {/* Hero Waterfall Flow */}
                {visData?.incomeFlow && (
                  <MoneyFlowWaterfall data={visData.incomeFlow} />
                )}

                {/* Core Variance & Category Matrix */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {visData?.categoryHorizontal && (
                    <HorizontalCategoryBar data={visData.categoryHorizontal} />
                  )}
                  {visData?.budgetVsActual && (
                    <BudgetVsActualChart data={visData.budgetVsActual} />
                  )}
                </div>

                {/* Contract Obligations & Commercial Decisions Strip */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ContractExposureChart isLoading={loadingContracts} obligations={contractObligations} />
                  <DecisionPipelineChart
                    isLoading={loadingDecisions}
                    recommendations={decisionsData?.recommendations}
                    pipelineTotalValue={decisionsData?.pipeline_total_value}
                    weightedPipelineValue={decisionsData?.weighted_pipeline_value}
                  />
                </div>

                {/* Temporal Trajectory & Multi-Month Stacked Evolution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {visData?.spendingOverTime && (
                    <SpendingTimeLineChart data={visData.spendingOverTime} />
                  )}
                  {visData?.categoryMonthlyStacked && (
                    <StackedCategoryMonthChart data={visData.categoryMonthlyStacked} />
                  )}
                </div>
              </>
            )}

            {/* TAB: CASH FLOW */}
            {activeTab === 'CASH_FLOW' && (
              <div className="space-y-6">
                {visData?.incomeFlow && (
                  <MoneyFlowWaterfall data={visData.incomeFlow} />
                )}
                {visData?.spendingOverTime && (
                  <SpendingTimeLineChart data={visData.spendingOverTime} />
                )}
                {visData?.timeOfDay && (
                  <TimeOfDayRadar data={visData.timeOfDay} />
                )}
              </div>
            )}

            {/* TAB: BUDGET & EXPENSE VARIANCE */}
            {activeTab === 'BUDGET' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {visData?.budgetVsActual && (
                    <BudgetVsActualChart data={visData.budgetVsActual} />
                  )}
                  {visData?.categoryHorizontal && (
                    <HorizontalCategoryBar data={visData.categoryHorizontal} />
                  )}
                </div>
                {visData?.categoryMonthlyStacked && (
                  <StackedCategoryMonthChart data={visData.categoryMonthlyStacked} />
                )}
                {visData?.dailyHeatmap && (
                  <CalendarSpendingHeatmap data={visData.dailyHeatmap} />
                )}
              </div>
            )}

            {/* TAB: UNIT ECONOMICS */}
            {activeTab === 'UNIT' && <UnitEconomics since={windowStart} windowMonths={windowMonths} />}

            {/* TAB: EXPENSE ALLOCATION & VENDOR SPRAWL */}
            {activeTab === 'SPRAWL' && <ExpenseAllocation since={windowStart} />}

            {/* TAB: MONTE CARLO FORECAST */}
            {activeTab === 'FORECAST' && (
              <MonteCarloForecast
                monthlyInflow={grossIncome / windowMonths}
                monthlyOutflow={totalExpenses / windowMonths}
              />
            )}

            {/* TAB: CONTRACT OBLIGATIONS & EXPOSURE */}
            {activeTab === 'CONTRACTS' && (
              <div className="space-y-6">
                <ContractExposureChart isLoading={loadingContracts} obligations={contractObligations} />
              </div>
            )}

            {/* TAB: COMMERCIAL DECISIONS */}
            {activeTab === 'DECISIONS' && (
              <div className="space-y-6">
                <DecisionPipelineChart
                  isLoading={loadingDecisions}
                  recommendations={decisionsData?.recommendations}
                  pipelineTotalValue={decisionsData?.pipeline_total_value}
                  weightedPipelineValue={decisionsData?.weighted_pipeline_value}
                />
              </div>
            )}

            {/* Commercial Breakdown for Business & Self-Employed Personas */}
            {(persona === 'business' || persona === 'self_employed') && topClients.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                <div className="card p-6 border border-slate-200 rounded-3xl bg-white space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Users size={16} className="text-cobalt-600" />
                    <div>
                      <h3 className="text-sm font-extrabold text-ink-900">Key Client Revenue Concentration</h3>
                      <p className="text-xs text-slate-500 font-medium">Distribution of incoming enterprise billings by counterparty</p>
                    </div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topClients} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={120} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
                          itemStyle={{ fontSize: 12, fontWeight: 700 }}
                          formatter={(v: unknown) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
                        />
                        <Bar dataKey="revenue" fill="#2457FF" radius={[0, 6, 6, 0]} barSize={18}>
                          {topClients.map((_: unknown, i: number) => (
                            <Cell key={`client-cell-${i}`} fill={BIZPULSE_COLORS[i % BIZPULSE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-6 border border-slate-200 rounded-3xl bg-white space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <PieIcon size={16} className="text-teal-600" />
                    <div>
                      <h3 className="text-sm font-extrabold text-ink-900">Overall Outflow Distribution (% Donut)</h3>
                      <p className="text-xs text-slate-500 font-medium">Proportional category disbursement split</p>
                    </div>
                  </div>
                  <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={visData?.spendingDistribution || []}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={4}
                        >
                          {(visData?.spendingDistribution || []).map((_: unknown, i: number) => (
                            <Cell key={`dist-cell-${i}`} fill={BIZPULSE_COLORS[i % BIZPULSE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: unknown) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Outflow']}
                          contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
                          itemStyle={{ fontSize: 12, fontWeight: 700 }}
                        />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};
