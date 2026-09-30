import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Sliders,
  UploadCloud,
  History,
  Play,
  RotateCcw,
  CheckCircle2,
  SlidersHorizontal,
  Compass,
  Building
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Topbar } from '../common/Topbar';
import { DecisionProgressionEvaluator } from './DecisionProgressionEvaluator';
import { DecisionCenterTab } from './DecisionCenterTab';
import { DecisionTwinTab } from './DecisionTwinTab';
import { DataIngestionTab } from './DataIngestionTab';
import { AuditTrailTab } from './AuditTrailTab';
import { EvidenceDrawer } from './EvidenceDrawer';
import { ApprovalModal } from './ApprovalModal';
import { PolicyModal } from './PolicyModal';
import { decisionForgeService } from '../../services/decisionForgeService';
import type { DatasetKey, DecisionRunData, RecommendationItem } from '../../services/decisionForgeService';
import { usePrefersReducedMotion, EASE_FINANCIAL } from '../../utils/motion';

export interface ScoreFlash {
  opportunityId: string;
  before: number;
  after: number;
}

export const DecisionForgePage: React.FC = () => {
  const navigate = useNavigate();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeTab, setActiveTab] = useState<'evaluator' | 'center' | 'twin' | 'ingestion' | 'audit'>('evaluator');
  const [decisionData, setDecisionData] = useState<DecisionRunData | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Modals / Drawers state
  const [evidenceItem, setEvidenceItem] = useState<RecommendationItem | null>(null);
  const [approvalItem, setApprovalItem] = useState<RecommendationItem | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);

  // Per-opportunity "fetch fresh context" state
  const [fetchingContextId, setFetchingContextId] = useState<string | null>(null);
  const [scoreFlash, setScoreFlash] = useState<ScoreFlash | null>(null);
  // recommendation_id -> approval status, so reviewed items keep their badge across re-runs
  const [approvalStatus, setApprovalStatus] = useState<Record<string, string>>({});

  const fetchDecisions = async () => {
    setIsLoading(true);
    try {
      const data = await decisionForgeService.runDecisions();
      setDecisionData(data);
      if (data.recommendations.length > 0 && !selectedOpportunityId) {
        setSelectedOpportunityId(data.recommendations[0].opportunity_id);
      }
    } catch (err: unknown) {
      console.error('Error running decisions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshApprovals = async () => {
    try {
      const rows: Array<{ recommendationId: string; status: string }> = await decisionForgeService.getApprovals();
      setApprovalStatus(Object.fromEntries(rows.map((r) => [r.recommendationId, r.status])));
    } catch {
      // Non-fatal: badges simply don't render.
    }
  };

  useEffect(() => {
    fetchDecisions();
    refreshApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening the approval dialog moves the recommendation DRAFT -> REVIEW (best effort).
  const handleOpenApproval = (item: RecommendationItem) => {
    setApprovalItem(item);
    decisionForgeService
      .startReview(item.recommendation_id, item.decision_run_id)
      .then(refreshApprovals)
      .catch(() => undefined);
  };

  const handleResetDemo = async (dataset: DatasetKey = (decisionData?.dataset_key as DatasetKey) || 'real') => {
    if (!window.confirm('Reset the demo? This reloads the dataset and clears your decision runs and approvals. The audit log is kept.')) {
      return;
    }
    setIsLoading(true);
    try {
      await decisionForgeService.resetDemoData(dataset, true);
      setApprovalStatus({});
      setScoreFlash(null);
      await fetchDecisions();
      showNotification(dataset === 'synthetic'
        ? 'Synthetic B2B dataset (520 opportunities) loaded & analyzed.'
        : 'Real cited dataset loaded & analyzed.');
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.message || 'Failed to reset demo dataset';
      alert(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  const handleOpenBilling = (clientName: string, dealValue: number) => {
    navigate('/billing', { state: { newClientName: clientName, suggestedAmount: dealValue } });
  };

  const handleFetchContext = async (rec: RecommendationItem) => {
    setFetchingContextId(rec.opportunity_id);
    const before = rec.priority_score;
    try {
      const result = await decisionForgeService.fetchExternalContext(rec.opportunity_id);
      if (result.status === 'no_signal' || result.status === 'unavailable') {
        showNotification(result.message || `External context unavailable for ${rec.company_name}. Decision calculated from internal business data.`);
        return;
      }

      const refreshed = await decisionForgeService.runDecisions();
      setDecisionData(refreshed);

      const updated = refreshed.recommendations.find((r) => r.opportunity_id === rec.opportunity_id);
      const after = updated?.priority_score ?? before;
      // An open evidence drawer holds a snapshot of the old recommendation; point it at the refreshed one.
      if (updated) {
        setEvidenceItem((current) => (current && current.opportunity_id === rec.opportunity_id ? updated : current));
      }
      setScoreFlash({ opportunityId: rec.opportunity_id, before, after });
      showNotification(
        `${rec.company_name}: fresh context retrieved — score ${before} → ${after} ${after >= before ? '▲' : '▼'}`
      );
      setTimeout(() => setScoreFlash((f) => (f?.opportunityId === rec.opportunity_id ? null : f)), 8000);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.message || 'Failed to fetch external context.';
      showNotification(msg);
    } finally {
      setFetchingContextId(null);
    }
  };

  const activeOpportunity = decisionData?.recommendations.find(
    (r) => r.opportunity_id === selectedOpportunityId
  ) || decisionData?.recommendations[0] || null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <Topbar
        title="DecisionForge AI Engine"
        subtitle="Evaluates commercial allocation, credit decisions, and outreach priority using financial inputs, transparent calculations, risks, and evidence."
      />

      {/* Top Notification Toast */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-dropdown border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 max-w-md">
          <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0" />
          <span className="text-xs font-semibold">{notification}</span>
        </div>
      )}

      {/* Flagship Header & Action Bar */}
      <div
        data-tour="decision-progression"
        className="relative overflow-hidden bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 p-6 shadow-[0_4px_24px_-4px_rgba(16,24,47,0.06)] space-y-5"
      >
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-gradient-to-r from-rose-50 to-violet-50 text-violet-700 border border-violet-200 shadow-2xs">
                Commercial Decision Engine
              </span>
              <span className="text-xs text-slate-500 font-semibold">B2B Financial Allocation</span>
              {decisionData && (
                <span className="text-[11px] text-slate-500 font-mono bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200 font-semibold">
                  Run: {decisionData.decision_run_id} • Policy {decisionData.policy_version}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-slate-900 via-violet-950 to-rose-700 bg-clip-text text-transparent tracking-tight">
              Evidence-Backed Decisions & Simulation Twin
            </h1>
            <p className="text-xs text-slate-600 mt-1.5 max-w-2xl font-medium leading-relaxed">
              Combines CRM records, deterministic analytics, retrieved rep notes and optional cited external context into explainable decisions, what-if scenarios and human approval.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setPolicyOpen(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-200 shadow-2xs hover:border-slate-300"
              title="Configure scoring weights and priority thresholds"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Policy Weights</span>
            </button>
            <button
              onClick={() => handleResetDemo()}
              disabled={isLoading}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-200 shadow-2xs hover:border-slate-300"
              title="Reset the demo dataset (clears runs and approvals)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Demo Dataset</span>
            </button>
            <button
              onClick={fetchDecisions}
              disabled={isLoading}
              className="px-4 py-2 bg-gradient-to-r from-rose-600 via-fuchsia-600 to-violet-600 hover:from-rose-500 hover:via-fuchsia-500 hover:to-violet-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-fuchsia-500/25 flex items-center gap-1.5 transition cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{isLoading ? 'Computing…' : 'Run Decision Engine'}</span>
            </button>
          </div>
        </div>

        {/* Opportunity Quick Selector Bar (Visible when in evaluator tab) */}
        {decisionData && decisionData.recommendations.length > 0 && activeTab === 'evaluator' && (
          <div className="pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative">
            <div className="flex items-center gap-2">
              <Building size={14} className="text-violet-500" />
              <span className="text-xs font-bold text-slate-700">Evaluating Opportunity:</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-2xl">
              {decisionData.recommendations.map((rec) => {
                const isSelected = (selectedOpportunityId || decisionData.recommendations[0]?.opportunity_id) === rec.opportunity_id;
                return (
                  <button
                    key={rec.opportunity_id}
                    onClick={() => setSelectedOpportunityId(rec.opportunity_id)}
                    className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'text-white'
                        : 'text-slate-600 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200/80'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId={!prefersReducedMotion ? 'activeOpportunityPill' : undefined}
                        className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl shadow-xs -z-10"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <span>{rec.company_name}</span>
                      <span data-testid={isSelected ? 'selected-opportunity-score' : undefined} className="font-mono text-[10.5px] px-1 rounded bg-black/20 text-white font-extrabold">
                        {rec.priority_score}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 pt-2 overflow-x-auto gap-2 relative">
          {[
            { id: 'evaluator', label: 'Decision Progression (7-Step Evaluator)', icon: Compass, badge: 'Flagship', badgeColor: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white' },
            { id: 'center', label: 'Decision Center', icon: Layers, badge: decisionData?.high_priority_count ? `${decisionData.high_priority_count} Deals` : undefined, badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold' },
            { id: 'twin', label: 'Decision Twin', icon: Sliders, badge: 'What-If', badgeColor: 'bg-rose-50 text-rose-700 border border-rose-200 font-bold' },
            { id: 'ingestion', label: 'Data Quality', icon: UploadCloud },
            { id: 'audit', label: 'Evidence & Audit', icon: History },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`relative py-3 px-4 text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  isActive ? 'text-violet-700' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-violet-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider rounded-full font-extrabold ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId={!prefersReducedMotion ? 'decisionForgeTabIndicator' : undefined}
                    className="absolute bottom-0 left-0 right-0 h-0.75 bg-gradient-to-r from-rose-500 via-fuchsia-600 to-violet-600 rounded-t"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={!prefersReducedMotion ? { opacity: 0, y: 4 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={!prefersReducedMotion ? { opacity: 0, y: -4 } : undefined}
          transition={{ duration: 0.15, ease: EASE_FINANCIAL }}
        >
          {activeTab === 'evaluator' && activeOpportunity && (
            <DecisionProgressionEvaluator
              recommendation={activeOpportunity}
              policyVersion={decisionData?.policy_version || '1.0'}
              policy={decisionData?.policy}
              decisionRunId={decisionData?.decision_run_id || 'run-live'}
              onOpenApproval={handleOpenApproval}
              onFetchContext={handleFetchContext}
              fetchingContextId={fetchingContextId}
            />
          )}

          {activeTab === 'center' && (
            <DecisionCenterTab
              decisionData={decisionData}
              isLoading={isLoading}
              onOpenEvidence={(item) => setEvidenceItem(item)}
              onOpenApproval={handleOpenApproval}
              onRunDecisions={fetchDecisions}
              onFetchContext={handleFetchContext}
              fetchingContextId={fetchingContextId}
              scoreFlash={scoreFlash}
              approvalStatus={approvalStatus}
            />
          )}

          {activeTab === 'twin' && <DecisionTwinTab />}

          {activeTab === 'ingestion' && (
            <DataIngestionTab
              activeDataset={decisionData?.dataset_key}
              onDatasetUpdated={() => {
                fetchDecisions();
                showNotification('Dataset activated and analyzed.');
              }}
            />
          )}

          {activeTab === 'audit' && <AuditTrailTab />}
        </motion.div>
      </AnimatePresence>

      {/* Evidence Side Drawer */}
      <EvidenceDrawer
        recommendation={evidenceItem}
        onClose={() => setEvidenceItem(null)}
        onApprove={handleOpenApproval}
        onFetchContext={handleFetchContext}
        fetchingContextId={fetchingContextId}
      />

      {/* Human Approval Governance Modal */}
      <ApprovalModal
        item={approvalItem}
        onClose={() => setApprovalItem(null)}
        onSuccess={(msg) => {
          showNotification(msg);
          // Keep the current run so the reviewed card shows its status; re-running would mint a new run id.
          refreshApprovals();
        }}
        onOpenBilling={handleOpenBilling}
      />

      {/* Decision Policy Configuration Modal */}
      {policyOpen && (
        <PolicyModal
          onClose={() => setPolicyOpen(false)}
          onSaved={() => {
            setPolicyOpen(false);
            fetchDecisions();
            showNotification('Decision policy saved. Recommendations recalculated under the new weights.');
          }}
        />
      )}
    </div>
  );
};
