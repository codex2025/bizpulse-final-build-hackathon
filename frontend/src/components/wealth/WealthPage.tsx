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
import { AnimatedNumber } from '../common/AnimatedNumber';
import { SamplePreset } from '../common/SamplePreset';
import { SAMPLE_WEALTH } from '../../data/seedPresets';

export interface WealthItem {
  id: string;
  name: string;
  category: string;
  type: 'asset' | 'liability';
  value: number;
  notes?: string;
  institution?: string;
  as_of_date?: string;
}

export interface WealthChartData {
  name: string;
  value: number;
}

export interface WealthSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  assetChartData: WealthChartData[];
  liabilityChartData: WealthChartData[];
  items: WealthItem[];
}

const ASSET_CATEGORIES = [
  { id: 'cash', label: 'Cash in Hand / Petty Cash', icon: '💵' },
  { id: 'bank', label: 'Current & Escrow Bank Accounts', icon: '🏦' },
  { id: 'stocks', label: 'Securities & Market Equities', icon: '📈' },
  { id: 'mutual_funds', label: 'Mutual Funds & Liquid ETFs', icon: '📊' },
  { id: 'gold', label: 'Commodity Reserves & Gold', icon: '🥇' },
  { id: 'real_estate', label: 'Real Estate & Land Holdings', icon: '🏠' },
  { id: 'fd', label: 'Fixed Term Deposits', icon: '🏛️' },
  { id: 'pf', label: 'Statutory Reserves & Funds', icon: '🛡️' },
  { id: 'other', label: 'Other Capital Assets', icon: '💎' },
];

const LIABILITY_CATEGORIES = [
  { id: 'home_loan', label: 'Commercial Mortgage / Real Estate Loan', icon: '🏠' },
  { id: 'personal_loan', label: 'Term Business Credit Facility', icon: '💳' },
  { id: 'credit_card', label: 'Corporate Card Dues & Float', icon: '💳' },
  { id: 'vehicle_loan', label: 'Commercial Fleet / Vehicle Facility', icon: '🚗' },
  { id: 'other', label: 'Other Legal Liabilities', icon: '📋' },
];

// Larger distinct color palettes to avoid repeat
const ASSET_CHART_COLORS = [
  '#2457FF', '#00A88F', '#111827', '#F5B700', '#64748B',
  '#7C3AED', '#E11D48', '#059669', '#D97706', '#0EA5E9',
];
const LIABILITY_CHART_COLORS = [
  '#F04438', '#F5B700', '#64748B', '#94A3B8',
  '#7C3AED', '#E11D48', '#D97706', '#0EA5E9',
];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            {type === 'asset'
              ? <TrendingUp size={18} className="text-teal-600" />
              : <TrendingDown size={18} className="text-vermilion-600" />
            }
            <h2 className="font-extrabold text-ink-900 text-base">Record {type === 'asset' ? 'Capital Asset' : 'Liability'}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Asset / Debt Classification</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input-field w-full text-xs font-semibold"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Descriptor / Facility Name *</label>
            <input
              type="text"
              placeholder={type === 'asset' ? 'e.g. HDFC Commercial Current Account' : 'e.g. Ujjivan MSE Secured Loan'}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field w-full text-xs font-semibold"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Valuation / Principal (₹) *</label>
              <input
                type="number"
                placeholder="0"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="input-field w-full text-xs font-semibold font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">As of Date</label>
              <input
                type="date"
                value={form.as_of_date}
                onChange={(e) => setForm({ ...form, as_of_date: e.target.value })}
                className="input-field w-full text-xs font-semibold font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Counterparty / Institution (Optional)</label>
            <input
              type="text"
              placeholder="e.g. ICICI Bank, SBI, Zerodha, Apex Estates..."
              value={form.institution}
              onChange={(e) => setForm({ ...form, institution: e.target.value })}
              className="input-field w-full text-xs font-semibold"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!form.name || !form.value || mutation.isPending}
          className={`w-full py-2.5 text-xs font-extrabold rounded-xl text-white transition-all disabled:opacity-50 cursor-pointer ${
            type === 'asset' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-vermilion-600 hover:bg-vermilion-700'
          }`}
        >
          {mutation.isPending ? 'Writing Ledger...' : `Save ${type === 'asset' ? 'Asset' : 'Liability'}`}
        </button>
      </motion.div>
    </div>
  );
};

export const WealthPage: React.FC = () => {
  const qc = useQueryClient();
  const [addModal, setAddModal] = useState<ItemType | null>(null);

  const { data: summary } = useQuery<WealthSummary>({
    queryKey: ['wealth-summary'],
    queryFn: wealthService.getSummary,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wealthService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wealth-summary'] }),
  });

  const onDone = () => qc.invalidateQueries({ queryKey: ['wealth-summary'] });

  const loadSample = useMutation({
    mutationFn: async () => {
      const asOf = new Date().toISOString().split('T')[0];
      for (const it of SAMPLE_WEALTH) {
        await wealthService.create({ ...it, as_of_date: asOf });
      }
    },
    onSuccess: onDone,
  });

  const netWorth = summary?.netWorth || 0;
  const isPositive = netWorth >= 0;
  const assets: WealthItem[] = (summary?.items || []).filter((i) => i.type === 'asset');
  const liabilities: WealthItem[] = (summary?.items || []).filter((i) => i.type === 'liability');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Topbar
        title="Balance Sheet & Capital Net Worth"
        subtitle="Holistic corporate wealth telemetry: consolidated assets, liabilities, and liquidity solvency"
      />

      {/* Net Worth Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl space-y-3"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Consolidated Balance Sheet Net Worth</p>
          <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
            isPositive
              ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
              : 'bg-vermilion-500/20 text-vermilion-300 border-vermilion-500/30'
          }`}>
            {isPositive ? 'SOLVENT CAPITAL POSITION' : 'LEVERAGED DEFICIT'}
          </span>
        </div>
        <p className={`text-5xl font-black tracking-tight font-mono tabular-nums ${isPositive ? 'text-white' : 'text-vermilion-400'}`}>
          {isPositive ? '' : '-'}<AnimatedNumber value={Math.abs(netWorth)} formatFn={(n) => fmt(n)} />
        </p>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Assets</p>
            <p className="text-xl font-black text-teal-400 font-mono tabular-nums mt-0.5">{fmt(summary?.totalAssets || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Liabilities & Debt</p>
            <p className="text-xl font-black text-vermilion-400 font-mono tabular-nums mt-0.5">{fmt(summary?.totalLiabilities || 0)}</p>
          </div>
        </div>
      </motion.div>

      {(summary?.items || []).length === 0 && (
        <SamplePreset
          title="Institutional asset & liability registry"
          description="An example balance sheet. Nothing is saved until you load it; after that the entries are normal and can be edited or deleted."
          loading={loadSample.isPending}
          error={loadSample.isError ? 'Could not load the sample registry. Please try again.' : null}
          onLoad={() => loadSample.mutate()}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['asset', 'liability'] as const).map((t) => {
              const rows = SAMPLE_WEALTH.filter((i) => i.type === t);
              const total = rows.reduce((s, r) => s + r.value, 0);
              return (
                <div key={t} className="rounded-2xl bg-white border border-slate-200 p-4 space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{t === 'asset' ? 'Assets' : 'Liabilities'}</span>
                    <span className="text-sm font-black font-mono tabular-nums text-slate-900">{fmt(total)}</span>
                  </div>
                  {rows.map((r) => (
                    <div key={r.name} className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-700">{r.name}</span>
                      <span className="font-mono font-bold tabular-nums text-slate-900">{fmt(r.value)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </SamplePreset>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setAddModal('asset')}
          className="flex-1 py-3 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-teal-100 transition-all cursor-pointer"
        >
          <Plus size={16} /> Add Capital Asset
        </button>
        <button
          type="button"
          onClick={() => setAddModal('liability')}
          className="flex-1 py-3 rounded-2xl bg-vermilion-50 border border-vermilion-200 text-vermilion-800 font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-vermilion-100 transition-all cursor-pointer"
        >
          <Plus size={16} /> Add Liability / Debt
        </button>
      </div>

      {/* Assets & Liabilities 2-Column Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Breakdown */}
        <div className="card border border-slate-200 bg-white p-6 rounded-3xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <TrendingUp size={16} className="text-teal-600" />
            <h3 className="font-extrabold text-ink-900 text-sm">Asset Portfolio Allocation</h3>
            <span className="ml-auto font-black text-teal-700 font-mono tabular-nums">{fmt(summary?.totalAssets || 0)}</span>
          </div>

          {(summary?.assetChartData || []).length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary?.assetChartData || []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                    {(summary?.assetChartData || []).map((_, i) => (
                      <Cell key={i} fill={ASSET_CHART_COLORS[i % ASSET_CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: unknown) => fmt(Number(v))}
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-sm font-medium">No assets registered yet</div>
          )}

          <div className="space-y-2">
            {assets.map((item) => {
              const cat = ASSET_CATEGORIES.find((c) => c.id === item.category);
              return (
                <motion.div
                  key={item.id}
                  layout
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{cat?.icon || '💎'}</span>
                    <div>
                      <p className="text-xs font-bold text-ink-900">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{cat?.label || item.category}</p>
                      {item.as_of_date && (
                        <p className="text-[10px] text-slate-300 font-mono">As of {new Date(item.as_of_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-teal-700 font-mono tabular-nums">{fmt(item.value)}</span>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="p-1 rounded-lg text-slate-300 hover:text-vermilion-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Liability Breakdown */}
        <div className="card border border-slate-200 bg-white p-6 rounded-3xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <TrendingDown size={16} className="text-vermilion-600" />
            <h3 className="font-extrabold text-ink-900 text-sm">Liabilities & Outstanding Debt</h3>
            <span className="ml-auto font-black text-vermilion-600 font-mono tabular-nums">{fmt(summary?.totalLiabilities || 0)}</span>
          </div>

          {(summary?.liabilityChartData || []).length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary?.liabilityChartData || []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                    {(summary?.liabilityChartData || []).map((_, i) => (
                      <Cell key={i} fill={LIABILITY_CHART_COLORS[i % LIABILITY_CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: unknown) => fmt(Number(v))}
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Shield size={32} className="text-teal-400 mx-auto mb-2" />
              <p className="text-slate-400 text-sm font-medium">Zero liabilities recorded — 100% unleveraged</p>
            </div>
          )}

          <div className="space-y-2">
            {liabilities.map((item) => {
              const cat = LIABILITY_CATEGORIES.find((c) => c.id === item.category);
              return (
                <motion.div
                  key={item.id}
                  layout
                  className="flex items-center justify-between p-3 rounded-2xl bg-vermilion-50/40 border border-vermilion-100 group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{cat?.icon || '📋'}</span>
                    <div>
                      <p className="text-xs font-bold text-ink-900">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{cat?.label || item.category}</p>
                      {item.as_of_date && (
                        <p className="text-[10px] text-slate-300 font-mono">As of {new Date(item.as_of_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-vermilion-600 font-mono tabular-nums">{fmt(item.value)}</span>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="p-1 rounded-lg text-slate-300 hover:text-vermilion-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {addModal && (
          <AddItemModal
            type={addModal}
            onClose={() => setAddModal(null)}
            onDone={onDone}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
