import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Search, Receipt, Calendar, Tag, 
  Trash2, TrendingUp, Wallet, X, PlusCircle, Download
} from 'lucide-react';
import { Topbar } from '../common/Topbar';
import { expenseService } from '../../services/invoiceService';
import { CustomDropdown } from '../common/CustomDropdown';
import { useToast } from '../../context/ToastContext';
import { StatementImportModal } from './StatementImportModal';

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

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: expenseService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => expenseService.create(data),
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

  const filteredExpenses = expenses.filter((e: any) => {
    const matchFilter = filter === 'all' || e.category?.toLowerCase() === filter.toLowerCase();
    const matchSearch = e.description?.toLowerCase().includes(search.toLowerCase()) || 
                        e.category?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalThisMonth = expenses.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Topbar title="Expense Manager" subtitle="Track and manage all categorized outflows" />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-2 text-slate-500">
            <Wallet size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Total Logged Outflows</span>
          </div>
          <p className="text-2xl font-black text-slate-900">₹{totalThisMonth.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 font-medium mt-1">Across all categories</p>
        </div>
        <div className="card border-brand-100 bg-brand-50/50">
          <div className="flex items-center gap-3 mb-2 text-brand-600">
            <TrendingUp size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Top Category</span>
          </div>
          <p className="text-2xl font-black text-slate-900 capitalize">
            {expenses.length > 0 ? expenses[0].category : 'Software'}
          </p>
          <p className="text-xs text-brand-600/70 font-medium mt-1">Highest individual category</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2 text-slate-500">
            <Receipt size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Recent Transaction</span>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {expenses.length > 0 ? `₹${Number(expenses[0].amount).toLocaleString('en-IN')}` : '₹0'}
          </p>
          <p className="text-xs text-slate-400 font-medium mt-1 capitalize">{expenses.length > 0 ? expenses[0].category : 'No entries yet'}</p>
        </div>
      </div>

      <div className="card bg-white">
        {/* Table Header / Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input 
                type="text" 
                placeholder="Search expenses by keyword..." 
                className="input-field pl-9 text-xs font-semibold"
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center justify-center gap-2 cursor-pointer text-xs font-extrabold px-3.5 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all"
            >
              <Download size={14} />
              Import Statement
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn-primary flex items-center justify-center gap-2 cursor-pointer text-xs font-extrabold"
            >
              <Plus size={16} />
              Add Expense
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
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500 text-xs font-semibold">Loading expenses...</td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400 text-xs font-semibold">No expenses found matching your criteria.</td>
                </tr>
              ) : filteredExpenses.map((exp: any) => (
                <tr key={exp.id} className="group hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      <Tag size={10} />
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-bold text-slate-800">
                    {exp.description || 'General Expense'}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} />
                      {new Date(exp.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="bg-emerald-50 text-emerald-800 font-extrabold px-2.5 py-1 rounded-lg border border-emerald-200 text-xs">
                      ₹{Number(exp.amount).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button 
                      onClick={() => deleteMutation.mutate(exp.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 rounded-lg cursor-pointer"
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

      {/* Add Expense Modal with Custom Dropdown */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="card w-full max-w-md shadow-2xl border-slate-200 bg-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <PlusCircle className="text-brand-600" size={18} />
                New Outflow Entry
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createMutation.mutate({
                category: modalCategory,
                description: formData.get('description'),
                amount: Number(formData.get('amount')),
                expense_date: formData.get('date'),
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
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Amount (₹)</label>
                <input name="amount" type="number" step="0.01" className="input-field" placeholder="e.g. 4500" required />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Date</label>
                <input name="date" type="date" className="input-field" defaultValue={new Date().toISOString().split('T')[0]} required />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Description</label>
                <textarea name="description" className="input-field min-h-[70px]" placeholder="What was this outflow for?"></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary flex-1 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {createMutation.isPending ? 'Logging...' : 'Save Outflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
