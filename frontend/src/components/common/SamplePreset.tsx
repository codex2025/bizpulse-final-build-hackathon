import React from 'react';
import { Sparkles } from 'lucide-react';

interface SamplePresetProps {
  title: string;
  description: string;
  loading?: boolean;
  error?: string | null;
  onLoad: () => void;
  children: React.ReactNode;
}

/** An empty-state preview of sample data. Always labelled SAMPLE; nothing is saved until the user loads it. */
export const SamplePreset: React.FC<SamplePresetProps> = ({ title, description, loading, error, onLoad, children }) => (
  <section
    data-testid="sample-preset"
    aria-label={title}
    className="rounded-3xl border border-dashed border-violet-300 bg-violet-50/40 p-5 space-y-4"
  >
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 border border-violet-200">
            Sample
          </span>
          <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
        </div>
        <p className="text-xs text-slate-500 font-medium mt-1 max-w-2xl">{description}</p>
      </div>
      <button
        type="button"
        onClick={onLoad}
        disabled={loading}
        className="btn-primary inline-flex items-center justify-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-60 shrink-0"
      >
        <Sparkles size={14} />
        {loading ? 'Loading…' : 'Load sample into my workspace'}
      </button>
    </div>
    {error && <p className="text-xs font-semibold text-rose-600" role="alert">{error}</p>}
    <div className="opacity-90">{children}</div>
  </section>
);
