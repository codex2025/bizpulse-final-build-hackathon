import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Search, Receipt, Calendar, Tag, 
  Trash2, TrendingUp, Wallet, X, PlusCircle, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Topbar } from '../common/Topbar';
import { expenseService } from '../../services/invoiceService';
import { CustomDropdown } from '../common/CustomDropdown';
import { useToast } from '../../context/ToastContext';
import { StatementImportModal } from './StatementImportModal';
import { toCsv, downloadCsv } from '../../utils/csv';
import { AnimatedNumber } from '../common/AnimatedNumber';

interface ExpenseItem {
  id: string;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  created_at?: string;
}

const CATEGORIES = [
  { value: 'software', label: 'Software & SaaS' },
  { value: 'rent', label: 'Rent & Workspace' },
  { value: 'marketing', label: 'Marketing & Ads' },
  { value: 'travel', label: 'Travel & Commute' },
  { value: 'legal', label: 'Legal & Accounting' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'office', label: 'Office & Supplies' },
  { value: 'food', label: 'Food & Dining' },
  { value: 'other', label: 'Other Outflow' },
];

export const ExpensesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modalCategory, setModalCategory] = useState('software');

  const { data: rawExpenses = [], isLoading } = useQuery<ExpenseItem[]>({
    queryKey: ['expenses'],
    queryFn: expenseService.getAll,
  });

  const expenses: ExpenseItem[] = Array.isArray(rawExpenses) ? rawExpenses : [];

  const createMutation = useMutation({
    mutationFn: (data: { category: string; description: string; amount: number; expense_date: string }) =>
      expenseService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['advanced-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['visualizations'] });
      setIsModalOpen(false);
      toast.success('Expense Logged', 'Transaction has been recorded to your ledger.');
    },
    onError: () => {
      toast.error('Failed to Log Expense', 'Please verify your inputs.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expenseService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['visualizations'] });
      toast.info('Expense Deleted', 'Record removed from ledger.');
    }
  });

  const filterOptions = [
    { value: 'all', label: 'All Categories' },
    ...CATEGORIES,
  ];

  const filteredExpenses = expenses.filter((e) => {
    const matchFilter = filter === 'all' || e.category?.toLowerCase() === filter.toLowerCase();
    const matchSearch = (e.description || '').toLowerCase().includes(search.toLowerCase()) || 
                        (e.category || '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseItem | null>(null);

  const categoryTotals = expenses.reduce((acc, curr) => {
    const cat = curr.category || 'other';
    acc[cat] = (acc[cat] || 0) + Number(curr.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const topCategory = topCategoryEntry ? topCategoryEntry[0] : 'None';
  const topCategoryAmount = topCategoryEntry ? topCategoryEntry[1] : 0;

  const mostRecent = [...expenses].sort((a, b) => String(b.expense_date || '').localeCompare(String(a.expense_date || '')))[0];

  const totalThisMonth = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const exportToCSV = () => {
    if (expenses.length === 0) {
      toast.info('No Data', 'No expenses available to export.');
      return;
    }
    const csv = toCsv(
      ['ID', 'Category', 'Description', 'Amount (INR)', 'Date'],
      expenses.map((e) => [e.id, e.category, e.description, Number(e.amount), e.expense_date]),
    );
    downloadCsv(`bizpulse_expenses_${new Date().toISOString().split('T')[0]}.csv`, csv);
    toast.success('Export Successful', 'Expenses exported as CSV');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Topbar title="Operational Outflows & Expense Ledger" subtitle="Detailed transaction registry, category tracking & statement reconciliation" />

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 border border-slate-200 rounded-3xl bg-white shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-slate-500">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Wallet size={14} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Logged Outflows</span>
          </div>
          <p className="text-2xl font-black text-ink-900 font-mono tabular-nums pt-1">
            <AnimatedNumber value={totalThisMonth} prefix="₹" />
          </p>
          <p className="text-xs text-slate-400 font-medium">Cumulative across {expenses.length} ledger entries</p>
        </div>

        <div className="card p-5 border border-cobalt-100 bg-cobalt-50/30 rounded-3xl shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-cobalt-600">
            <div className="w-7 h-7 rounded-lg bg-cobalt-100 flex items-center justify-center text-cobalt-600">
              <TrendingUp size={14} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider">Primary Outflow Category</span>
          </div>
          <p className="text-2xl font-black text-ink-900 capitalize pt-1">
            {CATEGORIES.find(c => c.value === topCategory)?.label || topCategory}
          </p>
          <p className="text-xs text-cobalt-700/80 font-medium font-mono">
            {topCategoryAmount > 0 ? `₹${topCategoryAmount.toLocaleString('en-IN')} total spent` : 'Largest operational line item'}
          </p>
        </div>

        <div className="card p-5 border border-slate-200 rounded-3xl bg-white shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-slate-500">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Receipt size={14} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider">Recent Disbursement</span>
          </div>
          <p className="text-2xl font-black text-ink-900 font-mono tabular-nums pt-1">
            {mostRecent ? (
              <AnimatedNumber value={Number(mostRecent.amount)} prefix="₹" />
            ) : '₹0'}
          </p>
          <p className="text-xs text-slate-400 font-medium capitalize truncate">
            {mostRecent ? (mostRecent.description || mostRecent.category) : 'No transactions recorded'}
          </p>
        </div>
      </div>

      {/* Main Ledger Card */}
      <div className="card p-6 border border-slate-200 rounded-3xl bg-white shadow-xs space-y-5">
        {/* Table Header / Actions Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input 
                type="text" 
                placeholder="Search ledger by description, vendor, or category..." 
                className="input-field pl-9 text-xs font-semibold w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {/* Custom Dropdown Filter */}
            <CustomDropdown
              options={filterOptions}
              value={filter}
              onChange={setFilter}
              className="w-full sm:w-48"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={exportToCSV}
              className="flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold px-3 py-2.5 rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all shadow-xs"
              title="Export CSV"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="flex items-center justify-center gap-2 cursor-pointer text-xs font-extrabold px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/70 transition-all"
            >
              <Download size={14} />
              Reconcile Statement
            </button>
            <button 
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="btn-primary flex items-center justify-center gap-2 cursor-pointer text-xs font-extrabold py-2.5 px-4 rounded-xl"
            >
              <Plus size={15} />
              Log Outflow
            </button>
          </div>
          {showImport && <StatementImportModal onClose={() => setShowImport(false)} />}
        </div>

        {/* Expenses Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 text-[11px] uppercase font-black tracking-wider">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 text-xs font-semibold animate-pulse">
                    Synchronizing ledger with database...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 text-xs font-medium">
                    No transactions match your search filter criteria.
                  </td>
                </tr>
              ) : filteredExpenses.map((exp) => (
                <tr key={exp.id} className="group hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      <Tag size={10} className="text-cobalt-600" />
                      {CATEGORIES.find(c => c.value === exp.category)?.label || exp.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-bold text-ink-900">
                    {exp.description || 'General Disbursement'}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <Calendar size={12} className="text-slate-400" />
                      {new Date(exp.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-ink-900 font-black font-mono tabular-nums text-xs">
                      ₹{Number(exp.amount).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button 
                      type="button"
                      onClick={() => setExpenseToDelete(exp)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 opacity-80 group-hover:opacity-100 transition-all hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Delete Entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="card w-full max-w-md shadow-2xl border border-slate-200 bg-white p-6 rounded-3xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-ink-900 flex items-center gap-2">
                  <PlusCircle className="text-cobalt-600" size={18} />
                  Record Operational Outflow
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createMutation.mutate({
                  category: modalCategory,
                  description: String(formData.get('description') || ''),
                  amount: Number(formData.get('amount')),
                  expense_date: String(formData.get('date')),
                });
              }} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Category</label>
                  <CustomDropdown
                    options={CATEGORIES}
                    value={modalCategory}
                    onChange={setModalCategory}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Disbursement Amount (₹)</label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    className="input-field font-mono"
                    placeholder="e.g. 18500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Transaction Date</label>
                  <input
                    name="date"
                    type="date"
                    className="input-field font-mono"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Description / Reference Note</label>
                  <textarea
                    name="description"
                    className="input-field min-h-[70px]"
                    placeholder="Operational purpose, invoice reference or supplier name..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn-secondary flex-1 text-xs cursor-pointer py-2.5 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={createMutation.isPending}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 text-xs cursor-pointer py-2.5 rounded-xl font-bold"
                  >
                    {createMutation.isPending ? 'Writing Ledger...' : 'Commit Outflow'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Delete Expense Confirmation Modal */}
        {expenseToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card w-full max-w-sm shadow-2xl border border-slate-200 bg-white p-6 rounded-3xl space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-ink-900">Delete Ledger Record?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to remove <span className="font-bold text-ink-900">"{expenseToDelete.description || expenseToDelete.category}"</span> (₹{Number(expenseToDelete.amount).toLocaleString('en-IN')})? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setExpenseToDelete(null)}
                  className="btn-secondary flex-1 text-xs cursor-pointer py-2.5 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteMutation.mutate(expenseToDelete.id);
                    setExpenseToDelete(null);
                  }}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer shadow-xs"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
