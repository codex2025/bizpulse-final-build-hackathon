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
  Loader2
} from 'lucide-react';
import type { DecisionRunData, RecommendationItem } from '../../services/decisionForgeService';
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
}

const SUGGESTED_QUESTIONS = [
  'Which opportunities should we prioritize today?',
  'Which customers have gone cold?',
  'Which opportunities generated the highest expected value?',
  'Which regions are underperforming?',
];

interface AskAnswer {
  question: string;
  text: string;
  matchedIds: string[] | null;
}

function answerQuestion(question: string, recs: RecommendationItem[], data: DecisionRunData): AskAnswer {
  const q = question.toLowerCase();
  const top = (n: number) => [...recs].sort((a, b) => b.priority_score - a.priority_score).slice(0, n);
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  if (/cold|stale|untouched|gone quiet/.test(q)) {
    const stale = recs.filter((r) => r.stale_data_warning);
    return {
      question,
      matchedIds: stale.map((r) => r.opportunity_id),
      text: stale.length
        ? `${stale.length} opportunit${stale.length === 1 ? 'y has' : 'ies have'} gone cold (no contact in 30+ days): ${stale.map((r) => r.company_name).join(', ')}.`
        : `No opportunities are currently flagged stale — every account in this dataset was contacted within the last 30 days.`,
    };
  }

  if (/highest.*(value|expected)|expected value|biggest deal|most valuable/.test(q)) {
    const ranked = [...recs].sort((a, b) => b.deal_value * b.win_probability - a.deal_value * a.win_probability).slice(0, 3);
    return {
      question,
      matchedIds: ranked.map((r) => r.opportunity_id),
      text: `Ranked by expected value (deal size × win probability): ${ranked.map((r) => `${r.company_name} (${fmt(r.deal_value * r.win_probability)})`).join(', ')}.`,
    };
  }

  if (/region|location|state|underperform/.test(q)) {
    const groups: Record<string, RecommendationItem[]> = {};
    recs.forEach((r) => {
      const loc = (r.evidence_pack?.structured_data?.location as string) || 'Unknown';
      const state = loc.split(',').pop()?.trim() || 'Unknown';
      (groups[state] ||= []).push(r);
    });
    const ranked = Object.entries(groups)
      .map(([state, items]) => ({ state, avg: items.reduce((s, r) => s + r.priority_score, 0) / items.length, items }))
      .sort((a, b) => a.avg - b.avg);
    const worst = ranked[0];
    return {
      question,
      matchedIds: worst ? worst.items.map((r) => r.opportunity_id) : null,
      text: worst
        ? `${worst.state} has the lowest average priority score (${worst.avg.toFixed(1)}) across ${worst.items.length} opportunit${worst.items.length === 1 ? 'y' : 'ies'}: ${worst.items.map((r) => r.company_name).join(', ')}.`
        : 'No location data available to group by region.',
    };
  }

  if (/today|prioriti[sz]e|contact|act now|focus|deserve attention/.test(q)) {
    const immediate = recs.filter((r) => r.decision_class === 'IMMEDIATE_ACTION');
    const list = immediate.length ? immediate : top(3);
    return {
      question,
      matchedIds: list.map((r) => r.opportunity_id),
      text: `${list.length} opportunit${list.length === 1 ? 'y needs' : 'ies need'} attention today: ${list.map((r) => `${r.company_name} (${r.priority_score})`).join(', ')}.`,
    };
  }

  if (/changed|this week|update|new/.test(q)) {
    return {
      question,
      matchedIds: null,
      text: `Run ${data.decision_run_id} (policy ${data.policy_version}, snapshot ${new Date(data.data_snapshot).toLocaleDateString()}): ${data.high_priority_count} of ${recs.length} opportunities are at "act now", ${data.stale_warning_count} carry stale-data warnings. Open Approvals & Audit Replay to compare against an earlier run.`,
    };
  }

  const list = top(3);
  return {
    question,
    matchedIds: list.map((r) => r.opportunity_id),
    text: `Top ${list.length} by priority score: ${list.map((r) => `${r.company_name} (${r.priority_score})`).join(', ')}. Total pipeline ${fmt(data.pipeline_total_value)}, weighted by win probability ${fmt(data.weighted_pipeline_value)}.`,
  };
}

export const DecisionCenterTab: React.FC<DecisionCenterTabProps> = ({
  decisionData,
  isLoading,
  onOpenEvidence,
  onOpenApproval,
  onRunDecisions,
  onFetchContext,
  fetchingContextId,
  scoreFlash,
}) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskAnswer | null>(null);

  const recommendations = useMemo(() => decisionData?.recommendations || [], [decisionData?.recommendations]);

  const visibleRecommendations = useMemo(() => {
    if (!answer?.matchedIds) return recommendations;
    const idSet = new Set(answer.matchedIds);
    return recommendations.filter((r) => idSet.has(r.opportunity_id));
  }, [recommendations, answer]);

  const runAsk = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || !decisionData) return;
    setAnswer(answerQuestion(trimmed, recommendations, decisionData));
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

  return (
    <div className="space-y-6">
      {/* Ask a Question Bar (FR-009 / UC-003) */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <input
            id="decision-center-ask-input"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runAsk(question)}
            placeholder="Ask a question about this pipeline, e.g. “Which customers have gone cold?”"
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/15 text-xs font-semibold text-slate-800 placeholder-slate-400 transition"
          />
          <button
            onClick={() => runAsk(question)}
            disabled={!question.trim()}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition flex-shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
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

        {answer && (
          <div className="p-4 bg-rose-50/60 border border-rose-200/70 rounded-xl space-y-1.5 animate-fadeIn">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Answer</span>
              <button
                onClick={() => setAnswer(null)}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear filter, show all
              </button>
            </div>
            <p className="text-xs text-slate-800 leading-relaxed">{answer.text}</p>
            <p className="text-[10px] font-mono text-slate-400">
              Based on {recommendations.length} records from run {decisionData.decision_run_id} · deterministic template, no external retrieval triggered
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
          <span className="text-[11px] text-slate-500 mt-1 block">{recommendations.length} total active opportunities</span>
        </div>

        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 text-xs font-semibold mb-1">
            <span>Weighted Expected Value</span>
            <TrendingUp className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">${weighted_pipeline_value.toLocaleString()}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Factored by historical win velocity</span>
        </div>

        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold mb-1">
            <span>Immediate Actions</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{high_priority_count} Deals</div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">Priority Score ≥ 75.0</span>
        </div>

        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold mb-1">
            <span>Stale Data Warnings</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{stale_warning_count} Deals</div>
          <span className="text-[11px] text-amber-600 font-medium mt-1 block">Untouched &gt; 30 days</span>
        </div>
      </div>

      {/* Recommendations Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Ranked Decision Recommendations
              {answer?.matchedIds && (
                <span className="ml-2 text-xs font-semibold text-rose-600">({visibleRecommendations.length} matching your question)</span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Deterministic priority scoring based on deal size, win probability, engagement, recency, and fresh external signals.
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

            return (
              <div
                key={rec.recommendation_id}
                className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {/* Score Progress Badge */}
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
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-xs text-slate-400 block">Opportunity Value</span>
                      <span className="text-lg font-bold text-slate-900">${rec.deal_value.toLocaleString()}</span>
                    </div>
                    <div className="border-l border-slate-200 pl-4">
                      <span className="text-xs text-slate-400 block">Est. Win Rate</span>
                      <span className="text-lg font-bold text-rose-600">{Math.round(rec.win_probability * 100)}%</span>
                    </div>
                  </div>
                </div>

                {/* Stale Warning Alert */}
                {rec.stale_data_warning && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>{rec.stale_data_warning}</span>
                  </div>
                )}

                {/* Factor Contribution Chips */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  {rec.factors.map((f, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-1.5"
                    >
                      <span>{f.name}:</span>
                      <span className="font-bold text-slate-800">{f.raw_value}</span>
                      <span className="font-bold text-rose-600">(+{f.weighted_contribution})</span>
                    </div>
                  ))}
                </div>

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
                        title="Retrieve fresh public context for this account and recalculate its score"
                      >
                        {isFetchingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                        {isFetchingThis ? 'Fetching...' : 'Fetch fresh context'}
                      </button>
                    )}
                    <button
                      onClick={() => onOpenEvidence(rec)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition"
                    >
                      View Evidence Pack
                    </button>
                    <button
                      onClick={() => onOpenApproval(rec)}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-lg shadow-sm flex items-center gap-1.5 transition"
                    >
                      Review & Approve
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
