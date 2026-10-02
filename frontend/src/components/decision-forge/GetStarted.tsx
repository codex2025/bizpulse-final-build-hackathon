import React, { useState } from 'react';
import { Download, UploadCloud, PlayCircle, Sparkles, FileSpreadsheet } from 'lucide-react';
import { decisionForgeService } from '../../services/decisionForgeService';
import { DataIngestionTab } from './DataIngestionTab';

export const SAMPLE_CSV_URL = '/sample-data/crm_opportunities_sample.csv';

const COLUMNS: Array<[string, string, boolean]> = [
  ['Company Name', 'Who the deal is with', true],
  ['Deal Value', 'Amount in USD, e.g. 340000', true],
  ['Win Probability', '0.85 or 85%', true],
  ['Stage', 'e.g. Proposal Review', false],
  ['Last Contact Date', 'YYYY-MM-DD; old dates are flagged as stale', false],
  ['Engagement Score', '0 to 100', false],
  ['Owner', 'Sales rep, used for capacity', false],
  ['Sales Notes', 'Free text; this is the evidence the engine cites', false],
];

const STEPS = [
  { icon: Download, title: 'Get a CSV', text: 'Download our sample file, or export opportunities from your own CRM.' },
  { icon: UploadCloud, title: 'Upload and check it', text: 'Columns are matched automatically and data problems are listed before anything is used.' },
  { icon: PlayCircle, title: 'Get decisions', text: 'Ranked opportunities with the reasons, the evidence, what-if simulation and your approval.' },
];

interface GetStartedProps {
  /** Called once data has been activated (uploaded or sample). */
  onReady: (message: string) => void;
}

/** First screen for a user with no data: nothing is analysed until they upload a file or ask for the sample. */
export const GetStarted: React.FC<GetStartedProps> = ({ onReady }) => {
  const [loadingSample, setLoadingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useSample = async () => {
    setLoadingSample(true);
    setError(null);
    try {
      await decisionForgeService.resetDemoData('real', false);
      onReady('Sample dataset loaded and analysed.');
    } catch {
      setError('Could not load the sample dataset. Please try again in a moment.');
      setLoadingSample(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="df-get-started">
      <section data-tour="decision-progression" className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-violet-50 text-violet-700 border border-violet-200">
            Start here
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-2">Which deals should your sales team work on first?</h1>
          <p className="text-sm text-slate-600 mt-1.5 max-w-3xl leading-relaxed">
            Give the decision engine a list of sales opportunities. It checks the data, scores every deal with a visible formula,
            shows the notes that support each recommendation, lets you test what-if scenarios, and waits for your approval.
            Your workspace is empty until you add data.
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/60">
              <span className="w-8 h-8 shrink-0 rounded-full bg-violet-600 text-white text-sm font-black flex items-center justify-center">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><s.icon size={14} className="text-violet-600" />{s.title}</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <a
            href={SAMPLE_CSV_URL}
            download
            data-testid="download-sample-csv"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-sm transition"
          >
            <Download size={14} /> Download sample CSV (40 deals)
          </a>
          <button
            type="button"
            onClick={useSample}
            disabled={loadingSample}
            data-testid="use-sample-dataset"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-300 transition cursor-pointer disabled:opacity-60"
          >
            <Sparkles size={14} className="text-violet-600" />
            {loadingSample ? 'Loading sample…' : 'No file? Use our sample dataset'}
          </button>
          <span className="text-[11px] text-slate-500">The sample is 12 real companies with cited public sources. It loads only if you click.</span>
        </div>
        {error && <p className="text-xs font-semibold text-rose-600" role="alert">{error}</p>}
      </section>

      <DataIngestionTab firstRun onDatasetUpdated={() => onReady('Your dataset is active and analysed.')} />

      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><FileSpreadsheet size={15} className="text-violet-600" /> What the CSV needs</h2>
        <p className="text-xs text-slate-500 mt-1">One row per sales opportunity. Column names are matched loosely ("Account", "Amount", "Rep" also work). Missing values are reported, never filled in.</p>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="py-2 pr-4 font-bold">Column</th>
                <th className="py-2 pr-4 font-bold">What goes in it</th>
                <th className="py-2 font-bold">Needed</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map(([name, hint, required]) => (
                <tr key={name} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 font-bold text-slate-800 whitespace-nowrap">{name}</td>
                  <td className="py-2 pr-4 text-slate-600">{hint}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${required ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {required ? 'Core' : 'Recommended'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
