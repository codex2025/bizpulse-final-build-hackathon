import React, { useState } from 'react';
import { X, CheckCircle2, Edit3, XCircle, ArrowRight } from 'lucide-react';
import { decisionForgeService } from '../../services/decisionForgeService';
import type { RecommendationItem } from '../../services/decisionForgeService';

interface ApprovalModalProps {

  item: RecommendationItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onOpenBilling?: (clientName: string, dealValue: number) => void;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  item,
  onClose,
  onSuccess,
  onOpenBilling,
}) => {
  // NOTE: all hooks must run on every render, in the same order, regardless of `item` --
  // this component stays mounted while the parent flips `item` between null and a value,
  // so an early `return null` placed *before* a hook call would make React see a
  // different hook count between renders and throw ("Rendered more hooks than during
  // the previous render"). The conditional return must come after every hook.
  const [mode, setMode] = useState<'approve' | 'modify' | 'reject'>('approve');
  const [customAction, setCustomAction] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [convertToClient, setConvertToClient] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (item) {
      setMode('approve');
      setCustomAction(item.suggested_action);
      setReviewerNotes('');
      setConvertToClient(true);
    }
  }, [item?.recommendation_id]);

  if (!item) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        opportunityId: item.opportunity_id,
        companyName: item.company_name,
        dealValue: item.deal_value,
        decisionRunId: item.decision_run_id,
        approvedAction: mode === 'modify' ? customAction : item.suggested_action,
        reviewerNotes: reviewerNotes || (mode === 'approve' ? 'Approved by operator' : 'Action declined'),
      };

      if (mode === 'approve') {
        await decisionForgeService.approveRecommendation(item.recommendation_id, payload);
      } else if (mode === 'modify') {
        await decisionForgeService.modifyRecommendation(item.recommendation_id, payload);
      } else {
        await decisionForgeService.rejectRecommendation(item.recommendation_id, payload);
      }

      // If user checked "Convert to Bizpulse Client"
      if (convertToClient && (mode === 'approve' || mode === 'modify')) {
        await decisionForgeService.convertToClient(item.recommendation_id, {
          opportunityId: item.opportunity_id,
          companyName: item.company_name,
          contactEmail: item.contact_email || '',
          location: item.evidence_pack?.structured_data?.location || '',
          dealValue: item.deal_value,
        });

        onSuccess(`Action approved & ${item.company_name} synced to Bizpulse Clients!`);
        if (onOpenBilling) {
          onOpenBilling(item.company_name, item.deal_value);
        }
      } else {
        onSuccess(`Recommendation successfully ${mode}d.`);
      }

      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Approval action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              Human-In-The-Loop Authority
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              Review Action for {item.company_name}
            </h3>
            <p className="text-xs text-slate-500">
              Opportunity Value: <span className="font-semibold text-slate-800">${item.deal_value.toLocaleString()}</span> • Priority Score: <span className="font-bold text-rose-600">{item.priority_score}</span> • Run: <span className="font-mono text-slate-600">{item.decision_run_id}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Choice Segment */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setMode('approve')}
              className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                mode === 'approve'
                  ? 'border-emerald-500 bg-emerald-50/60 text-emerald-800 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              <CheckCircle2 className={`w-5 h-5 ${mode === 'approve' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="text-xs font-bold">Approve Action</span>
            </button>

            <button
              onClick={() => setMode('modify')}
              className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                mode === 'modify'
                  ? 'border-blue-500 bg-blue-50/60 text-blue-800 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              <Edit3 className={`w-5 h-5 ${mode === 'modify' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-xs font-bold">Modify / Override</span>
            </button>

            <button
              onClick={() => setMode('reject')}
              className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                mode === 'reject'
                  ? 'border-red-500 bg-red-50/60 text-red-800 ring-2 ring-red-500/20'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              <XCircle className={`w-5 h-5 ${mode === 'reject' ? 'text-red-600' : 'text-slate-400'}`} />
              <span className="text-xs font-bold">Decline Action</span>
            </button>
          </div>

          {/* Action Details */}
          {mode === 'modify' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customized Action Instructions
              </label>
              <textarea
                value={customAction}
                onChange={(e) => setCustomAction(e.target.value)}
                rows={3}
                className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/30 text-slate-800"
              />
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-400 font-semibold block uppercase text-[10px]">
                {mode === 'approve' ? 'Recommended Executive Action:' : 'Action to Cancel:'}
              </span>
              <p className="font-medium text-slate-800 mt-0.5">{item.suggested_action}</p>
            </div>
          )}

          {/* Reviewer Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reviewer Audit Notes / Justification
            </label>
            <input
              type="text"
              placeholder="e.g. Verified with VP of Sales; alignment call scheduled for Thursday"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/30 text-slate-800"
            />
          </div>

          {/* Seamless Bizpulse Integration Checkbox */}
          {(mode === 'approve' || mode === 'modify') && (
            <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200/80 flex items-start gap-3">
              <input
                type="checkbox"
                id="syncBizpulse"
                checked={convertToClient}
                onChange={(e) => setConvertToClient(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
              />
              <label htmlFor="syncBizpulse" className="text-xs cursor-pointer">
                <span className="font-bold text-slate-800 block">
                  Sync with Bizpulse Client Directory & Enable Billing
                </span>
                <span className="text-slate-600 text-[11px]">
                  Saves {item.company_name} to your client portfolio{item.contact_email ? ` (${item.contact_email})` : ''} and pre-fills an invoice in Billing. GST/KYC details are left for you to fill in.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-5 py-2 text-xs font-semibold text-white rounded-lg shadow-sm flex items-center gap-2 transition ${
              mode === 'reject'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500'
            }`}
          >
            {isSubmitting ? (
              'Recording Decision...'
            ) : (
              <>
                Confirm {mode === 'approve' ? 'Approval' : mode === 'modify' ? 'Modification' : 'Rejection'}
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
