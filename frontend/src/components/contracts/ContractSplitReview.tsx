import React, { useMemo, useState } from 'react';
import { ChevronDown, FileText, Scale, Search, Gavel, Coins } from 'lucide-react';
import type { ContractAnalysisData } from './contractTypes';
import {
  RISK_SCORE_FORMULA,
  bandCounts,
  bandOf,
  contractRiskScore,
  extractObligations,
  findJurisdiction,
  findLiabilityCap,
  riskLabel,
  splitForHighlight,
  type RiskBand,
} from './contractReview';

const BAND_STYLE: Record<RiskBand, { label: string; pill: string; rail: string; dot: string }> = {
  critical: { label: 'Critical', pill: 'bg-rose-50 text-rose-700 border-rose-200', rail: 'border-l-rose-500', dot: 'bg-rose-500' },
  moderate: { label: 'Moderate', pill: 'bg-amber-50 text-amber-700 border-amber-200', rail: 'border-l-amber-400', dot: 'bg-amber-400' },
  standard: { label: 'Standard', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', rail: 'border-l-emerald-400', dot: 'bg-emerald-500' },
};

const Gauge: React.FC<{ score: number }> = ({ score }) => {
  const colour = score >= 60 ? '#e11d48' : score >= 40 ? '#f59e0b' : score >= 20 ? '#2563eb' : '#059669';
  const circumference = 2 * Math.PI * 42;
  return (
    <div className="relative w-28 h-28 shrink-0" role="img" aria-label={`Contract risk score ${score} out of 100`}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle
          cx="50" cy="50" r="42" fill="none" stroke={colour} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span data-testid="contract-risk-score" className="text-2xl font-black font-mono tabular-nums text-slate-900">{score}</span>
        <span className="text-[10px] font-bold text-slate-400">/ 100</span>
      </div>
    </div>
  );
};

const Panel: React.FC<{ title: string; icon: React.ReactNode; hint?: string; children: React.ReactNode; testId?: string }> = ({
  title, icon, hint, children, testId,
}) => (
  <section data-testid={testId} className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
    <header className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-slate-50/70">
      <span className="w-7 h-7 rounded-lg bg-cobalt-50 text-cobalt-700 border border-cobalt-100 flex items-center justify-center">{icon}</span>
      <div className="min-w-0">
        <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">{title}</h3>
        {hint && <p className="text-[11px] text-slate-500 font-medium truncate">{hint}</p>}
      </div>
    </header>
    <div className="p-4">{children}</div>
  </section>
);

/** Left: the document as extracted, with risk rails, search highlighting and page navigation. Right: three isolated analysis panels. */
export const ContractSplitReview: React.FC<{ contract: ContractAnalysisData }> = ({ contract }) => {
  const clauses = useMemo(() => contract.clauses ?? [], [contract.clauses]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<number | 'all'>('all');
  const [openClause, setOpenClause] = useState<string | null>(null);

  const pages = useMemo(
    () => Array.from(new Set(clauses.map((c) => c.source_page).filter((p): p is number => typeof p === 'number'))).sort((a, b) => a - b),
    [clauses],
  );
  const score = contractRiskScore(clauses);
  const counts = bandCounts(clauses);
  const jurisdiction = findJurisdiction(clauses);
  const cap = findLiabilityCap(clauses);
  const obligations = useMemo(() => extractObligations(clauses), [clauses]);

  const visible = clauses.filter((c) => page === 'all' || c.source_page === page);
  const keyOf = (i: number) => `${i}`;

  return (
    <div data-testid="contract-split" className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* LEFT: document viewer */}
      <section aria-label="Document viewer" className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden lg:sticky lg:top-2">
        <header className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/70">
          <FileText size={15} className="text-cobalt-600" />
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider truncate max-w-[14rem]" title={contract.document_name}>
            {contract.document_name}
          </h3>
          <div className="relative ml-auto w-full sm:w-52">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the document…"
              aria-label="Search the document"
              className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium focus:outline-none focus:border-cobalt-400"
            />
          </div>
        </header>

        {pages.length > 0 && (
          <nav aria-label="Pages" className="flex gap-1.5 px-4 py-2 border-b border-slate-100 overflow-x-auto">
            {(['all', ...pages] as const).map((p) => (
              <button
                key={String(p)}
                type="button"
                onClick={() => setPage(p)}
                aria-pressed={page === p}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                  page === p ? 'bg-cobalt-600 text-white border-cobalt-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {p === 'all' ? 'All pages' : `Page ${p}`}
              </button>
            ))}
          </nav>
        )}

        <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
          {visible.length === 0 && <p className="p-6 text-center text-xs font-medium text-slate-400">No extracted passages on this page.</p>}
          {visible.map((c, i) => {
            const band = bandOf(c);
            const text = c.original_text || '';
            const parts = splitForHighlight(text, query);
            const hasHit = query.trim() !== '' && parts.some((p) => p.hit);
            return (
              <article key={keyOf(i)} className={`px-4 py-3 border-l-4 ${BAND_STYLE[band].rail} ${query.trim() && !hasHit ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-extrabold text-slate-900">{c.clause_type}</span>
                  {c.source_page !== undefined && <span className="text-[10px] font-mono font-bold text-slate-400">p.{c.source_page}</span>}
                  <span className={`ml-auto text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${BAND_STYLE[band].pill}`}>{BAND_STYLE[band].label}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-700 font-medium">
                  {parts.map((p, j) =>
                    p.hit ? <mark key={j} className="bg-yellow-200 text-slate-900 rounded px-0.5">{p.text}</mark> : <React.Fragment key={j}>{p.text}</React.Fragment>,
                  )}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* RIGHT: three isolated containers */}
      <div className="space-y-5 min-w-0">
        <Panel title="Executive summary & legal scorecard" icon={<Gavel size={14} />} hint="Computed from the extracted clauses" testId="panel-scorecard">
          <div className="flex items-center gap-5 flex-wrap">
            <Gauge score={score} />
            <dl className="grid grid-cols-1 gap-2 text-xs min-w-0 flex-1">
              <div>
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Overall risk</dt>
                <dd className="font-extrabold text-slate-900">{riskLabel(score)}{contract.overall_risk_rating ? ` · ${contract.overall_risk_rating}` : ''}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Governing law / jurisdiction</dt>
                <dd className="font-bold text-slate-900" data-testid="contract-jurisdiction">{jurisdiction ?? 'Not stated in the extracted clauses'}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Liability exposure cap</dt>
                <dd className="font-bold text-slate-900 font-mono">{cap ?? 'Not stated'}</dd>
              </div>
            </dl>
          </div>
          <p className="mt-3 text-[11px] font-mono text-slate-400">{RISK_SCORE_FORMULA}</p>
          {contract.executive_summary && contract.executive_summary.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-slate-700 font-medium list-disc pl-4">
              {contract.executive_summary.slice(0, 4).map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </Panel>

        <Panel title="Risk breakdown & clause radar" icon={<Scale size={14} />} hint="Tap a clause for the mitigation" testId="panel-radar">
          <div className="flex flex-wrap gap-2 mb-3">
            {(['critical', 'moderate', 'standard'] as RiskBand[]).map((b) => (
              <span key={b} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-extrabold ${BAND_STYLE[b].pill}`}>
                <span className={`w-2 h-2 rounded-full ${BAND_STYLE[b].dot}`} />
                {BAND_STYLE[b].label}
                <span className="font-mono tabular-nums" data-testid={`band-count-${b}`}>{counts[b]}</span>
              </span>
            ))}
          </div>
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {clauses
              .map((c, i) => ({ c, i, band: bandOf(c) }))
              .sort((a, b) => ['critical', 'moderate', 'standard'].indexOf(a.band) - ['critical', 'moderate', 'standard'].indexOf(b.band))
              .map(({ c, i, band }) => {
                const open = openClause === keyOf(i);
                const advice = c.actionable_tip || c.red_flag_reason || c.simple_explanation || c.plain_explanation;
                return (
                  <li key={keyOf(i)}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenClause(open ? null : keyOf(i))}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 cursor-pointer"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${BAND_STYLE[band].dot}`} />
                      <span className="text-xs font-bold text-slate-900 flex-1 min-w-0 truncate">{c.clause_type}</span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="px-3 pb-3 text-xs text-slate-600 font-medium space-y-1.5">
                        {c.red_flag_reason && <p><strong className="text-rose-700">Why it is risky:</strong> {c.red_flag_reason}</p>}
                        {advice && <p><strong className="text-slate-800">Mitigation / guidance:</strong> {advice}</p>}
                        {!advice && !c.red_flag_reason && <p className="text-slate-400">No guidance was extracted for this clause.</p>}
                      </div>
                    )}
                  </li>
                );
              })}
            {clauses.length === 0 && <li className="p-4 text-xs text-slate-400 font-medium">No clauses were extracted.</li>}
          </ul>
        </Panel>

        <Panel title="Financial penalties & SLA commitments" icon={<Coins size={14} />} hint="Money and service obligations found in the clauses" testId="panel-obligations">
          {obligations.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium">No penalty, fee, SLA or confidentiality obligations were detected.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[420px]">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Clause</th>
                    <th className="py-2">Commitment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {obligations.map((o, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3 font-extrabold text-slate-800 whitespace-nowrap">{o.kind}</td>
                      <td className="py-2 pr-3 font-medium text-slate-600">{o.clause}</td>
                      <td className="py-2 font-mono font-bold text-slate-900">{o.impact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
