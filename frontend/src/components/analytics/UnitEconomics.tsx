import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator } from 'lucide-react';
import { clientService, invoiceService, expenseService } from '../../services/invoiceService';
import { cac, ltv, ltvToCac, nrr, paybackMonths, quickRatio } from '../../utils/unitEconomics';

interface Props {
  since: Date;
  windowMonths: number;
}

const inr = (n: number | null) => (n === null ? null : '₹' + Math.round(n).toLocaleString('en-IN'));
const num = (v: string): number | null => {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const Field: React.FC<{ id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; suffix?: string }> = ({
  id, label, hint, value, onChange, suffix,
}) => (
  <label htmlFor={id} className="block space-y-1">
    <span className="text-[11px] font-bold text-slate-600">{label}</span>
    <span className="flex items-center gap-1">
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="enter"
        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-cobalt-400"
      />
      {suffix && <span className="text-[11px] font-bold text-slate-400">{suffix}</span>}
    </span>
    {hint && <span className="block text-[10px] text-slate-400 font-medium">{hint}</span>}
  </label>
);

const Metric: React.FC<{ label: string; value: string | null; formula: string; testId: string }> = ({ label, value, formula, testId }) => (
  <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1">
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
    <p data-testid={testId} className={`text-2xl font-black font-mono tabular-nums ${value ? 'text-slate-900' : 'text-slate-300'}`}>{value ?? '—'}</p>
    <p className="text-[10px] font-mono text-slate-400">{formula}</p>
  </div>
);

/** Unit economics from the ledger plus inputs only the owner knows. Nothing is shown until its inputs exist. */
export const UnitEconomics: React.FC<Props> = ({ since, windowMonths }) => {
  const { data: invoices } = useQuery({ queryKey: ['invoices'], queryFn: invoiceService.getAll, staleTime: 30_000 });
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: clientService.getAll, staleTime: 30_000 });
  const { data: expenses } = useQuery({ queryKey: ['expenses'], queryFn: expenseService.getAll, staleTime: 30_000 });

  // Defaults derived from the ledger (editable below).
  const derived = useMemo(() => {
    const inv = (Array.isArray(invoices) ? invoices : []).filter(
      (i: { issue_date?: string }) => !i.issue_date || new Date(i.issue_date) >= since,
    );
    const revenue = inv.reduce((s: number, i: { subtotal?: number; total_amount?: number }) => s + Number(i.subtotal ?? i.total_amount ?? 0), 0);
    const billedClients = new Set(inv.map((i: { client_id?: string }) => i.client_id).filter(Boolean)).size;
    const newCustomers = (Array.isArray(clients) ? clients : []).filter(
      (c: { created_at?: string }) => c.created_at && new Date(c.created_at) >= since,
    ).length;
    const marketing = (Array.isArray(expenses) ? expenses : [])
      .filter((e: { category?: string; expense_date?: string }) => /market|advert|sales|acquisition|promo/i.test(e.category || '') && (!e.expense_date || new Date(e.expense_date) >= since))
      .reduce((s: number, e: { amount?: number }) => s + Number(e.amount || 0), 0);
    return {
      arpa: billedClients > 0 ? revenue / billedClients / Math.max(1, windowMonths) : null,
      newCustomers: newCustomers > 0 ? newCustomers : null,
      spend: marketing > 0 ? marketing : null,
    };
  }, [invoices, clients, expenses, since, windowMonths]);

  const [arpa, setArpa] = useState<string | null>(null);
  const [margin, setMargin] = useState('');
  const [churn, setChurn] = useState('');
  const [newCust, setNewCust] = useState<string | null>(null);
  const [spend, setSpend] = useState<string | null>(null);
  const [mrrStart, setMrrStart] = useState('');
  const [expansion, setExpansion] = useState('0');
  const [contraction, setContraction] = useState('0');
  const [churnMrr, setChurnMrr] = useState('0');
  const [newMrr, setNewMrr] = useState('0');

  const arpaN = arpa !== null ? num(arpa) : derived.arpa;
  const newN = newCust !== null ? num(newCust) : derived.newCustomers;
  const spendN = spend !== null ? num(spend) : derived.spend;

  const c = cac(spendN, newN);
  const l = ltv(arpaN, num(margin), num(churn));
  const ratio = ltvToCac(l, c);
  const payback = paybackMonths(c, arpaN, num(margin));
  const retention = nrr(num(mrrStart), num(expansion) ?? 0, num(contraction) ?? 0, num(churnMrr) ?? 0);
  const quick = quickRatio(num(newMrr) ?? 0, num(expansion) ?? 0, num(contraction) ?? 0, num(churnMrr) ?? 0);

  return (
    <section data-testid="unit-economics" aria-label="Unit economics" className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-cobalt-50 text-cobalt-700 border border-cobalt-100 flex items-center justify-center"><Calculator size={16} /></span>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Inputs</h3>
            <p className="text-xs text-slate-500 font-medium">
              Values marked from your ledger are pre-filled and editable. Margin, churn and recurring-revenue movements are not recorded anywhere, so enter them.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Field id="ue-arpa" label="Revenue per customer / month" suffix="₹" value={arpa ?? (derived.arpa !== null ? String(Math.round(derived.arpa)) : '')} onChange={setArpa} hint={derived.arpa !== null ? 'from your invoices' : 'no invoices in this window'} />
          <Field id="ue-margin" label="Gross margin" suffix="%" value={margin} onChange={setMargin} />
          <Field id="ue-churn" label="Monthly customer churn" suffix="%" value={churn} onChange={setChurn} />
          <Field id="ue-newcust" label="New customers in period" value={newCust ?? (derived.newCustomers !== null ? String(derived.newCustomers) : '')} onChange={setNewCust} hint={derived.newCustomers !== null ? 'clients added in this window' : undefined} />
          <Field id="ue-spend" label="Acquisition spend" suffix="₹" value={spend ?? (derived.spend !== null ? String(Math.round(derived.spend)) : '')} onChange={setSpend} hint={derived.spend !== null ? 'sales / marketing expenses' : 'no marketing expenses found'} />
          <Field id="ue-mrr" label="Recurring revenue at start" suffix="₹" value={mrrStart} onChange={setMrrStart} />
          <Field id="ue-newmrr" label="New recurring revenue" suffix="₹" value={newMrr} onChange={setNewMrr} />
          <Field id="ue-exp" label="Expansion" suffix="₹" value={expansion} onChange={setExpansion} />
          <Field id="ue-con" label="Contraction" suffix="₹" value={contraction} onChange={setContraction} />
          <Field id="ue-chm" label="Churned recurring revenue" suffix="₹" value={churnMrr} onChange={setChurnMrr} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <Metric testId="ue-cac" label="CAC" value={inr(c)} formula="spend ÷ new customers" />
        <Metric testId="ue-ltv" label="LTV" value={inr(l)} formula="revenue × margin ÷ churn" />
        <Metric testId="ue-ratio" label="LTV : CAC" value={ratio === null ? null : `${ratio.toFixed(1)} : 1`} formula="LTV ÷ CAC (3:1+ is healthy)" />
        <Metric testId="ue-payback" label="CAC payback" value={payback === null ? null : `${payback.toFixed(1)} mo`} formula="CAC ÷ (revenue × margin)" />
        <Metric testId="ue-nrr" label="Net revenue retention" value={retention === null ? null : `${retention.toFixed(1)}%`} formula="(start + exp − con − churn) ÷ start" />
        <Metric testId="ue-quick" label="Quick ratio" value={quick === null ? null : quick.toFixed(2)} formula="(new + exp) ÷ (con + churn)" />
      </div>
    </section>
  );
};
