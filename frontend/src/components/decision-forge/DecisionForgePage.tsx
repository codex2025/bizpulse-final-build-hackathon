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
  SlidersHorizontal
} from 'lucide-react';
import { DecisionCenterTab } from './DecisionCenterTab';
import { DecisionTwinTab } from './DecisionTwinTab';
import { DataIngestionTab } from './DataIngestionTab';
import { AuditTrailTab } from './AuditTrailTab';
import { EvidenceDrawer } from './EvidenceDrawer';
import { ApprovalModal } from './ApprovalModal';
import { PolicyModal } from './PolicyModal';
import { decisionForgeService } from '../../services/decisionForgeService';
import type { DecisionRunData, RecommendationItem } from '../../services/decisionForgeService';

export interface ScoreFlash {
  opportunityId: string;
  before: number;
  after: number;
}

export const DecisionForgePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'center' | 'twin' | 'ingestion' | 'audit'>('center');
  const [decisionData, setDecisionData] = useState<DecisionRunData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Modals / Drawers state
  const [evidenceItem, setEvidenceItem] = useState<RecommendationItem | null>(null);
  const [approvalItem, setApprovalItem] = useState<RecommendationItem | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);

  // Per-opportunity "fetch fresh context" state
  const [fetchingContextId, setFetchingContextId] = useState<string | null>(null);
  const [scoreFlash, setScoreFlash] = useState<ScoreFlash | null>(null);

  const fetchDecisions = async () => {
    setIsLoading(true);
    try {
      const data = await decisionForgeService.runDecisions();
      setDecisionData(data);
    } catch (err: any) {
      console.error('Error running decisions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDecisions();
  }, []);

  const handleResetDemo = async () => {
    setIsLoading(true);
    try {
      await decisionForgeService.resetDemoData();
      setScoreFlash(null);
      await fetchDecisions();
      showNotification('Clean Industrial B2B benchmark dataset loaded & analyzed.');
    } catch (err: any) {
      alert(err.message || 'Failed to reset demo dataset');
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

  // Explicitly retrieves fresh external context for one opportunity, then re-runs the
  // decision engine so the user sees a real before/after score change (plan section 22,
  // demo script 1:10-1:45) rather than a silently-applied signal.
  const handleFetchContext = async (rec: RecommendationItem) => {
    setFetchingContextId(rec.opportunity_id);
    const before = rec.priority_score;
    try {
      const result = await decisionForgeService.fetchExternalContext(rec.opportunity_id);
      if (result.status === 'no_signal') {
        showNotification(`No validated external signal is available for ${rec.company_name}.`);
        return;
      }

      const refreshed = await decisionForgeService.runDecisions();
      setDecisionData(refreshed);

      const updated = refreshed.recommendations.find((r) => r.opportunity_id === rec.opportunity_id);
      const after = updated?.priority_score ?? before;
      setScoreFlash({ opportunityId: rec.opportunity_id, before, after });
      showNotification(
        `${rec.company_name}: fresh context retrieved — score ${before} → ${after} ${after >= before ? '▲' : '▼'}`
      );
      setTimeout(() => setScoreFlash((f) => (f?.opportunityId === rec.opportunity_id ? null : f)), 8000);
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Failed to fetch external context.');
    } finally {
      setFetchingContextId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Notification Toast */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-slideIn max-w-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-semibold">{notification}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-gradient-to-r from-rose-500/10 to-red-500/10 text-rose-600 border border-rose-200">
                DecisionForge AI Engine
              </span>
              <span className="text-xs text-slate-400 font-medium">B2B Commercial Intelligence</span>
              {decisionData && (
                <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                  {decisionData.decision_run_id} · Policy {decisionData.policy_version}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Evidence-Backed Recommendations & Decision Twin
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Synthesizes CRM sales data, rep notes (RAG), and fresh external signals into deterministic decisions with scenario simulations and human governance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setPolicyOpen(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm"
              title="Configure scoring weights and priority thresholds"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Decision Policy
            </button>
            <button
              onClick={handleResetDemo}
              disabled={isLoading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm"
              title="One-click reset to verified demo CRM benchmark"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo Dataset
            </button>
            <button
              onClick={fetchDecisions}
              disabled={isLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              {isLoading ? 'Computing...' : 'Run Decision Engine'}
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 mt-6 -mb-6 -mx-6 sm:-mx-8 px-6 sm:px-8 bg-slate-50/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('center')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'center'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Decision Center
            {decisionData?.high_priority_count ? (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-rose-100 text-rose-700 font-bold">
                {decisionData.high_priority_count}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('twin')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'twin'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Decision Twin Simulator
            <span className="px-1.5 py-0.2 text-[9px] uppercase tracking-wider rounded bg-rose-500 text-white font-extrabold">
              What-If
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ingestion')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'ingestion'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            CRM Ingestion & Quality
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            Approvals & Audit Replay
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'center' && (
        <DecisionCenterTab
          decisionData={decisionData}
          isLoading={isLoading}
          onOpenEvidence={(item) => setEvidenceItem(item)}
          onOpenApproval={(item) => setApprovalItem(item)}
          onRunDecisions={fetchDecisions}
          onFetchContext={handleFetchContext}
          fetchingContextId={fetchingContextId}
          scoreFlash={scoreFlash}
        />
      )}

      {activeTab === 'twin' && <DecisionTwinTab />}

      {activeTab === 'ingestion' && (
        <DataIngestionTab
          onDatasetUpdated={() => {
            fetchDecisions();
            showNotification('New CRM dataset activated and analyzed.');
          }}
        />
      )}

      {activeTab === 'audit' && <AuditTrailTab />}

      {/* Evidence Side Drawer */}
      <EvidenceDrawer
        recommendation={evidenceItem}
        onClose={() => setEvidenceItem(null)}
        onApprove={(item) => setApprovalItem(item)}
        onFetchContext={handleFetchContext}
        fetchingContextId={fetchingContextId}
      />

      {/* Human Approval Governance Modal */}
      <ApprovalModal
        item={approvalItem}
        onClose={() => setApprovalItem(null)}
        onSuccess={(msg) => {
          showNotification(msg);
          fetchDecisions();
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
