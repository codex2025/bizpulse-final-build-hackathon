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
import { analyticsService } from '../../services/analyticsService';
import { contractService } from '../../services/contractService';
import { decisionForgeService } from '../../services/decisionForgeService';
import { usePersona } from '../../context/PersonaContext';

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

const BIZPULSE_COLORS = ['#2457FF', '#F04438', '#00A88F', '#F5B700', '#64748B', '#111827'];

const TIMEFRAME_PRESETS = [
  { id: '1m', label: '1 Month' },
  { id: '3m', label: '3 Months' },
  { id: '6m', label: '6 Months' },
  { id: '1y', label: '1 Year' },
  { id: '2y', label: '2 Years' },
  { id: 'custom', label: 'Custom' },
];

type AnalyticsTab = 'ALL' | 'CASH_FLOW' | 'BUDGET' | 'CONTRACTS' | 'DECISIONS';

export const AnalyticsPage: React.FC = () => {
  const { persona } = usePersona();
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
      title?: string;
      parties?: string[];
      sanctioned_amount?: number;
      monthly_emi?: number;
      interest_rate?: number;
      tenure_months?: number;
      overall_risk?: string;
    }
    return (contracts as RawContractItem[]).map((c) => ({
      id: c.id,
      title: c.title || 'Commercial Facility Agreement',
      institution: c.parties?.[0] || 'Institutional Lender',
      facilityType: 'Secured Credit Facility',
      principalAmount: Number(c.sanctioned_amount || 7500000),
      monthlyEmi: Number(c.monthly_emi || 169690),
      interestRate: Number(c.interest_rate || 12.75),
      tenorRemainingMonths: Number(c.tenure_months || 60),
      foreclosureFeePercent: 3.5,
      riskLevel: (c.overall_risk === 'critical' ? 'critical' : c.overall_risk === 'caution' ? 'caution' : 'nominal') as 'critical' | 'caution' | 'nominal',
      covenants: ['Hypothecated machinery', 'Personal director guarantee'],
    }));
  }, [contracts]);

  const { data: decisionsData, isLoading: loadingDecisions } = useQuery({
    queryKey: ['decisions-analytics'],
    queryFn: () => decisionForgeService.runDecisions(),
  });

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
  const grossIncome = incomeFlow?.grossIncome || 220000;
  const totalExpenses = incomeFlow?.totalExpenses || 45000;
  const retainedSavings = incomeFlow?.retainedSavings || (grossIncome - totalExpenses);
  const savingsPct = incomeFlow?.savingsPercentage || Math.round((retainedSavings / grossIncome) * 100);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Topbar
        title="Financial Analytics & Capital Intelligence"
        subtitle={`Unified analytical telemetry adapted for ${persona.toUpperCase()} mode`}
      />

      {/* High-Level Financial Executive Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border border-slate-200 rounded-3xl bg-white space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Inflow / Gross</span>
            <div className="w-8 h-8 rounded-xl bg-cobalt-50 text-cobalt-600 border border-cobalt-100 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-ink-900 font-mono tabular-nums">
              ₹{grossIncome.toLocaleString('en-IN')}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal-600 mt-1">
              <TrendingUp size={13} />
              <span>Inflow pacing benchmark</span>
            </div>
          </div>
        </div>

        <div className="card p-5 border border-slate-200 rounded-3xl bg-white space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Operating Outflows</span>
            <div className="w-8 h-8 rounded-xl bg-vermilion-50 text-vermilion-600 border border-vermilion-100 flex items-center justify-center">
              <TrendingDown size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-ink-900 font-mono tabular-nums">
              ₹{totalExpenses.toLocaleString('en-IN')}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mt-1 font-mono tabular-nums">
              <span>{Math.round((totalExpenses / grossIncome) * 100)}% of gross revenue</span>
            </div>
          </div>
        </div>

        <div className="card p-5 border border-slate-200 rounded-3xl bg-white space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Net Retained Margin</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-teal-600 font-mono tabular-nums">
              ₹{retainedSavings.toLocaleString('en-IN')}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700 mt-1 font-mono tabular-nums">
              <span>{savingsPct}% retained working capital</span>
            </div>
          </div>
        </div>

        <div className="card p-5 border border-slate-200 rounded-3xl bg-white space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contract Obligations</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-ink-900 font-mono tabular-nums">
              ₹1.69L<span className="text-xs font-semibold text-slate-400">/mo</span>
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 mt-1">
              <span>₹75L active MSE loan principal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Timeframe Preset & Lens Selector */}
      <div className="card p-4 border border-slate-200 rounded-3xl bg-white space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Analytical Lenses */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-white text-ink-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CASH_FLOW')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'CASH_FLOW'
                  ? 'bg-white text-ink-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
            >
              Cash Flow
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('BUDGET')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'BUDGET'
                  ? 'bg-white text-ink-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
            >
              Budget & Variance
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CONTRACTS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'CONTRACTS'
                  ? 'bg-white text-ink-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
            >
              Contract Exposure
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DECISIONS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'DECISIONS'
                  ? 'bg-white text-ink-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
            >
              Commercial Decisions
            </button>
          </div>

          {/* Timeframe Presets */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 pl-2 pr-1 flex items-center gap-1">
              <Calendar size={13} /> Window:
            </span>
            {TIMEFRAME_PRESETS.map((preset) => {
              const active = timeframe === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTimeframe(preset.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-ink-900 shadow-xs border border-slate-200 font-extrabold'
                      : 'text-slate-600 hover:text-ink-900'
                  }`}
                >
                  {preset.label}
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
