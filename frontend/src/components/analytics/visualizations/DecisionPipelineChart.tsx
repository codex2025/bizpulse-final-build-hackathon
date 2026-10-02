import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import { Target, ArrowUpRight, Zap, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RecommendationItem } from '../../../services/decisionForgeService';

interface Props {
  recommendations?: RecommendationItem[];
  pipelineTotalValue?: number;
  weightedPipelineValue?: number;
  isLoading?: boolean;
}

export const DecisionPipelineChart: React.FC<Props> = ({
  recommendations = [],
  pipelineTotalValue,
  weightedPipelineValue,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="card p-6 border border-slate-200 rounded-3xl bg-white space-y-4 animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-1/3" />
        <div className="h-64 bg-slate-50 rounded-2xl" />
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div data-testid="decision-pipeline-empty" className="card p-8 border border-dashed border-slate-300 rounded-3xl bg-white text-center space-y-2">
        <Target size={22} className="text-slate-400 mx-auto" />
        <h3 className="text-sm font-extrabold text-slate-900">No sales data yet</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">Ranked opportunities and pipeline value appear here once you add your opportunities.</p>
        <Link to="/decision-forge" className="inline-block text-xs font-bold text-violet-700 hover:underline">Add data in DecisionForge</Link>
      </div>
    );
  }

  const items = recommendations;

  const totalValue = pipelineTotalValue ?? items.reduce((acc, curr) => acc + (curr.deal_value || 0), 0);
  const weightedValue = weightedPipelineValue ?? items.reduce(
    (acc, curr) => acc + (curr.deal_value || 0) * (curr.win_probability || 0),
    0
  );

  const immediateCount = items.filter((i) => i.decision_class === 'IMMEDIATE_ACTION').length;
  const qualifyCount = items.filter((i) => i.decision_class === 'PROCEED_WITH_QUALIFICATION').length;
  const nurtureCount = items.filter((i) => i.decision_class === 'NURTURE_MONITOR').length;

  const chartData = items.slice(0, 5).map((item) => ({
    name: item.company_name.split(' ')[0],
    fullName: item.company_name,
    dealLakhs: Math.round((item.deal_value || 0) / 100000),
    expectedLakhs: Math.round(((item.deal_value || 0) * (item.win_probability || 0)) / 100000),
    priorityScore: item.priority_score,
    decisionClass: item.decision_class,
  }));

  return (
    <div className="card p-6 border border-slate-200 rounded-3xl bg-white space-y-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cobalt-50 text-cobalt-600 border border-cobalt-100 flex items-center justify-center">
              <Target size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-ink-900">
                Decision Outcomes & Pipeline Valuation
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                DecisionForge commercial evaluations: Gross Pipeline vs Weighted Expected Value
              </p>
            </div>
          </div>
        </div>

        <Link
          to="/decision-forge"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-cobalt-600 hover:text-cobalt-700 hover:underline"
        >
          <span>Open DecisionForge</span>
          <ArrowUpRight size={13} />
        </Link>
      </div>

      {/* Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Pipeline Value</span>
          <span className="text-lg font-black text-ink-900 font-mono tabular-nums">
            ₹{(totalValue / 100000).toFixed(1)}L
          </span>
          <span className="text-[11px] text-slate-400 block font-medium mt-0.5">{items.length} opportunities</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Weighted Expected Value</span>
          <span className="text-lg font-black text-teal-600 font-mono tabular-nums">
            ₹{(weightedValue / 100000).toFixed(1)}L
          </span>
          <span className="text-[11px] text-slate-400 block font-medium mt-0.5">Adjusted for win probability</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Immediate Action</span>
          <span className="text-lg font-black text-cobalt-600 font-mono tabular-nums flex items-center gap-1.5">
            <Zap size={16} /> {immediateCount} deals
          </span>
          <span className="text-[11px] text-slate-400 block font-medium mt-0.5">High priority readiness</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Qualification Stage</span>
          <span className="text-lg font-black text-amber-600 font-mono tabular-nums flex items-center gap-1.5">
            <Clock size={16} /> {qualifyCount + nurtureCount} deals
          </span>
          <span className="text-[11px] text-slate-400 block font-medium mt-0.5">Under evaluation</span>
        </div>
      </div>

      {/* Chart: Gross Deal Value vs Probability Weighted Value */}
      <div className="h-64 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
              itemStyle={{ fontSize: 12, fontWeight: 700 }}
              formatter={(val: unknown, name: unknown) => [
                `₹${Number(val).toFixed(1)} Lakhs`,
                name === 'dealLakhs' ? 'Deal Size' : 'Weighted Expected Value',
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 6 }}
              formatter={(value) => <span className="text-slate-700">{value === 'dealLakhs' ? 'Deal Size (₹ Lakhs)' : 'Weighted Expected Value (₹ Lakhs)'}</span>}
            />
            <Bar dataKey="dealLakhs" name="dealLakhs" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={18} />
            <Bar dataKey="expectedLakhs" name="expectedLakhs" radius={[4, 4, 0, 0]} barSize={18}>
              {chartData.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={entry.decisionClass === 'IMMEDIATE_ACTION' ? '#2457FF' : entry.decisionClass === 'PROCEED_WITH_QUALIFICATION' ? '#00A88F' : '#F5B700'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mini Deal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
        {items.slice(0, 4).map((rec) => (
          <div key={rec.opportunity_id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-ink-900">{rec.company_name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                rec.decision_class === 'IMMEDIATE_ACTION'
                  ? 'bg-cobalt-50 text-cobalt-700 border border-cobalt-200'
                  : rec.decision_class === 'PROCEED_WITH_QUALIFICATION'
                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {rec.decision_class.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Deal: <strong className="text-ink-900 font-mono">₹{((rec.deal_value || 0) / 100000).toFixed(1)}L</strong></span>
              <span className="text-slate-500 font-medium">Win Prob: <strong className="text-teal-600 font-mono">{Math.round((rec.win_probability || 0) * 100)}%</strong></span>
              <span className="text-slate-500 font-medium">Score: <strong className="text-cobalt-600 font-mono">{rec.priority_score}</strong></span>
            </div>
            {rec.suggested_action && (
              <p className="text-[11px] text-slate-500 flex items-start gap-1 pt-1 border-t border-slate-100">
                <CheckCircle2 size={12} className="text-teal-600 mt-0.5 flex-shrink-0" />
                <span className="truncate">{rec.suggested_action}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
