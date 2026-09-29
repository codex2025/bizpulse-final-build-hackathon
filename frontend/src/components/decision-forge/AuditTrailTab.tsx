import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, PlayCircle, Clock, User, CheckCircle2, XCircle, Edit3, ListChecks, RefreshCw } from 'lucide-react';
import { decisionForgeService } from '../../services/decisionForgeService';

import type { AuditLogItem, ApprovalItem } from '../../services/decisionForgeService';

type ApprovalFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'MODIFIED' | 'REJECTED';

interface ReplayRunData {
  run: {
    decisionRunId?: string;
    decision_run_id?: string;
    policyVersion?: string;
    policy_version?: string;
    recordsAnalyzed?: number;
    records_analyzed?: number;
    pipelineTotalValue?: number;
    pipeline_total_value?: number;
    createdAt?: string;
    created_at?: string;
    recommendations?: Array<{
      recommendation_id: string;
      company_name: string;
      suggested_action: string;
      priority_score: number;
    }>;
  };
  policy?: Record<string, unknown>;
  approvals?: Array<{
    id: string;
    status: string;
    companyName: string;
    approvedAction: string;
    dealValue?: number;
  }>;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600 border-slate-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MODIFIED: 'bg-blue-50 text-blue-700 border-blue-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

export const AuditTrailTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<ReplayRunData | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('ALL');

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [logData, approvalData] = await Promise.all([
        decisionForgeService.getAuditLogs(),
        decisionForgeService.getApprovals(),
      ]);
      setLogs(logData);
      setApprovals(approvalData);
    } catch (err: unknown) {
      console.error('Audit fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleReplay = async (runId: string) => {
    try {
      const replayData = await decisionForgeService.replayDecision(runId);
      setSelectedRun(replayData);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.message || 'Failed to replay decision run';
      alert(msg);
    }
  };

  const getEventBadge = (type: string) => {
    if (type.includes('APPROVED')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Approved Action
        </span>
      );
    }
    if (type.includes('MODIFIED')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
          <Edit3 className="w-3 h-3" /> Modified Action
        </span>
      );
    }
    if (type.includes('REJECTED')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
          <XCircle className="w-3 h-3" /> Declined Action
        </span>
      );
    }
    if (type.includes('CLIENT_CONVERTED')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          Bizpulse Client Synced
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        {type.replace(/_/g, ' ')}
      </span>
    );
  };

  const filteredApprovals = approvalFilter === 'ALL' ? approvals : approvals.filter((a) => a.status === approvalFilter);
  const counts = {
    ALL: approvals.length,
    PENDING: approvals.filter((a) => a.status === 'PENDING').length,
    APPROVED: approvals.filter((a) => a.status === 'APPROVED').length,
    MODIFIED: approvals.filter((a) => a.status === 'MODIFIED').length,
    REJECTED: approvals.filter((a) => a.status === 'REJECTED').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-rose-600" />
            <h3 className="text-base font-bold text-slate-900">Approvals & Immutable Audit Ledger</h3>
          </div>
          <p className="text-xs text-slate-500">
            Every human review decision and the chronological log of calculations, approvals, overrides, and Bizpulse client conversions behind it.
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-sm transition flex items-center gap-1.5 flex-shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Approvals List */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-rose-600" />
            <h4 className="text-sm font-bold text-slate-900">Recommendation Reviews</h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'PENDING', 'APPROVED', 'MODIFIED', 'REJECTED'] as ApprovalFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setApprovalFilter(f)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                  approvalFilter === f
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()} ({counts[f]})
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-xs text-slate-400">Loading approvals...</div>
        ) : filteredApprovals.length === 0 ? (
          <div className="text-center py-10 text-slate-400 space-y-1.5">
            <ListChecks className="w-7 h-7 mx-auto text-slate-300" />
            <p className="text-xs">No recommendations reviewed in this category yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredApprovals.map((a) => (
              <div key={a.id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[a.status] || STATUS_STYLE.PENDING}`}>
                      {a.status}
                    </span>
                    <span className="font-bold text-slate-800 text-xs">{a.companyName}</span>
                    {a.decisionRunId && <span className="text-[11px] font-mono text-slate-400">{a.decisionRunId}</span>}
                    {a.convertedClientId && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        Synced to Bizpulse
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">{a.approvedAction || 'No action recorded.'}</p>
                  {a.reviewerNotes && <p className="text-[11px] text-slate-400 italic">"{a.reviewerNotes}"</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-bold text-slate-900">${Number(a.dealValue || 0).toLocaleString()}</span>
                  {a.decisionRunId && (
                    <button
                      onClick={() => handleReplay(a.decisionRunId!)}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100/70 border border-rose-200/80 rounded-lg transition flex items-center gap-1.5"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      Replay
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Feed */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-rose-600" />
          <h4 className="text-sm font-bold text-slate-900">Decision & Action Audit Log</h4>
        </div>
        {isLoading ? (
          <div className="text-center py-12 text-xs text-slate-400">Loading audit records...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <History className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs">No governance events logged yet.</p>
            <p className="text-[11px]">Run a decision or approve an action in the Decision Center to generate audit records.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getEventBadge(log.eventType)}
                    {log.companyName && (
                      <span className="font-bold text-slate-800 text-xs">
                        {log.companyName}
                      </span>
                    )}
                    {log.decisionRunId && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {log.decisionRunId}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600">
                    {String(log.payload?.approvedAction || log.payload?.message || (log.payload ? JSON.stringify(log.payload) : ''))}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {log.actorEmail || 'Operator'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" /> {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                    </span>
                  </div>
                </div>

                {log.decisionRunId && (
                  <button
                    onClick={() => handleReplay(log.decisionRunId!)}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100/70 border border-rose-200/80 rounded-lg transition flex items-center gap-1.5"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Decision Replay
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Replay Drawer / Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">
                  Historical Decision Snapshot
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Run ID: {selectedRun.run?.decisionRunId || selectedRun.run?.decision_run_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRun(null)}
                className="px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 block">Policy Version:</span>
                  <span className="font-bold text-slate-800">{selectedRun.run?.policyVersion || selectedRun.run?.policy_version}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Opportunities Ranked:</span>
                  <span className="font-bold text-slate-800">{selectedRun.run?.recordsAnalyzed || selectedRun.run?.records_analyzed} Deals</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Pipeline Total:</span>
                  <span className="font-bold text-slate-800">${(selectedRun.run?.pipelineTotalValue || selectedRun.run?.pipeline_total_value || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Execution Timestamp:</span>
                  <span className="font-bold text-slate-800">
                    {selectedRun.run?.createdAt || selectedRun.run?.created_at
                      ? new Date((selectedRun.run.createdAt || selectedRun.run.created_at) as string).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {(selectedRun.approvals?.length ?? 0) > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">Reviews Recorded Against This Run</h4>
                  <div className="space-y-2">
                    {selectedRun.approvals?.map((a) => (
                      <div key={a.id} className="p-3 border border-slate-200 rounded-lg flex justify-between items-center gap-3">
                        <div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border mr-2 ${STATUS_STYLE[a.status] || STATUS_STYLE.PENDING}`}>
                            {a.status}
                          </span>
                          <span className="font-bold text-slate-900">{a.companyName}</span>
                          <span className="text-slate-500 text-[11px] block mt-0.5">{a.approvedAction}</span>
                        </div>
                        <span className="font-bold text-slate-700 text-sm flex-shrink-0">${Number(a.dealValue || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-bold text-slate-800 mb-2">Original Recommendations Snapshot</h4>
                <div className="space-y-2">
                  {selectedRun.run?.recommendations?.map((r) => (
                    <div key={r.recommendation_id} className="p-3 border border-slate-200 rounded-lg flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-900 block">{r.company_name}</span>
                        <span className="text-slate-500 text-[11px]">{r.suggested_action}</span>
                      </div>
                      <span className="font-bold text-rose-600 text-sm">{r.priority_score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
