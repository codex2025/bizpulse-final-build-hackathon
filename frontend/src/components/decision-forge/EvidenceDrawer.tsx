import React, { useState } from 'react';
import { X, Database, FileText, Globe, Clock, ShieldCheck, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import type { RecommendationItem } from '../../services/decisionForgeService';

interface EvidenceDrawerProps {

  recommendation: RecommendationItem | null;
  onClose: () => void;
  onApprove: (item: RecommendationItem) => void;
  onFetchContext: (item: RecommendationItem) => void;
  fetchingContextId: string | null;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  recommendation,
  onClose,
  onApprove,
  onFetchContext,
  fetchingContextId,
}) => {
  const [activeTab, setActiveTab] = useState<'structured' | 'rag' | 'external'>('structured');

  if (!recommendation) return null;

  const { evidence_pack, factors } = recommendation;
  const ext = evidence_pack.external_signal;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end animate-fadeIn">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-50 text-rose-600 border border-rose-200">
                Evidence Provenance
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {recommendation.opportunity_id}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {recommendation.company_name}
            </h2>
            <p className="text-xs text-slate-500">
              Deterministic Priority Score: <span className="font-bold text-rose-600">{recommendation.priority_score} / 100</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab('structured')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'structured'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            Structured Facts
          </button>
          <button
            onClick={() => setActiveTab('rag')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'rag'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            CRM Sales Notes (RAG)
          </button>
          <button
            onClick={() => setActiveTab('external')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'external'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            External Signals & Web
            {ext ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Fetched"></span>
            ) : recommendation.external_context_available ? (
              <span className="w-2 h-2 rounded-full bg-sky-400" title="Available, not yet fetched"></span>
            ) : null}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'structured' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Canonical Database Fields (Single Source of Truth)
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Deal Value:</span>
                    <span className="font-semibold text-slate-800 text-sm">{evidence_pack.structured_data.deal_value}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Pipeline Stage:</span>
                    <span className="font-semibold text-slate-800">{evidence_pack.structured_data.stage}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Account Owner:</span>
                    <span className="font-semibold text-slate-800">{evidence_pack.structured_data.owner}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Location:</span>
                    <span className="font-semibold text-slate-800">{evidence_pack.structured_data.location}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Factor Contributions to Final Score
                </h4>
                <div className="space-y-2">
                  {factors.map((f, i) => (
                    <div key={i} className="p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium text-slate-800">{f.name}</span>
                        <span className="font-bold text-rose-600">+{f.weighted_contribution} pts</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{f.description}</p>
                      <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full"
                          style={{ width: `${f.score}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rag' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-amber-50 p-3 rounded-lg border border-amber-200/60">
                <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  Semantic retrieval from rep activity logs stored in isolated vector collections.
                </span>
              </div>

              {evidence_pack.rag_notes && evidence_pack.rag_notes.length > 0 ? (
                evidence_pack.rag_notes.map((note, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-700">Verified CRM Note #{idx + 1}</span>
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <Clock className="w-3 h-3" /> Source Verified
                      </span>
                    </div>
                    <blockquote className="text-xs text-slate-700 italic border-l-2 border-rose-400 pl-3 leading-relaxed">
                      "{note.snippet}"
                    </blockquote>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-xs text-slate-400">
                  No unstructured notes indexed for this opportunity.
                </div>
              )}
            </div>
          )}

          {activeTab === 'external' && (
            <div className="space-y-4">
              {ext ? (
                <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                      {ext.freshness_status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Retrieved {new Date(ext.retrieved_at).toLocaleString()}
                      {ext.published_at && ` · Published ${new Date(ext.published_at).toLocaleDateString()}`}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {ext.title}
                  </h3>

                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <strong className="text-slate-800">Impact Assessment: </strong>
                    {ext.impact_summary}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500">
                    <span>Source: {ext.source}</span>
                    <a
                      href={ext.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-rose-600 hover:text-rose-700 flex items-center gap-1 font-medium"
                    >
                      Verify Source <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ) : recommendation.external_context_available ? (
                <div className="text-center py-10 text-slate-500 space-y-3">
                  <Globe className="w-8 h-8 mx-auto text-sky-400" />
                  <p className="text-xs font-semibold text-slate-700">A validated external signal is available for this account, but hasn't been checked yet.</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">Until it's fetched, this factor sits at a neutral baseline in the score above — external context never changes a decision silently.</p>
                  <button
                    onClick={() => onFetchContext(recommendation)}
                    disabled={fetchingContextId === recommendation.opportunity_id}
                    className="mx-auto px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition"
                  >
                    {fetchingContextId === recommendation.opportunity_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                    {fetchingContextId === recommendation.opportunity_id ? 'Fetching...' : 'Fetch fresh context now'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Globe className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs">No external public signal is available for this account.</p>
                  <p className="text-[11px] text-slate-400">Internal decision factors apply baseline weights.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition"
          >
            Close Provenance
          </button>
          <button
            onClick={() => {
              onClose();
              onApprove(recommendation);
            }}
            className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-lg shadow-sm flex items-center gap-2 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Proceed to Action Approval
          </button>
        </div>
      </div>
    </div>
  );
};
