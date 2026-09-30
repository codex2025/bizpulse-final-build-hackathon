import React, { useMemo, useState } from 'react';
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dices } from 'lucide-react';
import { simulateRetainedCash } from '../../utils/monteCarlo';

interface Props {
  monthlyInflow: number;
  monthlyOutflow: number;
}

const inr = (n: number) => {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 10000000) return `${sign}₹${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `${sign}₹${(v / 100000).toFixed(1)}L`;
  return `${sign}₹${Math.round(v).toLocaleString('en-IN')}`;
};

/** 12-month probabilistic view of cumulative retained cash. Deterministic (fixed seed) and clearly labelled as a model. */
export const MonteCarloForecast: React.FC<Props> = ({ monthlyInflow, monthlyOutflow }) => {
  const [inflowVol, setInflowVol] = useState(12);
  const [outflowVol, setOutflowVol] = useState(8);

  const result = useMemo(
    () =>
      simulateRetainedCash({
        monthlyInflow,
        monthlyOutflow,
        inflowVolatility: inflowVol / 100,
        outflowVolatility: outflowVol / 100,
        months: 12,
        paths: 1000,
      }),
    [monthlyInflow, monthlyOutflow, inflowVol, outflowVol],
  );

  const data = result.points.map((p) => ({
    month: `M${p.month}`,
    base: p.p10,
    band: p.p90 - p.p10,
    median: p.p50,
    p10: p.p10,
    p90: p.p90,
  }));

  return (
    <section
      data-testid="monte-carlo"
      aria-label="Monte Carlo 12-month forecast"
      className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-violet-50 text-violet-700 border border-violet-100 flex items-center justify-center">
              <Dices size={16} />
            </span>
            <h3 className="text-sm font-extrabold text-slate-900">Monte Carlo 12-month retained-cash forecast</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1 max-w-2xl">
            1,000 simulated paths around your current monthly averages. The shaded band is the 10th to 90th percentile
            (an 80% range); the line is the median. This is a model of uncertainty, not a prediction.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-right shrink-0">
          {[
            ['Pessimistic (P10)', result.endP10],
            ['Base (P50)', result.endP50],
            ['Optimistic (P90)', result.endP90],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</dt>
              <dd className="text-sm font-black font-mono tabular-nums text-slate-900">{inr(value as number)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="h-64" role="img" aria-label="Cumulative retained cash, 10th to 90th percentile band by month">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mcBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={inr} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={64} />
            <Tooltip
              formatter={(value, name) => [inr(Number(value)), name === 'median' ? 'Median' : String(name)]}
              labelFormatter={(l) => `Month ${String(l).slice(1)}`}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <Area type="monotone" dataKey="base" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
            <Area type="monotone" dataKey="band" stackId="band" stroke="none" fill="url(#mcBand)" name="P10–P90 range" isAnimationActive={false} />
            <Line type="monotone" dataKey="median" stroke="#6d28d9" strokeWidth={2.5} dot={false} name="median" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <label className="text-xs font-bold text-slate-600 space-y-1">
          <span className="flex justify-between">
            <span>Inflow volatility</span>
            <span className="font-mono tabular-nums">{inflowVol}%</span>
          </span>
          <input type="range" min={0} max={40} value={inflowVol} onChange={(e) => setInflowVol(Number(e.target.value))} className="w-full accent-violet-600" />
        </label>
        <label className="text-xs font-bold text-slate-600 space-y-1">
          <span className="flex justify-between">
            <span>Outflow volatility</span>
            <span className="font-mono tabular-nums">{outflowVol}%</span>
          </span>
          <input type="range" min={0} max={40} value={outflowVol} onChange={(e) => setOutflowVol(Number(e.target.value))} className="w-full accent-violet-600" />
        </label>
        <p
          className={`text-xs font-bold rounded-xl px-3 py-2 border ${
            result.probabilityOfShortfall > 0.2 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {Math.round(result.probabilityOfShortfall * 100)}% of paths dip below zero at some point
        </p>
      </div>
      <p className="text-[11px] text-slate-400 font-medium">
        Assumptions: monthly inflow {inr(monthlyInflow)} and outflow {inr(monthlyOutflow)} (your averages for the selected window), independent
        monthly shocks, fixed random seed so results are repeatable.
      </p>
    </section>
  );
};
