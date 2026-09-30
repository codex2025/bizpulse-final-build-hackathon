import React from 'react';
import { motion } from 'framer-motion';
import { Check, AlertTriangle, Zap } from 'lucide-react';
import { SPRING_SMOOTH, usePrefersReducedMotion } from '../../utils/motion';
import type { DecisionRunData, RecommendationItem } from '../../services/decisionForgeService';

type StageState = 'done' | 'active' | 'warn' | 'pending';

export interface Stage {
  id: 'ingestion' | 'policy' | 'risk' | 'approval';
  title: string;
  detail: string;
  state: StageState;
}

/** The four stages, each derived from the real run and approval state (nothing is decorative). */
export function deriveStages(
  run: DecisionRunData | null,
  selected: RecommendationItem | null,
  approvalStatus: Record<string, string>,
): Stage[] {
  const analysed = run?.records_analyzed ?? 0;
  const stale = run?.stale_warning_count ?? 0;
  const status = selected ? approvalStatus[selected.recommendation_id] : undefined;
  return [
    {
      id: 'ingestion',
      title: 'Ingestion',
      detail: run ? `${analysed} records analysed` : 'No run yet',
      state: run && analysed > 0 ? 'done' : 'pending',
    },
    {
      id: 'policy',
      title: 'Policy matrix',
      detail: run ? `Policy ${run.policy_version} applied` : 'Waiting for a run',
      state: run ? 'done' : 'pending',
    },
    {
      id: 'risk',
      title: 'Risk gate',
      detail: !run ? 'Waiting for a run' : stale > 0 ? `${stale} stale-data warning${stale === 1 ? '' : 's'}` : 'No stale-data warnings',
      state: !run ? 'pending' : stale > 0 ? 'warn' : 'done',
    },
    {
      id: 'approval',
      title: 'Human approval',
      detail: !selected ? 'Nothing selected' : status ? status.toLowerCase() : 'Not yet reviewed',
      state: status === 'APPROVED' || status === 'MODIFIED' || status === 'REJECTED' ? 'done' : run ? 'active' : 'pending',
    },
  ];
}

const DOT: Record<StageState, string> = {
  done: 'bg-emerald-500 text-white border-emerald-500',
  active: 'bg-violet-600 text-white border-violet-600',
  warn: 'bg-amber-400 text-white border-amber-400',
  pending: 'bg-white text-slate-400 border-slate-300',
};

export const StageStepper: React.FC<{ stages: Stage[] }> = ({ stages }) => {
  const reduce = usePrefersReducedMotion();
  return (
    <ol data-testid="stage-stepper" aria-label="Decision stages" className="flex items-stretch gap-0 overflow-x-auto">
      {stages.map((s, i) => (
        <li key={s.id} data-stage={s.id} data-state={s.state} className="flex items-center flex-1 min-w-[9.5rem]">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_SMOOTH, delay: reduce ? 0 : i * 0.05 }}
            className="flex items-center gap-2.5 min-w-0"
          >
            <span className={`w-7 h-7 shrink-0 rounded-full border flex items-center justify-center text-[11px] font-black ${DOT[s.state]}`}>
              {s.state === 'done' ? <Check size={14} /> : s.state === 'warn' ? <AlertTriangle size={13} /> : s.state === 'active' ? <Zap size={13} /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-800 truncate">{s.title}</span>
              <span className="block text-[11px] font-medium text-slate-500 truncate">{s.detail}</span>
            </span>
          </motion.div>
          {i < stages.length - 1 && (
            <span aria-hidden className={`flex-1 h-0.5 mx-3 rounded ${s.state === 'done' ? 'bg-emerald-300' : 'bg-slate-200'}`} />
          )}
        </li>
      ))}
    </ol>
  );
};
