import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Plus, Trash2, X, Shield
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Topbar } from '../common/Topbar';
import { wealthService } from '../../services/analyticsService';

const ASSET_CATEGORIES = [
  { id: 'cash', label: 'Cash in Hand', icon: '💵' },
  { id: 'bank', label: 'Bank Account', icon: '🏦' },
  { id: 'stocks', label: 'Stocks / Equity', icon: '📈' },
  { id: 'mutual_funds', label: 'Mutual Funds', icon: '📊' },
  { id: 'gold', label: 'Gold & Jewellery', icon: '🥇' },
  { id: 'real_estate', label: 'Real Estate', icon: '🏠' },
  { id: 'fd', label: 'Fixed Deposit', icon: '🏛️' },
  { id: 'pf', label: 'PF / NPS', icon: '🛡️' },
  { id: 'other', label: 'Other Asset', icon: '💎' },
];

const LIABILITY_CATEGORIES = [
  { id: 'home_loan', label: 'Home Loan', icon: '🏠' },
  { id: 'personal_loan', label: 'Personal Loan', icon: '💳' },
  { id: 'credit_card', label: 'Credit Card Dues', icon: '💳' },
  { id: 'vehicle_loan', label: 'Vehicle Loan', icon: '🚗' },
  { id: 'other', label: 'Other Liability', icon: '📋' },
];

const CHART_COLORS = ['#6366f1', '#e11d48', '#8b5cf6', '#f59e0b', '#06b6d4', '#10b981', '#f97316', '#84cc16', '#14b8a6'];

const fmt = (n: number) =>
  '₹' + (n >= 10000000 ? (n / 10000000).toFixed(2) + 'Cr' : n >= 100000 ? (n / 100000).toFixed(2) + 'L' : n.toLocaleString('en-IN'));

type ItemType = 'asset' | 'liability';

const AddItemModal: React.FC<{ type: ItemType; onClose: () => void; onDone: () => void }> = ({ type, onClose, onDone }) => {
  const categories = type === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;
  const [form, setForm] = useState({
    name: '',
    category: categories[0].id,
    value: '',
    institution: '',
    notes: '',
    as_of_date: new Date().toISOString().split('T')[0],
  });

  const mutation = useMutation({
    mutationFn: () => wealthService.create({ ...form, type, value: Number(form.value) }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {type === 'asset'
              ? <TrendingUp size={18} className="text-emerald-600" />
              : <TrendingDown size={18} className="text-red-500" />
            }
            <h2 className="font-extrabold text-slate-900">Add {type === 'asset' ? 'Asset' : 'Liability'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input-field w-full text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Name / Description *</label>
            <input
              type="text"
              placeholder={type === 'asset' ? 'e.g. HDFC Savings Account' : 'e.g. SBI Home Loan'}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field w-full text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Current Value (₹) *</label>
              <input
                type="number"
                placeholder="0"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="input-field w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">As of Date</label>
              <input
                type="date"
                value={form.as_of_date}
                onChange={(e) => setForm({ ...form, as_of_date: e.target.value })}
                className="input-field w-full text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Institution (optional)</label>
            <input
              type="text"
              placeholder="e.g. HDFC Bank, Zerodha, LIC..."
              value={form.institution}
              onChange={(e) => setForm({ ...form, institution: e.target.value })}
              className="input-field w-full text-sm"
            />
          </div>
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={!form.name || !form.value || mutation.isPending}
          className={`w-full py-3 text-sm font-extrabold rounded-2xl text-white transition-all disabled:opacity-50 cursor-pointer ${
            type === 'asset' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {mutation.isPending ? 'Saving...' : `Add ${type === 'asset' ? 'Asset' : 'Liability'}`}
        </button>
      </motion.div>
    </div>
  );
};

export const WealthPage: React.FC = () => {
  const qc = useQueryClient();
  const [addModal, setAddModal] = useState<ItemType | null>(null);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['wealth-summary'],
    queryFn: wealthService.getSummary,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wealthService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wealth-summary'] }),
  });

  const onDone = () => qc.invalidateQueries({ queryKey: ['wealth-summary'] });

  const netWorth = summary?.netWorth || 0;
  const isPositive = netWorth >= 0;
  const assets = (summary?.items || []).filter((i: any) => i.type === 'asset');
  const liabilities = (summary?.items || []).filter((i: any) => i.type === 'liability');

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      <Topbar
        title="Net Worth Tracker"
        subtitle="Your complete financial picture — assets, liabilities, and wealth position"
      />

      {/* Net Worth Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700 shadow-xl"
      >
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Total Net Worth</p>
        <p className={`text-5xl font-black tracking-tight mb-3 ${isPositive ? 'text-white' : 'text-red-400'}`}>
          {isPositive ? '' : '-'}{fmt(Math.abs(netWorth))}
        </p>
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-emerald-400 font-black">+{fmt(summary?.totalAssets || 0)}</span>
            <span className="text-slate-400 font-medium ml-1.5">Total Assets</span>
          </div>
          <div>
            <span className="text-red-400 font-black">-{fmt(summary?.totalLiabilities || 0)}</span>
            <span className="text-slate-400 font-medium ml-1.5">Total Liabilities</span>
          </div>
          {(summary?.debtToAssetRatio || 0) > 0 && (
            <div>
              <span className={`font-black ${(summary?.debtToAssetRatio || 0) > 60 ? 'text-amber-400' : 'text-slate-300'}`}>
                {summary?.debtToAssetRatio}%
              </span>
              <span className="text-slate-400 font-medium ml-1.5">Debt-to-Asset Ratio</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Add Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setAddModal('asset')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold transition-all shadow-sm cursor-pointer"
        >
          <Plus size={15} /> Add Asset
        </button>
        <button
          onClick={() => setAddModal('liability')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-extrabold transition-all shadow-sm cursor-pointer"
        >
          <Plus size={15} /> Add Liability
        </button>
      </div>

      {isLoading && <div className="py-16 text-center text-slate-400 font-semibold">Loading wealth data...</div>}

      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Asset Breakdown */}
          <div className="card border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <TrendingUp size={16} className="text-emerald-600" />
              <h3 className="font-extrabold text-slate-900 text-sm">Assets</h3>
              <span className="ml-auto font-black text-emerald-700">{fmt(summary?.totalAssets || 0)}</span>
            </div>

            {(summary?.assetChartData || []).length > 0 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={summary.assetChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                      {summary.assetChartData.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm font-medium">No assets added yet</div>
            )}

            <div className="space-y-2">
              {assets.map((item: any) => {
                const cat = ASSET_CATEGORIES.find((c) => c.id === item.category);
                return (
                  <motion.div
                    key={item.id}
                    layout
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{cat?.icon || '💎'}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{cat?.label || item.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-emerald-700">{fmt(item.value)}</span>
                      <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 rounded-lg text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Liability Breakdown */}
          <div className="card border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <TrendingDown size={16} className="text-red-500" />
              <h3 className="font-extrabold text-slate-900 text-sm">Liabilities</h3>
              <span className="ml-auto font-black text-red-600">{fmt(summary?.totalLiabilities || 0)}</span>
            </div>

            {(summary?.liabilityChartData || []).length > 0 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={summary.liabilityChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                      {summary.liabilityChartData.map((_: any, i: number) => (
                        <Cell key={i} fill={['#f87171', '#fb923c', '#fbbf24', '#a78bfa', '#60a5fa'][i % 5]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Shield size={32} className="text-emerald-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm font-medium">No liabilities — debt free! 🎉</p>
              </div>
            )}

            <div className="space-y-2">
              {liabilities.map((item: any) => {
                const cat = LIABILITY_CATEGORIES.find((c) => c.id === item.category);
                return (
                  <motion.div
                    key={item.id}
                    layout
                    className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 border border-red-100 group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{cat?.icon || '📋'}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{cat?.label || item.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-red-600">{fmt(item.value)}</span>
                      <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 rounded-lg text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {addModal && (
          <AddItemModal type={addModal} onClose={() => setAddModal(null)} onDone={onDone} />
        )}
      </AnimatePresence>
    </div>
  );
};
