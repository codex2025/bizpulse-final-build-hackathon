import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { Card, CardTitle, CardDescription } from '../common/Card';
import { useDecisionWorkspace } from '../../hooks/useDecisionWorkspace';
import { decisionForgeService } from '../../services/decisionForgeService';

const CLASS_STYLE: Record<string, string> = {
  IMMEDIATE_ACTION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PROCEED_WITH_QUALIFICATION: 'bg-amber-50 text-amber-700 border-amber-200',
  NURTURE_MONITOR: 'bg-slate-100 text-slate-600 border-slate-200',
};

/** The latest DecisionForge recommendations with a one-click path to review and approve them. */
export const DecisionStream: React.FC = () => {
  const navigate = useNavigate();
  const workspace = useDecisionWorkspace();
  const { data, isError, isLoading } = useQuery({
    queryKey: ['decisions-analytics'],
    queryFn: () => decisionForgeService.runDecisions(),
    enabled: workspace.configured,
    staleTime: 30_000,
    retry: false,
    refetchInterval: 60_000,
  });
  const top = (data?.recommendations ?? []).slice(0, 4);

  return (
    <Card data-testid="decision-stream">
      <div className="flex items-center justify-between gap-2">
        <div>
          <CardTitle>AI decision stream</CardTitle>
          <CardDescription>{data ? `Run ${data.decision_run_id} · policy ${data.policy_version}` : 'DecisionForge recommendations'}</CardDescription>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><Radio size={12} className="animate-pulse" /> Live</span>
      </div>
      <ul className="mt-3 space-y-2">
        {!workspace.isLoading && !workspace.configured && (
          <li className="text-xs text-slate-500 font-medium" data-testid="decision-stream-empty">
            No sales data yet.{' '}
            <button type="button" onClick={() => navigate('/decision-forge')} className="font-bold text-violet-700 hover:underline cursor-pointer">
              Add your opportunities in DecisionForge
            </button>{' '}
            to see ranked recommendations here.
          </li>
        )}
        {isLoading && <li className="text-xs text-slate-400 font-medium">Loading decisions…</li>}
        {isError && <li className="text-xs text-slate-500 font-medium">Decision service is unavailable right now.</li>}
        {top.map((r) => (
          <li key={r.recommendation_id} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60">
            <span className="w-9 text-center font-mono text-sm font-black tabular-nums text-slate-900">{r.priority_score}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-slate-900 truncate">{r.company_name}</span>
              <span className={`inline-block mt-0.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border ${CLASS_STYLE[r.decision_class] ?? CLASS_STYLE.NURTURE_MONITOR}`}>
                {r.decision_class.replace(/_/g, ' ')}
              </span>
            </span>
            <button
              type="button"
              onClick={() => navigate('/decision-forge', { state: { reviewOpportunityId: r.opportunity_id } })}
              className="shrink-0 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold cursor-pointer"
            >
              Review &amp; Approve
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
};
