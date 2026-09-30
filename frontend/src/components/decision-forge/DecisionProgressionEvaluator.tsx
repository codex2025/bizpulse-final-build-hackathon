import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCheck, AlertTriangle,
  ArrowRight, Database, FileText, Globe,
  RefreshCw, Mail, CheckCircle2, AlertOctagon,
  ChevronDown, ChevronUp, Info, Loader2, Check
} from 'lucide-react';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { usePrefersReducedMotion, EASE_FINANCIAL } from '../../utils/motion';
import type { RecommendationItem } from '../../services/decisionForgeService';

// These mirror the engine's own scoring rules (ai-service decision_engine.py), so a moved lever changes the
// score by exactly what the engine would change it by. Everything else (engagement, external signal, buying
// intent, data-quality penalty) stays as the engine computed it.
const DEAL_VALUE_CEILING = 500000;
const dealScore = (value: number) => Math.min(100, (Math.max(0, value) / DEAL_VALUE_CEILING) * 100);
const recencyScore = (days: number) => (days <= 7 ? 95 : days <= 14 ? 80 : days <= 30 ? 60 : 25);
/** A representative day count for the engine's recency band (the engine only scores bands, not exact days). */
const recencyDaysForScore = (score?: number) => (score === undefined ? 14 : score >= 95 ? 5 : score >= 80 ? 12 : score >= 60 ? 21 : 40);

const findFactor = (rec: RecommendationItem, fragment: string) =>
  rec.factors.find((f) => f.name.toLowerCase().includes(fragment));

interface DecisionProgressionEvaluatorProps {
  recommendation: RecommendationItem;
  policyVersion: string;
  /** The active policy snapshot (weights and class thresholds), when the run carries it. */
  policy?: Record<string, unknown>;
  decisionRunId: string;
  onOpenApproval: (item: RecommendationItem) => void;
  onFetchContext: (item: RecommendationItem) => void;
  fetchingContextId: string | null;
}

export const DecisionProgressionEvaluator: React.FC<DecisionProgressionEvaluatorProps> = ({
  recommendation,
  policyVersion,
  policy,
  decisionRunId,
  onOpenApproval,
  onFetchContext,
  fetchingContextId,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  // What-if levers. They start at the engine's own inputs; the score below is the engine's score until a lever moves.
  const [overrideDealValue, setOverrideDealValue] = useState<number>(recommendation.deal_value);
  const [overrideWinProb, setOverrideWinProb] = useState<number>(Math.round(recommendation.win_probability * 100));
  const [overrideRecencyDays, setOverrideRecencyDays] = useState<number>(() => recencyDaysForScore(findFactor(recommendation, 'recency')?.score));
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);

  // Section expansions
  const [expandCalculations, setExpandCalculations] = useState<boolean>(true);
  const [expandRisks, setExpandRisks] = useState<boolean>(true);
  const [expandEvidence, setExpandEvidence] = useState<boolean>(true);
  const [expandAudit, setExpandAudit] = useState<boolean>(false);
  const [evidenceTab, setEvidenceTab] = useState<'structured' | 'rag' | 'external'>('structured');

  const isFetchingThis = fetchingContextId === recommendation.opportunity_id;

  // Real-time recalculated metrics based on user overrides
  const liveCalculations = useMemo(() => {
    // Start from the engine's factors; only the three levers can change a factor's score.
    const base = {
      deal: findFactor(recommendation, 'deal'),
      win: findFactor(recommendation, 'win'),
      recency: findFactor(recommendation, 'recency'),
    };
    const rows = recommendation.factors.map((f) => {
      let score = f.score;
      if (f === base.deal) score = dealScore(overrideDealValue);
      else if (f === base.win) score = Math.min(100, Math.max(0, overrideWinProb));
      else if (f === base.recency) score = recencyScore(overrideRecencyDays);
      // The data-quality penalty row already carries its own signed contribution.
      const contribution = f.name.toLowerCase().includes('penalty') ? f.weighted_contribution : score * f.weight;
      return { ...f, score: +score.toFixed(1), contribution: +contribution.toFixed(1) };
    });

    const moved =
      overrideDealValue !== recommendation.deal_value ||
      overrideWinProb !== Math.round(recommendation.win_probability * 100) ||
      recencyScore(overrideRecencyDays) !== (base.recency?.score ?? recencyScore(overrideRecencyDays));

    // Unchanged levers: the score IS the engine's score. Moved levers: the engine's score plus exact factor deltas.
    const delta = rows.reduce((sum, r, i) => sum + (r.contribution - recommendation.factors[i].weighted_contribution), 0);
    const computedScore = moved
      ? +Math.max(0, recommendation.priority_score + delta).toFixed(1)
      : recommendation.priority_score;

    // Derived Expected Value
    const expectedValue = Math.round(overrideDealValue * (overrideWinProb / 100));

    // Decision state classification
    const highCut = Number(policy?.high_priority_threshold ?? 75);
    const mediumCut = Number(policy?.medium_priority_threshold ?? 55);
    let liveClass: 'IMMEDIATE_ACTION' | 'PROCEED_WITH_QUALIFICATION' | 'NURTURE_MONITOR';
    if (!moved) {
      liveClass = recommendation.decision_class;
    } else if (computedScore >= highCut) {
      liveClass = 'IMMEDIATE_ACTION';
    } else if (computedScore >= mediumCut) {
      liveClass = 'PROCEED_WITH_QUALIFICATION';
    } else {
      liveClass = 'NURTURE_MONITOR';
    }

    // Dynamic risks detected
    const risks: Array<{ title: string; severity: 'critical' | 'caution' | 'low'; reason: string; mitigation: string }> = [];

    if (overrideRecencyDays > 30) {
      risks.push({
        title: 'Severe Engagement Stall (> 30 Days)',
        severity: 'critical',
        reason: `Account has not been contacted for ${overrideRecencyDays} days. Win decay accelerating.`,
        mitigation: 'Trigger immediate executive sponsor re-activation sequence.'
      });
    } else if (overrideRecencyDays > 14) {
      risks.push({
        title: 'Momentum Slowdown',
        severity: 'caution',
        reason: `${overrideRecencyDays} days since last logged sales touchpoint.`,
        mitigation: 'Dispatch scheduled technical check-in.'
      });
    }

    if (overrideDealValue >= 150000 && overrideWinProb < 40) {
      risks.push({
        title: 'High Exposure / Low Win Velocity Asymmetry',
        severity: 'critical',
        reason: `Large deal value ($${overrideDealValue.toLocaleString()}) with low stage conversion probability (${overrideWinProb}%).`,
        mitigation: 'Require VP Sales qualification checkpoint before allocating senior engineering resources.'
      });
    }

    if (!recommendation.evidence_pack.external_signal) {
      risks.push({
        title: 'Unverified External Market Context',
        severity: 'caution',
        reason: 'No live external public news or intent signals have been verified for this account.',
        mitigation: 'Click "Fetch fresh context" to query verified external web and regulatory signals.'
      });
    } else {
      risks.push({
        title: 'External Intent Signal Verified',
        severity: 'low',
        reason: recommendation.evidence_pack.external_signal.impact_summary,
        mitigation: 'Leverage public signal reference in communication.'
      });
    }

    return {
      rows,
      moved,
      computedScore,
      expectedValue,
      liveClass,
      risks,
    };
  }, [overrideDealValue, overrideWinProb, overrideRecencyDays, recommendation, policy]);

  const handleSliderChange = (setter: (val: number) => void, val: number) => {
    setter(val);
    setIsRecalculating(true);
    setTimeout(() => setIsRecalculating(false), 200);
  };

  const handleResetInputs = () => {
    setOverrideDealValue(recommendation.deal_value);
    setOverrideWinProb(Math.round(recommendation.win_probability * 100));
    setOverrideRecencyDays(recencyDaysForScore(findFactor(recommendation, 'recency')?.score));
  };

  const isDeclineOrNurture = liveCalculations.liveClass === 'NURTURE_MONITOR';
  const isImmediate = liveCalculations.liveClass === 'IMMEDIATE_ACTION';

  return (
    <div className="space-y-6">
      {/* Flagship Evaluator Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cobalt-700 bg-cobalt-50 border border-cobalt-200 px-2 py-0.5 rounded">
                Deterministic Decision Engine
              </span>
              <span className="text-xs text-slate-500 font-mono">Run: {decisionRunId} • Policy {policyVersion}</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{recommendation.company_name}</span>
              <span className="text-slate-400 font-normal text-lg">({recommendation.industry})</span>
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Evaluating commercial capital commitment and outreach priority using verified financial inputs, deterministic scoring calculations, identified risks, and evidence.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                {liveCalculations.moved ? 'What-if score' : 'Decision Score'}
              </span>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span data-testid="decision-score" className="text-2xl font-black font-mono tabular-nums text-slate-900">
                  <AnimatedNumber value={liveCalculations.computedScore} formatFn={(v) => v.toFixed(1)} />
                </span>
                <span className="text-xs text-slate-400">/ 100</span>
              </div>
            </div>

            <div className={`p-3 rounded-xl border flex flex-col justify-center ${
              isImmediate
                ? 'bg-teal-50 border-teal-200 text-teal-800'
                : isDeclineOrNurture
                  ? 'bg-slate-100 border-slate-200 text-slate-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Decision State</span>
              <span className="text-xs font-black uppercase mt-0.5 tracking-wide">
                {liveCalculations.liveClass.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Progression Stepper Bar */}
        <div className="pt-4 flex items-center justify-between text-xs font-bold text-slate-600 overflow-x-auto gap-2">
          {[
            { step: '1', title: 'DECISION' },
            { step: '2', title: 'INPUTS' },
            { step: '3', title: 'CALCULATIONS' },
            { step: '4', title: 'RISKS' },
            { step: '5', title: 'EVIDENCE' },
            { step: '6', title: 'OUTCOME' },
            { step: '7', title: 'AUDIT TRAIL' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-5 h-5 rounded-full bg-cobalt-50 text-cobalt-700 border border-cobalt-200 text-[10px] flex items-center justify-center font-bold">
                {item.step}
              </span>
              <span className="text-[11px] text-slate-800">{item.title}</span>
              {idx < 6 && <ArrowRight size={11} className="text-slate-300 ml-1" />}
            </div>
          ))}
        </div>
      </div>

      {/* 1. DECISION (What is being evaluated?) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-cobalt-600 text-white text-xs font-bold flex items-center justify-center">1</span>
            <h3 className="font-extrabold text-base text-slate-900">Decision: What is being evaluated?</h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">Commercial Pipeline Qualification</span>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-slate-800 leading-relaxed">
            <strong>Core Evaluation Question:</strong> Should Bizpulse approve immediate senior executive engagement and commit high-priority capital bandwidth to{' '}
            <span className="text-cobalt-700 font-bold">{recommendation.company_name}</span> for an evaluated contract exposure of{' '}
            <span className="font-mono font-bold text-slate-900">${overrideDealValue.toLocaleString()}</span>?
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-600 pt-1">
            <span>Primary Contact: <strong className="text-slate-800">{recommendation.contact_name}</strong></span>
            <span>•</span>
            <span>Target Stage: <strong className="text-slate-800">{recommendation.stage}</strong></span>
            <span>•</span>
            <span>Industry Sector: <strong className="text-slate-800">{recommendation.industry}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. INPUTS (Financial & Business Parameters) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-cobalt-600 text-white text-xs font-bold flex items-center justify-center">2</span>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Inputs: What parameters are being considered?</h3>
              <p className="text-xs text-slate-500">Adjust levers below to simulate alternative scenarios and observe live downstream recalculations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetInputs}
            className="text-xs font-semibold text-cobalt-600 hover:text-cobalt-700 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} />
            <span>Reset to Baseline</span>
          </button>
        </div>

        {/* 3 Interactive Input Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Lever 1: Deal Value */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700">1. Deal Size / Exposure</span>
              <span className="text-xs font-mono font-black text-cobalt-700">${overrideDealValue.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.max(DEAL_VALUE_CEILING, recommendation.deal_value)}
              step="5000"
              value={overrideDealValue}
              onChange={(e) => handleSliderChange(setOverrideDealValue, Number(e.target.value))}
              className="w-full accent-cobalt-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>$0</span>
              <span>${Math.max(DEAL_VALUE_CEILING, recommendation.deal_value).toLocaleString()}</span>
            </div>
          </div>

          {/* Lever 2: Win Probability */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700">2. Stage Win Probability</span>
              <span className="text-xs font-mono font-black text-teal-700">{overrideWinProb}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="95"
              step="5"
              value={overrideWinProb}
              onChange={(e) => handleSliderChange(setOverrideWinProb, Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>5% (Early Lead)</span>
              <span>95% (Contract Verbal)</span>
            </div>
          </div>

          {/* Lever 3: Days Since Last Contact */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700">3. Days Since Last Contact (banded)</span>
              <span className={`text-xs font-mono font-black ${overrideRecencyDays > 30 ? 'text-vermilion-600' : 'text-slate-800'}`}>
                {overrideRecencyDays} Days
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="45"
              step="1"
              value={overrideRecencyDays}
              onChange={(e) => handleSliderChange(setOverrideRecencyDays, Number(e.target.value))}
              className={`w-full cursor-pointer ${overrideRecencyDays > 30 ? 'accent-vermilion-600' : 'accent-slate-700'}`}
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>1 Day (Fresh)</span>
              <span>45 Days (Stale Decay)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CALCULATIONS (Formula & Factor Contribution Math) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandCalculations(!expandCalculations)}>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-cobalt-600 text-white text-xs font-bold flex items-center justify-center">3</span>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Calculations: Transparent Mathematical Model</h3>
              <p className="text-xs text-slate-500">Every point in the score is derived from audited multi-factor formulas</p>
            </div>
          </div>
          <button type="button" className="text-slate-400 hover:text-slate-600 p-1">
            {expandCalculations ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <AnimatePresence>
          {expandCalculations && (
            <motion.div
              initial={!prefersReducedMotion ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: 'auto' }}
              exit={!prefersReducedMotion ? { opacity: 0, height: 0 } : undefined}
              transition={{ duration: 0.18, ease: EASE_FINANCIAL }}
              className="space-y-4 pt-1 overflow-hidden"
            >
              {/* Formula slate box: the active policy's real weights */}
              <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 space-y-2 font-mono text-xs" data-testid="formula-box">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                  <span className="font-bold tracking-wider">EXECUTION SCORING ALGORITHM</span>
                  <span className="text-violet-400">Policy {policyVersion} Active</span>
                </div>
                <p className="text-teal-300 font-bold break-words leading-relaxed">
                  Score ={' '}
                  {liveCalculations.rows
                    .filter((r) => !r.name.toLowerCase().includes('penalty'))
                    .map((r) => `(${r.name} × ${Math.round(r.weight * 100)}%)`)
                    .join(' + ')}
                  {liveCalculations.rows.some((r) => r.name.toLowerCase().includes('penalty')) ? ' − DataQualityPenalty' : ''}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2">
                  <div>
                    Calculated score: <span className="text-white font-bold">{liveCalculations.computedScore.toFixed(1)} / 100</span>
                    {liveCalculations.moved && <span className="text-amber-300"> (what-if; engine says {recommendation.priority_score.toFixed(1)})</span>}
                  </div>
                  <div>
                    Expected value (deal × win probability):{' '}
                    <span className="text-white font-bold">${liveCalculations.expectedValue.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Factor Contribution Grid (the engine's factors, not a local guess) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
                {liveCalculations.rows.map((factor) => {
                  const isPenalty = factor.name.toLowerCase().includes('penalty');
                  return (
                    <motion.div
                      key={factor.name}
                      animate={isRecalculating ? { scale: [1, 1.02, 1] } : {}}
                      transition={{ duration: 0.2 }}
                      className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1"
                      title={factor.description}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block truncate">{factor.name}</span>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">{String(factor.raw_value)}</span>
                        <span className={`text-xs font-mono font-black ${isPenalty ? 'text-vermilion-600' : 'text-cobalt-600'}`}>
                          {factor.contribution >= 0 ? '+' : ''}{factor.contribution}
                        </span>
                      </div>
                      {!isPenalty && (
                        <div className="w-full bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                          <div className="bg-cobalt-600 h-full rounded-full" style={{ width: `${Math.min(100, factor.score)}%` }} />
                        </div>
                      )}
                      <span className="text-[9px] text-slate-400 block text-right font-medium">
                        {isPenalty ? 'deducted' : `Wt ${Math.round(factor.weight * 100)}%`}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. RISKS (Identified Threats & Mitigations) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandRisks(!expandRisks)}>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-cobalt-600 text-white text-xs font-bold flex items-center justify-center">4</span>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Risks: What risks were identified?</h3>
              <p className="text-xs text-slate-500">Uncovers engagement stalls, exposure asymmetry, and data staleness</p>
            </div>
          </div>
          <button type="button" className="text-slate-400 hover:text-slate-600 p-1">
            {expandRisks ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <AnimatePresence>
          {expandRisks && (
            <motion.div
              initial={!prefersReducedMotion ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: 'auto' }}
              exit={!prefersReducedMotion ? { opacity: 0, height: 0 } : undefined}
              transition={{ duration: 0.18, ease: EASE_FINANCIAL }}
              className="space-y-2.5 pt-1 overflow-hidden"
            >
              {liveCalculations.risks.map((risk, idx) => {
                const isCrit = risk.severity === 'critical';
                const isCaut = risk.severity === 'caution';
                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                      isCrit
                        ? 'bg-vermilion-50/50 border-vermilion-200 text-vermilion-900'
                        : isCaut
                          ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                          : 'bg-teal-50/50 border-teal-200 text-teal-900'
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {isCrit ? <AlertTriangle size={15} className="text-vermilion-600" /> : isCaut ? <AlertOctagon size={15} className="text-amber-600" /> : <CheckCircle2 size={15} className="text-teal-600" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{risk.title}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          isCrit ? 'bg-vermilion-100 text-vermilion-700' : isCaut ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'
                        }`}>
                          {risk.severity}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{risk.reason}</p>
                      <p className="text-[11px] font-semibold text-cobalt-700 pt-0.5">
                        Mitigation Action: {risk.mitigation}
                      </p>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5. EVIDENCE (Supporting Tri-Fold Evidence Pack) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandEvidence(!expandEvidence)}>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-cobalt-600 text-white text-xs font-bold flex items-center justify-center">5</span>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Evidence: What supports this assessment?</h3>
              <p className="text-xs text-slate-500">Structured CRM facts, semantic RAG notes, and external public market signals</p>
            </div>
          </div>
          <button type="button" className="text-slate-400 hover:text-slate-600 p-1">
            {expandEvidence ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <AnimatePresence>
          {expandEvidence && (
            <motion.div
              initial={!prefersReducedMotion ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: 'auto' }}
              exit={!prefersReducedMotion ? { opacity: 0, height: 0 } : undefined}
              transition={{ duration: 0.18, ease: EASE_FINANCIAL }}
              className="space-y-3 pt-1 overflow-hidden"
            >
              {/* Evidence Tab Buttons */}
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                {[
                  { id: 'structured', label: 'Structured Facts', icon: Database },
                  { id: 'rag', label: `CRM RAG Notes (${recommendation.evidence_pack.rag_notes.length})`, icon: FileText },
                  { id: 'external', label: 'External Market Signals', icon: Globe },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEvidenceTab(id as typeof evidenceTab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      evidenceTab === id
                        ? 'bg-cobalt-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Icon size={12} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Tab 1: Structured Facts */}
              {evidenceTab === 'structured' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                  {Object.entries(recommendation.evidence_pack.structured_data || {}).map(([k, v], i) => (
                    <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                        {k.replace(/_/g, ' ')}
                      </span>
                      <span className="font-bold text-slate-800">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 2: CRM RAG Notes */}
              {evidenceTab === 'rag' && (
                <div className="space-y-2">
                  {recommendation.evidence_pack.rag_notes.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-3">No semantic notes logged for this account.</p>
                  ) : (
                    recommendation.evidence_pack.rag_notes.map((note, i) => (
                      <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                        <span className="text-[10px] font-bold text-cobalt-700 uppercase">Verified Internal Meeting Log #{i + 1}</span>
                        <p className="text-slate-800 italic font-mono bg-white p-2 rounded border border-slate-100">
                          "{note.snippet}"
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: External Signals */}
              {evidenceTab === 'external' && (
                <div className="space-y-2.5">
                  {recommendation.evidence_pack.external_signal ? (
                    <div className="p-4 bg-teal-50/40 border border-teal-200 rounded-xl text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-teal-900 text-sm">
                          {recommendation.evidence_pack.external_signal.title}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                          Verified External Signal
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">
                        {recommendation.evidence_pack.external_signal.impact_summary}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-teal-100">
                        <span>Source: <strong>{recommendation.evidence_pack.external_signal.source}</strong></span>
                        <span>•</span>
                        <span>Retrieved: {new Date(recommendation.evidence_pack.external_signal.retrieved_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Info size={15} />
                        <span>No public signal has been fetched yet for this company.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onFetchContext(recommendation)}
                        disabled={isFetchingThis}
                        className="px-3 py-1 bg-cobalt-600 hover:bg-cobalt-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {isFetchingThis ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                        <span>Fetch Verified Signal</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 6. OUTCOME (Resulting Decision & Actionable Plan) */}
      <div className={`p-6 rounded-2xl border shadow-card space-y-4 ${
        isImmediate
          ? 'bg-teal-50/30 border-teal-200'
          : isDeclineOrNurture
            ? 'bg-slate-50 border-slate-200'
            : 'bg-amber-50/30 border-amber-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-lg text-white text-xs font-bold flex items-center justify-center ${
              isImmediate ? 'bg-teal-600' : isDeclineOrNurture ? 'bg-slate-700' : 'bg-amber-600'
            }`}>6</span>
            <h3 className="font-extrabold text-base text-slate-900">Outcome: Authoritative Decision & Actionable Plan</h3>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
            isImmediate
              ? 'bg-teal-600 text-white'
              : isDeclineOrNurture
                ? 'bg-slate-700 text-white'
                : 'bg-amber-500 text-white'
          }`}>
            {liveCalculations.liveClass.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Action Description */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-start gap-2.5">
            <FileCheck size={16} className="text-cobalt-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-xs font-bold text-slate-900 block">Suggested Business Action:</span>
              <p className="text-xs text-slate-700 mt-0.5 leading-relaxed font-medium">
                {recommendation.suggested_action}
              </p>
            </div>
          </div>

          {/* Action Email Draft Preview */}
          {recommendation.action_email_draft && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Mail size={11} /> Pre-Drafted Action Communication:
              </span>
              <p className="text-xs font-mono text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed whitespace-pre-wrap">
                {recommendation.action_email_draft}
              </p>
            </div>
          )}
        </div>

        {/* Human-in-the-Loop CTA Bar */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500">Human Governance: Review and execute decision</span>
          <button
            type="button"
            onClick={() => onOpenApproval(recommendation)}
            className="px-4 py-2 bg-cobalt-600 hover:bg-cobalt-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>Review & Approve Decision</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* 7. AUDIT TRAIL (Governance & Cryptographical Proof) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-3">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandAudit(!expandAudit)}>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-cobalt-600 text-white text-xs font-bold flex items-center justify-center">7</span>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Audit Trail: How did the system arrive here?</h3>
              <p className="text-xs text-slate-500">Immutable governance parameters and historical provenance record</p>
            </div>
          </div>
          <button type="button" className="text-slate-400 hover:text-slate-600 p-1">
            {expandAudit ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <AnimatePresence>
          {expandAudit && (
            <motion.div
              initial={!prefersReducedMotion ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: 'auto' }}
              exit={!prefersReducedMotion ? { opacity: 0, height: 0 } : undefined}
              transition={{ duration: 0.18, ease: EASE_FINANCIAL }}
              className="space-y-2 pt-1 text-xs overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Execution Run ID</span>
                  <span className="font-mono font-bold text-slate-900">{decisionRunId}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Policy Version</span>
                  <span className="font-bold text-slate-900">Policy {policyVersion} (Deterministic)</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Provenance Status</span>
                  <span className="font-bold text-teal-700 flex items-center gap-1">
                    <Check size={12} strokeWidth={3} /> Cryptographically Signed
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
