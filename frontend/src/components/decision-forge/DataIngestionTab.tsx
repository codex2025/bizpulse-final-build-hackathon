import React, { useState, useEffect } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { decisionForgeService } from '../../services/decisionForgeService';

interface DataIngestionTabProps {
  onDatasetUpdated: () => void;
}

const gradeBadgeClass = (grade?: string) => {
  if (!grade) return 'bg-slate-100 text-slate-600 border-slate-200';
  if (grade.startsWith('A')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (grade.startsWith('B')) return 'bg-sky-50 text-sky-700 border-sky-200';
  if (grade.startsWith('C')) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
};

interface IngestionUploadResult {
  filename?: string;
  total_records?: number;
  total_rows?: number;
  normalized_records: Record<string, unknown>[];
  mapping_proposal: {
    mapped_columns: Record<string, string>;
    unmapped_columns?: string[];
    confidence_scores?: Record<string, number>;
    canonical_coverage_percent?: number;
    is_ready_for_analysis?: boolean;
  };
}

interface IngestionQualityReport {
  completeness_percent: number;
  anomaly_count: number;
  stale_data_percent: number;
  total_records: number;
  quality_indicators?: Array<{ name: string; value: string }>;
  grade?: string;
  health_score?: number;
  duplicate_count?: number;
  stale_warnings?: string[];
}

export const DataIngestionTab: React.FC<DataIngestionTabProps> = ({ onDatasetUpdated }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [uploadResult, setUploadResult] = useState<IngestionUploadResult | null>(null);
  const [qualityReport, setQualityReport] = useState<IngestionQualityReport | null>(null);
  const [activated, setActivated] = useState(false);

  const loadCurrentQuality = async () => {
    try {
      const dataset = await decisionForgeService.getDataset();
      setQualityReport(dataset.quality_report);
    } catch {
      // Non-fatal -- the scorecard just stays empty until a run succeeds.
    }
  };

  useEffect(() => {
    loadCurrentQuality();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setActivated(false);
    try {
      const data = await decisionForgeService.uploadCsv(file);
      setUploadResult(data);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.detail || (err as any)?.message || 'File upload failed';
      alert(msg);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleActivate = async () => {
    if (!uploadResult?.normalized_records?.length) return;
    setIsActivating(true);
    try {
      await decisionForgeService.applyMapping(uploadResult.normalized_records);
      await loadCurrentQuality();
      setActivated(true);
      onDatasetUpdated();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.detail || (err as any)?.message || 'Failed to activate dataset';
      alert(msg);
    } finally {
      setIsActivating(false);
    }
  };

  const handleResetDemo = async () => {
    setIsUploading(true);
    try {
      await decisionForgeService.resetDemoData();
      setUploadResult(null);
      setActivated(false);
      await loadCurrentQuality();
      onDatasetUpdated();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.message || 'Demo reset failed';
      alert(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const indicators: Array<{ name: string; value: string }> = Array.isArray(qualityReport?.quality_indicators)
    ? qualityReport.quality_indicators
    : [];
  const getIndicator = (name: string) => indicators.find((i) => i.name === name)?.value;

  return (
    <div className="space-y-6">
      {/* Upload & Seed Container */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upload Card */}
        <div className="md:col-span-2 bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">CRM Data Ingestion & Auto-Mapper</h3>
              <p className="text-xs text-slate-500">
                Upload a CSV export from Salesforce, HubSpot, or a custom spreadsheet.
              </p>
            </div>
            <label className="cursor-pointer px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition">
              <UploadCloud className="w-4 h-4" />
              <span>{isUploading ? 'Reading file...' : 'Upload CSV File'}</span>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>

          {/* Drag & Drop Visual Area */}
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer relative">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <FileSpreadsheet className="w-10 h-10 text-rose-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">
              Drag & drop your CRM opportunity export here
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Recognized columns: Company, Deal Value, Win Rate, Stage, Last Contact, Owner, Notes
            </p>
          </div>

          {/* Quick Demo Dataset Action */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-600">
            <span>Want to test immediately with industrial equipment deals?</span>
            <button
              onClick={handleResetDemo}
              disabled={isUploading}
              className="font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Load Verified Industrial Dataset
            </button>
          </div>
        </div>

        {/* Data Quality Scorecard -- reflects the ACTIVE dataset, computed live */}
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Data Health Scorecard
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${gradeBadgeClass(qualityReport?.grade)}`}>
                {qualityReport?.grade || 'No data yet'}
              </span>
            </div>

            <div className="text-3xl font-extrabold text-slate-900 mb-1">
              {qualityReport?.health_score ?? '—'} <span className="text-xs text-slate-400 font-normal">/ 100</span>
            </div>
            <p className="text-xs text-slate-500">
              Composite hygiene index over the active dataset ({qualityReport?.total_records ?? 0} records): field completeness, duplicates, and staleness.
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Uniqueness:</span>
              <span className="font-bold text-slate-800">{getIndicator('Uniqueness') || '—'} ({qualityReport?.duplicate_count ?? 0} duplicates)</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Completeness:</span>
              <span className="font-bold text-slate-800">{getIndicator('Completeness') || '—'} valid fields</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Freshness:</span>
              <span className="font-bold text-amber-600">{getIndicator('Freshness') || '—'} active touchpoints</span>
            </div>
          </div>

          {(qualityReport?.stale_warnings?.length ?? 0) > 0 && (
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Stale-record warnings
              </span>
              {qualityReport?.stale_warnings && qualityReport.stale_warnings.slice(0, 3).map((w: string, i: number) => (
                <p key={i} className="text-[11px] text-slate-500 leading-snug">{w}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Auto-Mapping Proposal Table -- requires explicit activation before it affects decisions */}
      {uploadResult?.mapping_proposal && (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Review Proposed Column Mappings -- {uploadResult.filename}
              </h4>
              <p className="text-xs text-slate-500">
                {uploadResult.total_rows} rows detected. Mapped unfamiliar headers to canonical business fields with{' '}
                {uploadResult.mapping_proposal.canonical_coverage_percent}% coverage. Nothing below is used by the
                decision engine until you activate it.
              </p>
            </div>
            {activated ? (
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full flex items-center gap-1.5 flex-shrink-0">
                <CheckCircle className="w-3.5 h-3.5" /> Active dataset
              </span>
            ) : (
              <button
                onClick={handleActivate}
                disabled={isActivating || !uploadResult.mapping_proposal.is_ready_for_analysis}
                className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition"
                title={!uploadResult.mapping_proposal.is_ready_for_analysis ? 'Not enough required fields were recognized to activate this dataset.' : ''}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {isActivating ? 'Activating...' : 'Confirm & Activate Dataset'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(uploadResult.mapping_proposal.mapped_columns).map(([src, target]) => {
              const confidence = uploadResult.mapping_proposal.confidence_scores?.[src] ?? 1;
              return (
                <div key={src} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase">Source Column</span>
                  <span className="font-semibold text-slate-700 block truncate">{src}</span>
                  <div className="flex items-center justify-between gap-1 text-rose-600 font-bold pt-1 border-t border-slate-200/60">
                    <span className="truncate">→ {target}</span>
                    <span className={`text-[10px] flex-shrink-0 ${confidence < 0.8 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {Math.round(confidence * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {(uploadResult.mapping_proposal.unmapped_columns?.length ?? 0) > 0 && (
            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span className="font-semibold text-slate-600">Not mapped (ignored): </span>
              {uploadResult.mapping_proposal.unmapped_columns?.join(', ')}
            </div>
          )}

          {!uploadResult.mapping_proposal.is_ready_for_analysis && (
            <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Fewer than 4 canonical fields were recognized, or no company field was found. Rename your columns to match the recognized aliases and re-upload.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
