import React, { useEffect, useState } from 'react';
import { X, SlidersHorizontal, History, AlertTriangle, Save } from 'lucide-react';
import { decisionForgeService } from '../../services/decisionForgeService';
import type { DecisionPolicy } from '../../services/decisionForgeService';

interface PolicyModalProps {
  onClose: () => void;
  onSaved: () => void;
}

interface WeightField {
  key: keyof Pick<
    DecisionPolicy,
    'dealValueWeight' | 'winProbabilityWeight' | 'engagementWeight' | 'recencyWeight' | 'intentExternalWeight'
  >;
  label: string;
  hint: string;
}

const WEIGHT_FIELDS: WeightField[] = [
  { key: 'dealValueWeight', label: 'Deal Size Impact', hint: 'Larger deals score higher' },
  { key: 'winProbabilityWeight', label: 'Win Likelihood', hint: 'From CRM pipeline stage' },
  { key: 'engagementWeight', label: 'Account Engagement', hint: 'Rep-logged interaction depth' },
  { key: 'recencyWeight', label: 'Recency & Momentum', hint: 'Penalizes stalled contact' },
  { key: 'intentExternalWeight', label: 'External Market Signal', hint: 'Only once fetched per account' },
];

export const PolicyModal: React.FC<PolicyModalProps> = ({ onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DecisionPolicy[]>([]);
  const [weights, setWeights] = useState({
    dealValueWeight: 0.25,
    winProbabilityWeight: 0.2,
    engagementWeight: 0.2,
    recencyWeight: 0.15,
    intentExternalWeight: 0.2,
    highPriorityThreshold: 75,
    mediumPriorityThreshold: 55,
  });
  const [activeVersion, setActiveVersion] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { active, history } = await decisionForgeService.getPolicy();
        setWeights({
          dealValueWeight: active.dealValueWeight,
          winProbabilityWeight: active.winProbabilityWeight,
          engagementWeight: active.engagementWeight,
          recencyWeight: active.recencyWeight,
          intentExternalWeight: active.intentExternalWeight,
          highPriorityThreshold: active.highPriorityThreshold,
          mediumPriorityThreshold: active.mediumPriorityThreshold,
        });
        setActiveVersion(active.version);
        setHistory(history);
      } catch (err) {
        console.error('Failed to load policy', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const total =
    weights.dealValueWeight +
    weights.winProbabilityWeight +
    weights.engagementWeight +
    weights.recencyWeight +
    weights.intentExternalWeight;
  const totalOk = Math.abs(total - 1.0) <= 0.02;

  const setWeight = (key: keyof typeof weights, value: number) => setWeights((w) => ({ ...w, [key]: value }));

  const handleSave = async () => {
    setError(null);
    if (!totalOk) {
      setError(`Weights must sum to 100% (currently ${Math.round(total * 100)}%). Adjust the sliders so they add up.`);
      return;
    }
    setSaving(true);
    try {
      await decisionForgeService.savePolicy(weights);
      onSaved();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.message || (err as any)?.message || 'Failed to save policy.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1.5 w-fit">
              <SlidersHorizontal className="w-3 h-3" /> Configurable Decision Policy
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1.5">Scoring Weights & Priority Thresholds</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeVersion ? `Currently active: v${activeVersion}` : 'Loading current policy...'} — saving creates a new version; past decision runs keep the version they were made under.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-xs text-slate-400">Loading policy configuration...</div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Scoring Weights</span>
                <span className={`text-xs font-mono font-bold ${totalOk ? 'text-emerald-600' : 'text-red-600'}`}>
                  Total: {Math.round(total * 100)}%
                </span>
              </div>

              {WEIGHT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{f.label} <span className="text-slate-400 font-normal">— {f.hint}</span></span>
                    <span className="text-rose-600 font-bold">{Math.round(weights[f.key] * 100)}%</span>
                  </div>
                  <input
                    id={`policy-weight-${f.key}`}
                    type="range"
                    min={0}
                    max={0.6}
                    step={0.05}
                    value={weights[f.key]}
                    onChange={(e) => setWeight(f.key, parseFloat(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">"Act Now" Threshold</span>
                    <span className="text-emerald-600 font-bold">≥ {weights.highPriorityThreshold}</span>
                  </div>
                  <input
                    id="policy-high-threshold"
                    type="range"
                    min={50}
                    max={95}
                    step={1}
                    value={weights.highPriorityThreshold}
                    onChange={(e) => setWeight('highPriorityThreshold', parseFloat(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">"Qualify" Threshold</span>
                    <span className="text-amber-600 font-bold">≥ {weights.mediumPriorityThreshold}</span>
                  </div>
                  <input
                    id="policy-medium-threshold"
                    type="range"
                    min={20}
                    max={weights.highPriorityThreshold - 1}
                    step={1}
                    value={Math.min(weights.mediumPriorityThreshold, weights.highPriorityThreshold - 1)}
                    onChange={(e) => setWeight('mediumPriorityThreshold', parseFloat(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {history.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Version history
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {history.map((h) => (
                      <span
                        key={h.id}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          h.isActive ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold' : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        v{h.version}{h.isActive ? ' (active)' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2 text-xs font-semibold text-white rounded-lg shadow-sm flex items-center gap-2 transition bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : `Save as v${(activeVersion || 0) + 1} & Recalculate`}
          </button>
        </div>
      </div>
    </div>
  );
};
