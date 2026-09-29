import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload, CheckCircle2, AlertTriangle,
  X, Loader2, Download, ChevronRight, Sparkles
} from 'lucide-react';
import { statementService } from '../../services/analyticsService';

const BIZPULSE_CATEGORIES = [
  "Food & Groceries", "Dining & Restaurants", "Transport & Fuel",
  "Software & Subscriptions", "Utilities & Bills", "Rent & Housing",
  "Entertainment & Leisure", "Shopping & Apparel", "Healthcare & Medical",
  "Education & Courses", "Travel & Hotels", "Office & Supplies",
  "Insurance", "EMI & Loan Repayment", "Other Expense"
];

interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  confidence: 'high' | 'review';
  selected: boolean;
}

interface Props {
  onClose: () => void;
}

export const StatementImportModal: React.FC<Props> = ({ onClose }) => {
  const qc = useQueryClient();
  const [step, setStep] = useState<'upload' | 'parsing' | 'review' | 'importing' | 'done'>('upload');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setError(null);
    setStep('parsing');

    try {
      const result = await statementService.importStatement(file);
      const txs: Transaction[] = (result.transactions || []).map((t: any) => ({
        ...t,
        selected: t.type === 'expense', // pre-select expense transactions
      }));
      setTransactions(txs);
      setStep('review');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to parse statement. Please check the file format and try again.');
      setStep('upload');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxFiles: 1,
    disabled: step === 'parsing',
  });

  const toggleAll = (selected: boolean) => {
    setTransactions((prev) => prev.map((t) => ({ ...t, selected })));
  };

  const toggleOne = (idx: number) => {
    setTransactions((prev) => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  };

  const updateCategory = (idx: number, cat: string) => {
    setTransactions((prev) => prev.map((t, i) => i === idx ? { ...t, category: cat } : t));
  };

  const handleImport = async () => {
    const selected = transactions.filter((t) => t.selected && t.type === 'expense');
    if (selected.length === 0) return;
    
    setStep('importing');
    try {
      const result = await statementService.bulkImportExpenses(selected);
      setImportResult({ imported: result.imported });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['forecast'] });
      setStep('done');
    } catch (err: any) {
      setError('Import failed. Please try again.');
      setStep('review');
    }
  };

  const selectedCount = transactions.filter((t) => t.selected && t.type === 'expense').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center">
              <Download size={18} />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900">Import Bank Statement</h2>
              <p className="text-[11px] font-medium text-slate-500">CSV or PDF → AI categorizes transactions automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 cursor-pointer"><X size={18} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">

            {/* UPLOAD STEP */}
            {(step === 'upload' || step === 'parsing') && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all ${
                    isDragActive ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50/50'
                  }`}
                >
                  <input {...getInputProps()} />
                  {step === 'parsing' ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={36} className="text-brand-500 animate-spin" />
                      <p className="font-extrabold text-slate-700">Parsing & categorizing transactions...</p>
                      <p className="text-sm text-slate-400">AI is analyzing your statement</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                        <Upload size={28} className="text-brand-400" />
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-800">Drop your bank statement here</p>
                        <p className="text-sm text-slate-500 font-medium mt-1">Supports CSV and PDF exports from major Indian banks</p>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {['CSV', 'PDF', 'TXT'].map((fmt) => (
                          <span key={fmt} className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">{fmt}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-4 rounded-2xl bg-red-50 border border-red-200">
                    <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm font-medium text-red-700">{error}</p>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <p className="text-xs font-bold text-amber-800 mb-1">💡 How to export your bank statement:</p>
                  <ul className="text-xs text-amber-700 font-medium space-y-1">
                    <li>• <strong>HDFC/SBI/ICICI:</strong> NetBanking → Statement → Download CSV</li>
                    <li>• <strong>Kotak/Axis:</strong> Mobile app → Statements → Export to CSV</li>
                    <li>• <strong>GPay/PhonePe:</strong> History → Download transaction history</li>
                  </ul>
                </div>
              </motion.div>
            )}

            {/* REVIEW STEP */}
            {step === 'review' && (
              <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-brand-600" />
                    <span className="font-extrabold text-slate-800 text-sm">
                      {transactions.length} transactions extracted
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleAll(true)} className="text-xs font-bold text-brand-600 hover:underline cursor-pointer">Select All Expenses</button>
                    <button onClick={() => toggleAll(false)} className="text-xs font-bold text-slate-400 hover:underline cursor-pointer">Deselect All</button>
                  </div>
                </div>

                {/* Transaction List */}
                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                  {transactions.map((tx, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        tx.selected ? 'bg-brand-50/50 border-brand-100' : 'bg-slate-50 border-slate-100'
                      } ${tx.type === 'income' ? 'opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={tx.selected}
                        onChange={() => toggleOne(idx)}
                        disabled={tx.type === 'income'}
                        className="w-4 h-4 rounded accent-brand-600 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{tx.description}</p>
                        <p className="text-[10px] font-medium text-slate-400">{tx.date}</p>
                      </div>
                      <select
                        value={tx.category}
                        onChange={(e) => updateCategory(idx, e.target.value)}
                        className="text-[10px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 max-w-36 cursor-pointer"
                      >
                        {BIZPULSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-black ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                        </p>
                        <p className={`text-[9px] font-bold uppercase ${tx.confidence === 'high' ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {tx.confidence === 'high' ? '✓ Auto' : '⚠ Review'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5" />
                    <p className="text-xs font-medium text-red-700">{error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* IMPORTING */}
            {step === 'importing' && (
              <motion.div key="importing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 flex flex-col items-center gap-4">
                <Loader2 size={36} className="text-brand-500 animate-spin" />
                <p className="font-extrabold text-slate-700">Importing {selectedCount} transactions...</p>
              </motion.div>
            )}

            {/* DONE */}
            {step === 'done' && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-extrabold text-slate-900 text-lg">Import Complete!</p>
                  <p className="text-sm text-slate-500 font-medium mt-1">
                    {importResult?.imported} expense transactions have been added to your records.
                  </p>
                </div>
                <button onClick={onClose} className="btn-primary px-8 py-3 rounded-2xl font-extrabold cursor-pointer">Done</button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        {step === 'review' && (
          <div className="flex items-center justify-between p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
            <p className="text-xs font-semibold text-slate-500">
              {selectedCount} expense transactions selected for import
              {transactions.filter((t) => t.type === 'income').length > 0 && ` · ${transactions.filter((t) => t.type === 'income').length} income entries skipped`}
            </p>
            <button
              onClick={handleImport}
              disabled={selectedCount === 0}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-extrabold disabled:opacity-50 cursor-pointer"
            >
              Import {selectedCount} Expenses <ChevronRight size={15} />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
