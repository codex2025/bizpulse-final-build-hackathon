import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { decisionForgeService } from '../../services/decisionForgeService';
import { BASELINE_TERMS, DEFAULT_COST_OF_CAPITAL_PCT, compareTerms } from '../../utils/termsSandbox';

const usd = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

const Slider: React.FC<{
  id: string; label: string; unit: string; min: number; max: number; step: number; value: number; baseline: number; onChange: (v: number) => void;
}> = ({ id, label, unit, min, max, step, value, baseline, onChange }) => (
  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
    <div className="flex justify-between items-center">
      <label htmlFor={id} className="text-xs font-bold text-slate-700">{label}</label>
      <span className="text-xs font-mono font-black text-cobalt-700 tabular-nums">{value}{unit}</span>
    </div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-cobalt-600 cursor-pointer" />
    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
      <span>{min}{unit}</span>
      <span>baseline {baseline}{unit}</span>
      <span>{max}{unit}</span>
    </div>
  </div>
);

/** Commercial-terms sandbox: discount, payment terms and default risk applied to the pipeline's expected value. */
export const TermsSandbox: React.FC = () => {
  const { data } = useQuery({
    queryKey: ['decisions-analytics'],
    queryFn: () => decisionForgeService.runDecisions(),
    staleTime: 30_000,
  });
  const revenue = data?.weighted_pipeline_value ?? 0;

  const [discountPct, setDiscount] = useState<number>(BASELINE_TERMS.discountPct);
  const [creditDays, setCredit] = useState<number>(BASELINE_TERMS.creditDays);
  const [defaultPct, setDefault] = useState<number>(BASELINE_TERMS.defaultPct);

  const { baseline, simulated, delta } = useMemo(
    () => compareTerms(revenue, { discountPct, creditDays, defaultPct }),
    [revenue, discountPct, creditDays, defaultPct],
  );

  const chart = [
    { name: 'Discount', Baseline: -baseline.discount, Scenario: -simulated.discount },
    { name: 'Default loss', Baseline: -baseline.defaultLoss, Scenario: -simulated.defaultLoss },
    { name: 'Financing cost', Baseline: -baseline.financingCost, Scenario: -simulated.financingCost },
    { name: 'Net collected', Baseline: baseline.net, Scenario: simulated.net },
  ];
  const moved = discountPct !== BASELINE_TERMS.discountPct || creditDays !== BASELINE_TERMS.creditDays || defaultPct !== BASELINE_TERMS.defaultPct;

  return (
    <section data-testid="terms-sandbox" aria-label="Commercial terms sandbox" className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-violet-50 text-violet-700 border border-violet-100 flex items-center justify-center"><FlaskConical size={16} /></span>
          <div>
            <h3 className="font-extrabold text-base text-slate-900">Commercial terms sandbox</h3>
            <p className="text-xs text-slate-500 font-medium">What would different discount, payment-term and default assumptions do to the pipeline&apos;s expected value?</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setDiscount(BASELINE_TERMS.discountPct); setCredit(BASELINE_TERMS.creditDays); setDefault(BASELINE_TERMS.defaultPct); }}
          className="text-xs font-semibold text-cobalt-600 hover:text-cobalt-700 flex items-center gap-1 cursor-pointer self-start"
        >
          <RotateCcw size={12} /> Reset to baseline
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Slider id="terms-discount" label="Discount rate" unit="%" min={0} max={30} step={1} value={discountPct} baseline={BASELINE_TERMS.discountPct} onChange={setDiscount} />
        <Slider id="terms-credit" label="Credit days" unit=" d" min={15} max={90} step={5} value={creditDays} baseline={BASELINE_TERMS.creditDays} onChange={setCredit} />
        <Slider id="terms-default" label="Default probability" unit="%" min={0} max={20} step={0.5} value={defaultPct} baseline={BASELINE_TERMS.defaultPct} onChange={setDefault} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Baseline net collected</p>
          <p className="text-lg font-black font-mono tabular-nums text-slate-900" data-testid="terms-baseline">{usd(baseline.net)}</p>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{moved ? 'Scenario net collected' : 'Scenario (unchanged)'}</p>
          <p className="text-lg font-black font-mono tabular-nums text-slate-900" data-testid="terms-scenario">{usd(simulated.net)}</p>
        </div>
        <div className={`p-3 rounded-xl border ${delta < 0 ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Difference</p>
          <p className={`text-lg font-black font-mono tabular-nums ${delta < 0 ? 'text-rose-700' : 'text-emerald-700'}`} data-testid="terms-delta">
            {delta >= 0 ? '+' : ''}{usd(delta)}
          </p>
        </div>
      </div>

      <div className="h-56" role="img" aria-label="Baseline against scenario, by component">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => usd(Number(v))} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={92} />
            <Tooltip formatter={(v) => usd(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="Scenario" fill="#7c3aed" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="list-disc pl-4 text-[11px] text-slate-500 font-medium space-y-0.5">
        <li>Starting point: the pipeline&apos;s probability-weighted value ({usd(revenue)}), not a forecast.</li>
        <li>A discount lowers price one-for-one; <strong>no extra volume is assumed</strong> from discounting.</li>
        <li>Default probability is the share of invoiced value never collected; baseline is {BASELINE_TERMS.defaultPct}% (an assumption, not measured).</li>
        <li>Waiting for payment costs {DEFAULT_COST_OF_CAPITAL_PCT}% a year, pro-rated by credit days. Runs on a copy; your records are unchanged.</li>
      </ul>
    </section>
  );
};
