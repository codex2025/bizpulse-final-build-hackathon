import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { loadSampleWorkspace } from '../../services/sampleWorkspaceService';

/** Shown only on a completely empty workspace. Loading is opt-in and creates ordinary records the user can delete. */
export const SampleWorkspaceCard: React.FC = () => {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await loadSampleWorkspace((p) => setDetail(p.detail));
      if (res.contractsFailed > 0) setNote(`${res.contractsFailed} sample contract(s) could not be analysed (is the AI service running?). Everything else loaded.`);
      await qc.invalidateQueries();
    } catch {
      setError('Could not load the sample workspace. Check that the API is running and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="sample-workspace" className="rounded-3xl border border-dashed border-violet-300 bg-violet-50/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 border border-violet-200">Sample</span>
          <h3 className="text-sm font-extrabold text-slate-900">Try Bizpulse with a sample enterprise workspace</h3>
        </div>
        <p className="text-xs text-slate-500 font-medium mt-1 max-w-2xl">
          Adds three clients (Apex Dynamics, Zenith Global Logistics, Hyperion Tech), four itemised GST invoices, eight expenses and three analysed contracts
          (MSA, cloud SLA, vendor NDA). Nothing is added unless you click; afterwards they are ordinary records you can edit or delete.
        </p>
        {busy && <p className="text-xs font-bold text-violet-700 mt-2" role="status">{detail || 'Working'}…</p>}
        {note && <p className="text-xs font-semibold text-amber-700 mt-2">{note}</p>}
        {error && <p className="text-xs font-semibold text-rose-600 mt-2" role="alert">{error}</p>}
      </div>
      <button
        type="button"
        onClick={load}
        disabled={busy}
        className="btn-primary inline-flex items-center justify-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-60 shrink-0"
      >
        <Sparkles size={14} />
        {busy ? 'Loading…' : 'Load sample workspace'}
      </button>
    </section>
  );
};
