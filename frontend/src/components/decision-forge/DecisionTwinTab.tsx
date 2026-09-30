import React, { useState, useEffect } from 'react';
import { Sliders, TrendingUp, TrendingDown, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { decisionForgeService } from '../../services/decisionForgeService';
import type { SimulationParams, SimulationResult } from '../../services/decisionForgeService';

export const DecisionTwinTab: React.FC = () => {

  const [params, setParams] = useState<SimulationParams>({
    contacts_per_day: 20,
    min_deal_value: 50000,
    sales_reps_count: 4,
    followup_window_days: 3,
    priority_threshold: 60,
  });

  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = React.useCallback(async (customParams?: SimulationParams) => {
    setIsSimulating(true);
    try {
      const data = await decisionForgeService.simulateTwin(customParams || params);
      setResult(data);
    } catch (err: unknown) {
      console.error('Twin simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  }, [params]);

  useEffect(() => {
    runSimulation();
  }, [runSimulation]);

  const chartData = result
    ? [
        {
          name: 'Expected Pipeline ($)',
          Baseline: Math.round(result.baseline_expected_value),
          'Decision Twin Scenario': Math.round(result.scenario_expected_value),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-gradient-to-r from-rose-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-rose-500/30 text-rose-300 border border-rose-400/40">
              Decision Twin • Scenario Simulator
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Simulate "What-If" Strategic Outcomes Before Acting
          </h2>
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
            Test strategy changes against team capacity, response time and deal thresholds, using stated assumptions. 
            Compare alternative strategies side-by-side without mutating baseline business records.
          </p>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-rose-600/10 to-transparent pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Control Sliders */}
        <div className="lg:col-span-5 bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900">Scenario Levers & Constraints</h3>
            </div>
            <button
              onClick={() => runSimulation()}
              disabled={isSimulating}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
              Recalculate
            </button>
          </div>

          {/* Slider 1: Contacts per day */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700">Outreach Volume (Contacts / Day)</span>
              <span className="text-rose-600 font-bold">{params.contacts_per_day} calls</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={params.contacts_per_day}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                const next = { ...params, contacts_per_day: val };
                setParams(next);
                runSimulation(next);
              }}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>5 calls (Conservative)</span>
              <span>50 calls (Aggressive)</span>
            </div>
          </div>

          {/* Slider 2: Minimum Deal Value */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700">Minimum Deal Value Focus</span>
              <span className="text-rose-600 font-bold">${params.min_deal_value.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="0"
              max="250000"
              step="25000"
              value={params.min_deal_value}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                const next = { ...params, min_deal_value: val };
                setParams(next);
                runSimulation(next);
              }}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>$0 (All Deals)</span>
              <span>$250,000 (Enterprise Focus)</span>
            </div>
          </div>

          {/* Slider 3: Sales Rep Count */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700">Active Sales Reps Capacity</span>
              <span className="text-rose-600 font-bold">{params.sales_reps_count} Reps</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={params.sales_reps_count}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                const next = { ...params, sales_reps_count: val };
                setParams(next);
                runSimulation(next);
              }}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>1 Rep</span>
              <span>10 Reps</span>
            </div>
          </div>

          {/* Slider 4: Followup Speed */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700">Follow-up Response Window</span>
              <span className="text-rose-600 font-bold">{params.followup_window_days} Days</span>
            </div>
            <input
              type="range"
              min="1"
              max="14"
              step="1"
              value={params.followup_window_days}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                const next = { ...params, followup_window_days: val };
                setParams(next);
                runSimulation(next);
              }}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>1 Day (Rapid Close Lift)</span>
              <span>14 Days (Delayed Response)</span>
            </div>
          </div>

          {/* Slider 5: Priority Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700">Scenario Priority Cutoff</span>
              <span className="text-rose-600 font-bold">{params.priority_threshold} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={params.priority_threshold}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                const next = { ...params, priority_threshold: val };
                setParams(next);
                runSimulation(next);
              }}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0 (Include Everything)</span>
              <span>100 (Only Top Scores)</span>
            </div>
          </div>

          {/* Capacity Notice */}
          {result?.capacity_warning && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>{result.capacity_warning}</span>
            </div>
          )}
        </div>

        {/* Right: Projected Impact & Comparative Visuals */}
        <div className="lg:col-span-7 space-y-6">
          {/* Top Comparison KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white/90 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-400 font-semibold block">Scenario Expected Value</span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                ${Math.round(result?.scenario_expected_value ?? 0).toLocaleString()}
              </div>
              <div
                className={`flex items-center gap-1 text-[11px] font-bold mt-1 ${
                  (result?.delta_revenue_percent ?? 0) < 0 ? 'text-amber-700' : 'text-emerald-600'
                }`}
              >
                {(result?.delta_revenue_percent ?? 0) < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                <span>
                  {result?.delta_revenue_percent
                    ? `${result.delta_revenue_percent > 0 ? '+' : '−'}${Math.abs(result.delta_revenue_percent)}% vs baseline`
                    : '0% vs baseline'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-white/90 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-400 font-semibold block">Rep Workload Utilization</span>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {result?.rep_capacity_utilization_percent || 0}%
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                Rule of thumb: 70% – 95%
              </span>
            </div>

            <div className="p-4 bg-white/90 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-400 font-semibold block">Projected Closes</span>
              <div className="text-xl font-bold text-rose-600 mt-1">
                {result?.expected_closed_deals || 0} Deals
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">Probability-weighted, covered deals</span>
            </div>
          </div>

          {result?.baseline_params && (
            <p className="text-[11px] text-slate-500 -mt-3">
              Compared against the baseline strategy: {String(result.baseline_params.sales_reps_count)} reps ×{' '}
              {String(result.baseline_params.contacts_per_day)} contacts/day, minimum deal $
              {Number(result.baseline_params.min_deal_value).toLocaleString()}, {String(result.baseline_params.followup_window_days)}-day
              response, priority cutoff {String(result.baseline_params.priority_threshold)}. Both run through the same model.
            </p>
          )}

          {/* Visual Recharts Comparison */}
          <div className="bg-white/90 rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Baseline vs Decision Twin Projection
            </h4>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val) => [`$${Number(val).toLocaleString()}`, '']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="Baseline" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Decision Twin Scenario" fill="#e11d48" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Metric Delta Table */}
          <div className="bg-white/90 rounded-2xl border border-slate-200 p-5 shadow-sm overflow-hidden">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              Strategic Variance Matrix
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                    <th className="pb-2">Metric</th>
                    <th className="pb-2">Baseline</th>
                    <th className="pb-2">Scenario</th>
                    <th className="pb-2 text-right">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result?.comparisons.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 font-medium text-slate-800">{c.parameter}</td>
                      <td className="py-2.5 text-slate-500">{c.baseline}</td>
                      <td className="py-2.5 font-bold text-slate-900">{c.scenario}</td>
                      <td className="py-2.5 text-right font-bold text-rose-600">{c.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result && (
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                    {result.label || 'Scenario estimate'}
                  </span>
                  {result.opportunities_covered !== undefined && (
                    <span className="text-slate-600">
                      Covers <strong>{result.opportunities_covered}</strong> of {result.opportunities_in_scope} in-scope opportunities within team
                      capacity; <strong>{result.opportunities_missed}</strong> valid opportunities not covered
                      (${Math.round(result.missed_expected_value || 0).toLocaleString()} expected value).
                    </span>
                  )}
                </div>
                {result.scenario_expected_value_no_assumptions !== undefined && (
                  <p className="text-[11px] text-slate-600">
                    Without the assumptions below the covered opportunities are worth{' '}
                    <strong>${Math.round(result.scenario_expected_value_no_assumptions).toLocaleString()}</strong>; the assumptions move that
                    figure by {result.uncertainty_band_percent}%.
                  </p>
                )}
                {result.assumptions && result.assumptions.length > 0 && (
                  <ul className="list-disc pl-4 text-[11px] text-slate-500 space-y-0.5">
                    {result.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                )}
                <p className="text-[10px] text-slate-400 italic">* {result.disclaimer} Runs on a copy of the data; your records are not changed.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
