import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  FileCheck,
  Building,
  Target,
  Search,
  X,
  Globe,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react';
import { decisionForgeService } from '../../services/decisionForgeService';
import type { DecisionRunData, QueryResult, RecommendationItem } from '../../services/decisionForgeService';
import type { ScoreFlash } from './DecisionForgePage';

interface DecisionCenterTabProps {
  decisionData: DecisionRunData | null;
  isLoading: boolean;
  onOpenEvidence: (item: RecommendationItem) => void;
  onOpenApproval: (item: RecommendationItem) => void;
  onRunDecisions: () => void;
  onFetchContext: (item: RecommendationItem) => void;
  fetchingContextId: string | null;
  scoreFlash: ScoreFlash | null;
  /** recommendation_id -> approval status, for badges on cards already reviewed. */
  approvalStatus?: Record<string, string>;
}

const SUGGESTED_QUESTIONS = [
  'Which opportunities should we prioritize today?',
  'Which customers have gone cold?',
  'Which opportunities generated the highest expected value?',
  'Which regions are underperforming?',
  'What happens if we only pursue deals above $500,000?',
];

/** Colour by the backend's impact flag (sign- and direction-aware), never by the sign of the number alone. */
const IMPACT_STYLE: Record<string, string> = {
  positive: 'text-emerald-700',
  negative: 'text-rose-700',
  neutral: 'text-slate-500',
};

const leverValue = (lever: string, value: number) =>
  lever === 'min_deal_value' ? `$${Math.round(value).toLocaleString()}` : String(value);

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const STATUS_STYLE: Record<string, string> = {
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-slate-100 text-slate-600 border-slate-300',
  MODIFIED: 'bg-sky-50 text-sky-700 border-sky-200',
  REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  DRAFT: 'bg-slate-50 text-slate-500 border-slate-200',
};

export const DecisionCenterTab: React.FC<DecisionCenterTabProps> = ({
  decisionData,
  isLoading,
  onOpenEvidence,
  onOpenApproval,
  onRunDecisions,
  onFetchContext,
  fetchingContextId,
  scoreFlash,
  approvalStatus = {},
}) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<QueryResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [showTrail, setShowTrail] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const recommendations = decisionData?.recommendations || [];

  const visibleRecommendations = useMemo(() => {
    const ids = answer?.matched_ids;
    if (!ids || ids.length === 0) return recommendations;
    const idSet = new Set(ids);
    const filtered = recommendations.filter((r) => idSet.has(r.opportunity_id));
    return filtered.length ? filtered : recommendations;
  }, [recommendations, answer]);
  const isFiltered = visibleRecommendations.length !== recommendations.length;

  const runAsk = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setAskError(null);
    setShowTrail(false);
    try {
      setAnswer(await decisionForgeService.queryDecision(trimmed));
    } catch (err: any) {
      setAnswer(null);
      setAskError(err.response?.data?.message || err.response?.data?.detail || 'The question service is unavailable. Your dashboard data is unaffected.');
    } finally {
      setAsking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500">Computing deterministic priority scores & querying RAG notes...</p>
      </div>
    );
  }

  if (!decisionData || !decisionData.recommendations || decisionData.recommendations.length === 0) {
    return (
      <div className="text-center py-20 bg-white/70 rounded-2xl border border-slate-200 p-8 shadow-sm">
        <Target className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">No Decision Analysis Run Yet</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
          Execute the deterministic decision engine against your CRM dataset to rank opportunities by expected value, engagement, and market signals.
        </p>
        <button
          onClick={onRunDecisions}
          className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl text-xs font-bold shadow-md hover:from-rose-500 hover:to-red-500 transition"
        >
          Run Decision Engine Now
        </button>
      </div>
    );
  }

  const { pipeline_total_value, weighted_pipeline_value, high_priority_count, stale_warning_count } = decisionData;
  const highThreshold = decisionData.policy?.high_priority_threshold ?? 75;
  const staleDays = decisionData.policy?.stale_days_threshold ?? 30;
  const isSynthetic = !!decisionData.dataset_key && decisionData.dataset_key !== 'real';

  return (
    <div className="space-y-6">
      {isSynthetic && (
        <div className="flex items-start gap-2 text-xs text-sky-900 bg-sky-50 border border-sky-200 rounded-xl p-3">
          <ShieldAlert className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Synthetic dataset.</strong> Companies, deal values, activities and notes are generated for scale and
            evaluation; they are not real customers or real sources.
          </span>
        </div>
      )}

      {/* Ask a Question Bar */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <input
            id="decision-center-ask-input"
            type="text"
            value={question}
            maxLength={500}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runAsk(question)}
            placeholder="Ask a question about this pipeline, e.g. “Which customers have gone cold?”"
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/15 text-xs font-semibold text-slate-800 placeholder-slate-400 transition"
          />
          <button
            onClick={() => runAsk(question)}
            disabled={!question.trim() || asking}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition flex-shrink-0"
          >
            {asking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Ask
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => {
                setQuestion(q);
                runAsk(q);
              }}
              className="px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-[11px] font-semibold text-slate-500 transition"
            >
              {q}
            </button>
          ))}
        </div>

        {askError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">{askError}</div>
        )}

        {answer && (
          <div className="p-4 bg-rose-50/60 border border-rose-200/70 rounded-xl space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                Answer · <span className="text-slate-500 normal-case">ANALYSIS (computed, not generated)</span>
              </span>
              <button
                onClick={() => setAnswer(null)}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear filter, show all
              </button>
            </div>
            <p className="text-xs text-slate-800 leading-relaxed">{answer.answer}</p>

            <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
              <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                Confidence {Math.round(answer.confidence * 100)}%
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                Intent: {answer.plan.intent.replace(/_/g, ' ')}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                Planner: {answer.plan.planner === 'rules_fallback' ? 'rules (LLM unavailable)' : answer.plan.planner}
              </span>
              {answer.human_review_required && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800">Human review required</span>
              )}
            </div>

            {answer.scenario?.levers && answer.scenario.levers.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold" data-testid="scenario-levers">
                <span className="text-slate-500 uppercase tracking-wider">Applied</span>
                {answer.scenario.levers.map((lv) => (
                  <span key={lv.lever} className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-200 text-rose-800" title={lv.note}>
                    {lv.label}: {leverValue(lv.lever, lv.baseline)} → {leverValue(lv.lever, lv.scenario)}
                  </span>
                ))}
              </div>
            )}

            {answer.scenario?.simulation && (
              <div className="bg-white/80 border border-slate-200 rounded-lg overflow-hidden" data-testid="scenario-comparison">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-700">Baseline vs scenario</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                    {answer.scenario.simulation.label || 'Scenario estimate'} · not a forecast
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-3 py-1.5 font-semibold">Metric</th>
                        <th className="px-3 py-1.5 font-semibold">Baseline</th>
                        <th className="px-3 py-1.5 font-semibold">Scenario</th>
                        <th className="px-3 py-1.5 font-semibold">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {answer.scenario.simulation.comparisons.map((c) => (
                        <tr key={c.parameter} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 text-slate-700">{c.parameter}</td>
                          <td className="px-3 py-1.5 font-mono text-slate-600 whitespace-nowrap">{String(c.baseline)}</td>
                          <td className="px-3 py-1.5 font-mono text-slate-900 font-semibold whitespace-nowrap">{String(c.scenario)}</td>
                          <td className={`px-3 py-1.5 font-mono font-semibold whitespace-nowrap ${IMPACT_STYLE[c.impact] || IMPACT_STYLE.neutral}`}>
                            {String(c.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <details className="px-3 py-2 border-t border-slate-100 text-[11px] text-slate-600">
                  <summary className="cursor-pointer font-semibold">Assumptions and limits</summary>
                  <ul className="mt-1 space-y-1 list-disc pl-4">
                    {(answer.scenario.simulation.assumptions || []).map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-slate-500">{answer.scenario.simulation.disclaimer}</p>
                </details>
              </div>
            )}

            {answer.rag.status === 'insufficient_evidence' && (
              <p className="text-[11px] text-amber-800">Insufficient evidence from rep notes for this question.</p>
            )}
            {[...answer.warnings, ...answer.fallbacks].map((w, i) => (
              <p key={i} className="text-[11px] text-amber-800 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {w}
              </p>
            ))}

            <button
              onClick={() => setShowTrail((v) => !v)}
              className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-1"
            >
              {showTrail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              How this answer was produced
            </button>
            {showTrail && (
              <div className="text-[11px] text-slate-600 space-y-2 bg-white/70 border border-slate-200 rounded-lg p-3">
                <p>
                  <strong>Steps:</strong> {answer.trace.map((t) => `${t.step} (${t.latency_ms}ms)`).join(' → ')}
                </p>
                {answer.analytics.map((a, i) => (
                  <p key={i}>
                    <strong>{a.tool}:</strong> <span className="font-mono">{a.definition}</span>
                  </p>
                ))}
                {answer.rag.evidence.length > 0 && (
                  <div>
                    <strong>Evidence (rep notes):</strong>
                    <ul className="mt-1 space-y-1">
                      {answer.rag.evidence.slice(0, 5).map((e) => (
                        <li key={e.doc_id} className="border-l-2 border-rose-300 pl-2">
                          “{e.text}” <span className="text-slate-400 font-mono">[{e.doc_id} · {e.record_id}]</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <p className="text-[10px] font-mono text-slate-400">
              Snapshot {answer.snapshot_id} · {answer.basis}
            </p>
          </div>
        )}
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Total CRM Pipeline</span>
            <Building className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">${pipeline_total_value.toLocaleString()}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">{recommendations.length} active opportunities</span>
        </div>

        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 text-xs font-semibold mb-1">
            <span>Weighted Expected Value</span>
            <TrendingUp className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">${weighted_pipeline_value.toLocaleString()}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Deal value × win probability (records with a valid probability)</span>
        </div>

        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold mb-1">
            <span>Immediate Actions</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{high_priority_count} Deals</div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">Priority Score ≥ {highThreshold}</span>
        </div>

        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold mb-1">
            <span>Stale Data Warnings</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{stale_warning_count} Deals</div>
          <span className="text-[11px] text-amber-600 font-medium mt-1 block">Untouched &gt; {staleDays} days</span>
        </div>
      </div>

      {/* Recommendations Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Ranked Decision Recommendations
              {isFiltered && (
                <span className="ml-2 text-xs font-semibold text-rose-600">({visibleRecommendations.length} matching your question)</span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Deterministic priority scoring · data as of {new Date(decisionData.data_snapshot).toLocaleDateString()}
              {decisionData.snapshot_id ? ` · snapshot ${decisionData.snapshot_id}` : ''}
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200">
            Policy: {decisionData.policy_version}
          </span>
        </div>

        <div className="space-y-3">
          {visibleRecommendations.map((rec) => {
            const isHigh = rec.decision_class === 'IMMEDIATE_ACTION';
            const isMedium = rec.decision_class === 'PROCEED_WITH_QUALIFICATION';
            const isFetchingThis = fetchingContextId === rec.opportunity_id;
            const flash = scoreFlash?.opportunityId === rec.opportunity_id ? scoreFlash : null;
            const status = approvalStatus[rec.recommendation_id];
            const isOpen = !!expanded[rec.recommendation_id];
            const topFactors = [...rec.factors].sort((a, b) => b.weighted_contribution - a.weighted_contribution).slice(0, 2);
            const warnings = rec.warnings || [];

            return (
              <div
                key={rec.recommendation_id}
                className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-bold border ${
                        isHigh
                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                          : isMedium
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <span className="text-base leading-none">{rec.priority_score}</span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">Score</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-slate-900">{rec.company_name}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isHigh
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isMedium
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {rec.decision_class.replace(/_/g, ' ')}
                        </span>
                        {status && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[status] || STATUS_STYLE.DRAFT}`}>
                            {status === 'REVIEW' ? 'IN REVIEW' : status}
                          </span>
                        )}
                        {rec.review_required && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            HUMAN REVIEW REQUIRED
                          </span>
                        )}
                        {flash && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-mono">
                            {flash.before} → {flash.after} {flash.after >= flash.before ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                        <span>Contact: <strong className="text-slate-700">{rec.contact_name}</strong></span>
                        <span>•</span>
                        <span>Industry: <strong className="text-slate-700">{rec.industry}</strong></span>
                        {rec.confidence !== undefined && (
                          <>
                            <span>•</span>
                            <span>Confidence: <strong className="text-slate-700">{Math.round(rec.confidence * 100)}%</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-xs text-slate-400 block">Opportunity Value</span>
                      <span className="text-lg font-bold text-slate-900">{money(rec.deal_value)}</span>
                    </div>
                    <div className="border-l border-slate-200 pl-4">
                      <span className="text-xs text-slate-400 block">Win Probability</span>
                      <span className="text-lg font-bold text-rose-600">{Math.round(rec.win_probability * 100)}%</span>
                    </div>
                  </div>
                </div>

                {/* Why, in one line */}
                <p className="text-xs text-slate-600">
                  <strong className="text-slate-800">Why:</strong>{' '}
                  strongest drivers are {topFactors.map((f) => `${f.name} (${signed(f.weighted_contribution)} pts)`).join(' and ')}.
                </p>

                {/* Warnings: stale data and data-quality problems are never hidden */}
                {rec.stale_data_warning && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>{rec.stale_data_warning}</span>
                  </div>
                )}
                {warnings
                  .filter((w) => w !== rec.stale_data_warning && !w.startsWith('Last contact was'))
                  .map((w, i) => (
                    <div key={i} className="p-2.5 bg-amber-50/60 border border-amber-200/70 rounded-lg flex items-center gap-2 text-[11px] text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}

                {/* Expandable technical factors */}
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [rec.recommendation_id]: !e[rec.recommendation_id] }))}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Why this score?
                </button>
                {isOpen && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    {rec.factors.map((f, i) => (
                      <div
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-1.5"
                      >
                        <span>{f.name}:</span>
                        <span className="font-bold text-slate-800">{f.raw_value}</span>
                        <span className={`font-bold ${f.weighted_contribution < 0 ? 'text-amber-700' : 'text-rose-600'}`}>
                          ({signed(f.weighted_contribution)})
                        </span>
                      </div>
                    ))}
                    <div className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold">
                      = {rec.priority_score} / 100
                    </div>
                  </div>
                )}

                {/* Recommended Action & CTA */}
                <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 p-3 rounded-xl">
                  <div className="text-xs text-slate-700 flex items-start gap-2">
                    <FileCheck className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900">Recommended Action: </span>
                      <span>{rec.suggested_action}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {rec.external_context_available && !rec.external_context_fetched && (
                      <button
                        onClick={() => onFetchContext(rec)}
                        disabled={isFetchingThis}
                        className="px-3.5 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 disabled:opacity-60 rounded-lg shadow-sm transition flex items-center gap-1.5"
                        title="Retrieve the cited public context for this account and recalculate its score (optional)"
                      >
                        {isFetchingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                        {isFetchingThis ? 'Fetching...' : 'Fetch fresh context'}
                      </button>
                    )}
                    <button
                      onClick={() => onOpenEvidence(rec)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition"
                    >
                      View Evidence
                    </button>
                    <button
                      onClick={() => onOpenApproval(rec)}
                      disabled={status === 'APPROVED' || status === 'REJECTED'}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-40 rounded-lg shadow-sm flex items-center gap-1.5 transition"
                    >
                      {status === 'APPROVED' || status === 'REJECTED' ? 'Decided' : 'Review & Approve'}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
