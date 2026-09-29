import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { Users, PieChart as PieIcon, Calendar } from 'lucide-react';
import { Topbar } from '../common/Topbar';
import { analyticsService } from '../../services/analyticsService';
import { usePersona } from '../../context/PersonaContext';

// 11 Next-Gen Visualizations
import { HorizontalCategoryBar } from './visualizations/HorizontalCategoryBar';
import { BudgetVsActualChart } from './visualizations/BudgetVsActualChart';
import { MoneyFlowWaterfall } from './visualizations/MoneyFlowWaterfall';
import { SpendingTimeLineChart } from './visualizations/SpendingTimeLineChart';
import { StackedCategoryMonthChart } from './visualizations/StackedCategoryMonthChart';
import { CalendarSpendingHeatmap } from './visualizations/CalendarSpendingHeatmap';
import { TimeOfDayRadar } from './visualizations/TimeOfDayRadar';
import { AnomalyAlertCard } from './visualizations/AnomalyAlertCard';

const COLORS = ['#6366f1', '#e11d48', '#8b5cf6', '#f59e0b', '#06b6d4', '#10b981'];

const TIMEFRAME_PRESETS = [
  { id: '1m', label: 'This Month' },
  { id: '3m', label: '3 Months' },
  { id: '6m', label: '6 Months' },
  { id: '1y', label: '1 Year' },
  { id: '2y', label: '2 Years' },
  { id: '5y', label: '5 Years' },
  { id: 'custom', label: 'Custom Range' },
];

export const AnalyticsPage: React.FC = () => {
  const { persona } = usePersona();
  const [timeframe, setTimeframe] = useState('1m');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  const { data: advanced, isLoading: loadingAdv } = useQuery({
    queryKey: ['advanced-metrics'],
    queryFn: analyticsService.getAdvanced
  });

  const { data: visData, isLoading: loadingVis } = useQuery({
    queryKey: ['visualizations', timeframe, customStart, customEnd],
    queryFn: () => analyticsService.getVisualizations({
      timeframe,
      startDate: timeframe === 'custom' ? customStart : undefined,
      endDate: timeframe === 'custom' ? customEnd : undefined,
    }),
  });

  if (loadingAdv || loadingVis) {
    return <div className="p-8 text-xs text-slate-500 font-bold">Loading customized analytics suite...</div>;
  }

  const topClients = advanced?.topClients || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Topbar
        title="Visual Intelligence & Analytics"
        subtitle={`11 dynamic analytics engines tailored for ${persona.toUpperCase()} mode`}
      />

      {/* Timeframe Filter Bar */}
      <div className="card p-4 border border-slate-200 rounded-3xl bg-white space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center">
              <Calendar size={16} />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 block">Analysis Timeframe</span>
              <span className="text-[11px] font-medium text-slate-500">
                {visData?.dateRange ? `Active Window: ${visData.dateRange.start} → ${visData.dateRange.end}` : 'Default: Ongoing Month'}
              </span>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80">
            {TIMEFRAME_PRESETS.map((preset) => {
              const active = timeframe === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTimeframe(preset.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
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
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 animate-card">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Start Date:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="input-field py-1.5 text-xs font-semibold w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">End Date:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="input-field py-1.5 text-xs font-semibold w-36"
              />
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              Charts will automatically aggregate across this custom timeframe.
            </span>
          </div>
        )}
      </div>

      {/* 1. Anomaly Alert Radar Banner (if detected) */}
      {visData?.spendingAnomalies && (
        <AnomalyAlertCard data={visData.spendingAnomalies} />
      )}

      {/* 2. Primary Hero Flow: Income -> Outflow -> Savings Waterfall */}
      {visData?.incomeFlow && (
        <MoneyFlowWaterfall data={visData.incomeFlow} />
      )}

      {/* 3. Core Matrix: Category Horizontal Drill-Down & Budget vs Actual Grouped Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visData?.categoryHorizontal && (
          <HorizontalCategoryBar data={visData.categoryHorizontal} />
        )}
        {visData?.budgetVsActual && (
          <BudgetVsActualChart data={visData.budgetVsActual} />
        )}
      </div>

      {/* 4. Temporal Dynamics: Weekly/Monthly Spending Curve & Multi-Month Category Stacked Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visData?.spendingOverTime && (
          <SpendingTimeLineChart data={visData.spendingOverTime} />
        )}
        {visData?.categoryMonthlyStacked && (
          <StackedCategoryMonthChart data={visData.categoryMonthlyStacked} />
        )}
      </div>

      {/* 5. Habits & Intensity: 30-Day Calendar Heatmap & Time of Day Spending Radar */}
      <div className="space-y-6">
        {visData?.dailyHeatmap && (
          <CalendarSpendingHeatmap data={visData.dailyHeatmap} />
        )}
        {visData?.timeOfDay && (
          <TimeOfDayRadar data={visData.timeOfDay} />
        )}
      </div>

      {/* 6. Corporate / Commercial Breakdown (for Business & Freelance modes) */}
      {(persona === 'business' || persona === 'self_employed') && topClients.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 border border-slate-200 rounded-3xl bg-white space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Users size={16} className="text-amber-600" />
              <h3 className="text-sm font-extrabold text-slate-900">Key Client Revenue Concentration</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClients} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={120} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}
                    itemStyle={{ fontSize: 12, fontWeight: 700 }}
                    formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`}
                  />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={18}>
                    {topClients.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-6 border border-slate-200 rounded-3xl bg-white space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <PieIcon size={16} className="text-purple-600" />
              <h3 className="text-sm font-extrabold text-slate-900">Overall Outflow Distribution (% Donut)</h3>
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
                    {(visData?.spendingDistribution || []).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`}
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}
                    itemStyle={{ fontSize: 12, fontWeight: 700 }}
                  />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
