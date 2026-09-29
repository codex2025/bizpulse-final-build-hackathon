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
import type { DecisionRunData, RecommendationItem } from '../../services/decisionForgeService';

export interface ScoreFlash {
  opportunityId: string;
  before: number;
  after: number;
}

export const DecisionForgePage: React.FC = () => {
  const navigate = useNavigate();
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

  useEffect(() => {
    fetchDecisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResetDemo = async () => {
    setIsLoading(true);
    try {
      await decisionForgeService.resetDemoData();
      setScoreFlash(null);
      await fetchDecisions();
      showNotification('Clean Industrial B2B benchmark dataset loaded & analyzed.');
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
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-cobalt-50 text-cobalt-700 border border-cobalt-200">
                Commercial Decision Engine
              </span>
              <span className="text-xs text-slate-500 font-medium">B2B Financial Allocation</span>
              {decisionData && (
                <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Run: {decisionData.decision_run_id} • Policy {decisionData.policy_version}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Evidence-Backed Decisions & Simulation Twin
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Evaluates business decisions across financial parameters, transparent formulas, identified risks, and multi-source evidence with human governance.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setPolicyOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              title="Configure scoring weights and priority thresholds"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Policy Weights</span>
            </button>
            <button
              onClick={handleResetDemo}
              disabled={isLoading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              title="Reset to verified demo CRM benchmark"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Benchmark</span>
            </button>
            <button
              onClick={fetchDecisions}
              disabled={isLoading}
              className="px-4 py-2 bg-cobalt-600 hover:bg-cobalt-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{isLoading ? 'Computing…' : 'Run Decision Engine'}</span>
            </button>
          </div>
        </div>

        {/* Opportunity Quick Selector Bar (Visible when in evaluator tab) */}
        {decisionData && decisionData.recommendations.length > 0 && activeTab === 'evaluator' && (
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-700">Evaluating Opportunity:</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-2xl">
              {decisionData.recommendations.map((rec) => {
                const isSelected = (selectedOpportunityId || decisionData.recommendations[0]?.opportunity_id) === rec.opportunity_id;
                return (
                  <button
                    key={rec.opportunity_id}
                    onClick={() => setSelectedOpportunityId(rec.opportunity_id)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white font-bold shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <span>{rec.company_name}</span>
                    <span className="ml-1.5 font-mono text-[10px] opacity-75">({rec.priority_score})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 pt-2 overflow-x-auto gap-2">
          <button
            onClick={() => setActiveTab('evaluator')}
            className={`py-2.5 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'evaluator'
                ? 'border-cobalt-600 text-cobalt-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Decision Progression (7-Step Evaluator)</span>
            <span className="px-1.5 py-0.2 text-[9px] uppercase tracking-wider rounded bg-cobalt-600 text-white font-extrabold">
              Flagship
            </span>
          </button>

          <button
            onClick={() => setActiveTab('center')}
            className={`py-2.5 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'center'
                ? 'border-cobalt-600 text-cobalt-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Pipeline Decision Center</span>
            {decisionData?.high_priority_count ? (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-teal-50 text-teal-700 font-bold border border-teal-200">
                {decisionData.high_priority_count} Deals
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('twin')}
            className={`py-2.5 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'twin'
                ? 'border-cobalt-600 text-cobalt-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Decision Twin Simulator</span>
            <span className="px-1.5 py-0.2 text-[9px] uppercase tracking-wider rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
              What-If
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ingestion')}
            className={`py-2.5 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'ingestion'
                ? 'border-cobalt-600 text-cobalt-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Data Ingestion & Quality</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-2.5 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'audit'
                ? 'border-cobalt-600 text-cobalt-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Governance & Audit Trail</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'evaluator' && activeOpportunity && (
        <DecisionProgressionEvaluator
          recommendation={activeOpportunity}
          policyVersion={decisionData?.policy_version || '1.0'}
          decisionRunId={decisionData?.decision_run_id || 'run-live'}
          onOpenApproval={(item) => setApprovalItem(item)}
          onFetchContext={handleFetchContext}
          fetchingContextId={fetchingContextId}
        />
      )}

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
