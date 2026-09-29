import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Plus, Trash2, CheckCircle2,
  Calendar, X, PlusCircle
} from 'lucide-react';
import { Topbar } from '../common/Topbar';
import { goalsService } from '../../services/analyticsService';

export interface GoalItem {
  id: string;
  title: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  category?: string;
  icon?: string;
  color?: string;
  status: 'active' | 'completed' | 'paused';
}

export interface GoalSummary {
  active: number;
  completed: number;
  totalTargeted: number;
  totalSaved: number;
  goals: GoalItem[];
}

const GOAL_ICONS = ['🎯', '💻', '✈️', '🏠', '🚗', '📚', '💍', '🏋️', '🌍', '💰', '🎓', '🏖️'];

const GOAL_COLORS = [
  { id: 'cobalt', label: 'Cobalt', bg: 'bg-cobalt-50', text: 'text-cobalt-700', bar: 'bg-cobalt-600', border: 'border-cobalt-200' },
  { id: 'teal', label: 'Teal', bg: 'bg-teal-50', text: 'text-teal-700', bar: 'bg-teal-600', border: 'border-teal-200' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', border: 'border-amber-200' },
  { id: 'vermilion', label: 'Vermilion', bg: 'bg-vermilion-50', text: 'text-vermilion-700', bar: 'bg-vermilion-500', border: 'border-vermilion-200' },
  { id: 'slate', label: 'Slate', bg: 'bg-slate-50', text: 'text-slate-700', bar: 'bg-slate-600', border: 'border-slate-200' },
];

const fmt = (n: number) => '₹' + (n >= 100000 ? (n / 100000).toFixed(1) + 'L' : n.toLocaleString('en-IN'));

const colorTheme = (colorId?: string) =>
  GOAL_COLORS.find((c) => c.id === colorId) || GOAL_COLORS[0];

interface GoalCardProps {
  goal: GoalItem;
  todayMs: number;
  onContribute: (id: string) => void;
  onDelete: (id: string) => void;
}

const GoalCard: React.FC<GoalCardProps> = ({
  goal, todayMs, onContribute, onDelete,
}) => {
  const theme = colorTheme(goal.color);
  const progress = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
  const isCompleted = goal.status === 'completed';
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const deadline = goal.deadline ? new Date(goal.deadline) : null;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - todayMs) / (1000 * 60 * 60 * 24)) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card border ${theme.border} bg-white p-5 rounded-3xl space-y-4 relative overflow-hidden group shadow-xs`}
    >
      {isCompleted && (
        <div className="absolute top-3 right-3">
          <span className="flex items-center gap-1 text-[10px] font-black text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
            <CheckCircle2 size={11} /> Completed
          </span>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-2xl ${theme.bg} border ${theme.border} flex items-center justify-center text-xl flex-shrink-0`}>
          {goal.icon || '🎯'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-extrabold text-sm text-ink-900 truncate">{goal.title}</h3>
          {goal.description && <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">{goal.description}</p>}
          {daysLeft !== null && (
            <div className="flex items-center gap-1 mt-1">
              <Calendar size={10} className="text-slate-400" />
              <span className={`text-[10px] font-bold font-mono ${daysLeft < 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                {daysLeft > 0 ? `${daysLeft} days remaining` : 'Target date passed'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar & Amount */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className={`${theme.text} font-mono tabular-nums`}>{fmt(goal.current_amount)} saved</span>
          <span className="text-slate-500 font-mono tabular-nums">of {fmt(goal.target_amount)}</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full ${theme.bar} rounded-full`}
          />
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-black text-ink-900 font-mono tabular-nums">{progress}% achieved</span>
          {!isCompleted && <span className="font-semibold text-slate-400 font-mono tabular-nums">{fmt(remaining)} to target</span>}
        </div>
      </div>

      {/* Actions */}
      {!isCompleted && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onContribute(goal.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-extrabold ${theme.bg} ${theme.text} border ${theme.border} hover:shadow-xs transition-all cursor-pointer`}
          >
            <PlusCircle size={13} /> Add Capital
          </button>
          <button
            type="button"
            onClick={() => onDelete(goal.id)}
            className="p-2 rounded-xl text-slate-300 hover:text-vermilion-600 hover:bg-vermilion-50 border border-transparent transition-all cursor-pointer"
            title="Delete Goal"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </motion.div>
  );
};

const CreateGoalModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    icon: '🎯',
    color: 'cobalt',
    target_amount: '',
    deadline: '',
  });

  const mutation = useMutation({
    mutationFn: () => goalsService.create({ ...form, target_amount: Number(form.target_amount) }),
    onSuccess: () => { onCreated(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-slate-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-cobalt-600" />
            <h2 className="font-extrabold text-ink-900 text-base">New Financial Milestone</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><X size={16} /></button>
        </div>

        {/* Icon Picker */}
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-2">Category Icon</label>
          <div className="flex flex-wrap gap-2">
            {GOAL_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setForm({ ...form, icon: ic })}
                className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer ${
                  form.icon === ic ? 'border-cobalt-400 bg-cobalt-50 shadow-xs' : 'border-slate-200 hover:border-slate-300'
                }`}
              >{ic}</button>
            ))}
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-2">Visual Theme</label>
          <div className="flex gap-2">
            {GOAL_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setForm({ ...form, color: c.id })}
                className={`w-7 h-7 rounded-full ${c.bar} border-2 transition-all cursor-pointer ${
                  form.color === c.id ? 'border-slate-900 scale-110' : 'border-transparent'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Target Title *</label>
            <input
              type="text"
              placeholder="e.g. Q4 Machinery Upgrade, Tax Reserve..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field w-full text-xs font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Operational Purpose (Optional)</label>
            <input
              type="text"
              placeholder="Brief note or commercial objective"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field w-full text-xs font-semibold"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Target Amount (₹) *</label>
              <input
                type="number"
                placeholder="₹0"
                value={form.target_amount}
                onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                className="input-field w-full text-xs font-semibold font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Target Date</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="input-field w-full text-xs font-semibold font-mono"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!form.title || !form.target_amount || mutation.isPending}
          className="w-full btn-primary py-2.5 text-xs font-extrabold rounded-xl disabled:opacity-50 cursor-pointer"
        >
          {mutation.isPending ? 'Committing...' : 'Establish Target'}
        </button>
      </motion.div>
    </div>
  );
};

const ContributeModal: React.FC<{ goalId: string; goalTitle: string; onClose: () => void; onDone: () => void }> = ({
  goalId, goalTitle, onClose, onDone,
}) => {
  const [amount, setAmount] = useState('');
  const mutation = useMutation({
    mutationFn: () => goalsService.contribute(goalId, Number(amount)),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5 border border-slate-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="font-extrabold text-ink-900 text-base">Add Capital Contribution</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><X size={16} /></button>
        </div>
        <p className="text-xs text-slate-600">Contributing towards: <strong className="text-ink-900">{goalTitle}</strong></p>
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">Amount to Add (₹)</label>
          <input
            type="number"
            placeholder="e.g. 25000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field w-full text-base font-bold font-mono"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          {[5000, 10000, 25000, 50000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className="flex-1 py-1.5 text-xs font-extrabold rounded-xl bg-slate-100 text-slate-700 hover:bg-cobalt-50 hover:text-cobalt-700 border border-slate-200 transition-all cursor-pointer font-mono"
            >
              ₹{(preset / 1000).toFixed(0)}k
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!amount || Number(amount) <= 0 || mutation.isPending}
          className="w-full btn-primary py-2.5 text-xs font-extrabold rounded-xl disabled:opacity-50 cursor-pointer"
        >
          {mutation.isPending ? 'Processing...' : 'Confirm Allocation'}
        </button>
      </motion.div>
    </div>
  );
};

export const GoalsPage: React.FC = () => {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<{ id: string; title: string } | null>(null);

  // Compute reference timestamp once per session/mount to satisfy react-compiler purity rules
  const todayMs = useMemo(() => new Date().setHours(0, 0, 0, 0), []);

  const { data: summary, isLoading } = useQuery<GoalSummary>({
    queryKey: ['goals-summary'],
    queryFn: goalsService.getSummary,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals-summary'] }),
  });

  const onCreated = () => qc.invalidateQueries({ queryKey: ['goals-summary'] });
  const onContributed = () => qc.invalidateQueries({ queryKey: ['goals-summary'] });

  const goals: GoalItem[] = summary?.goals || [];
  const activeGoals = goals.filter((g) => g.status === 'active');
  const completedGoals = goals.filter((g) => g.status === 'completed');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Topbar
        title="Financial Milestones & Capital Targets"
        subtitle="Track targeted reserves, capital investments & operational milestones"
      />

      {/* Summary Row */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5 border border-slate-200 rounded-3xl bg-white shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Active Targets</span>
            <span className="text-2xl font-black text-ink-900 font-mono tabular-nums block">{summary.active}</span>
            <span className="text-xs text-slate-400 font-medium">In active progress</span>
          </div>

          <div className="card p-5 border border-teal-100 bg-teal-50/30 rounded-3xl shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 block">Completed Goals</span>
            <span className="text-2xl font-black text-teal-700 font-mono tabular-nums block">{summary.completed}</span>
            <span className="text-xs text-teal-600 font-medium">100% funded</span>
          </div>

          <div className="card p-5 border border-slate-200 rounded-3xl bg-white shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Targeted</span>
            <span className="text-2xl font-black text-ink-900 font-mono tabular-nums block">{fmt(summary.totalTargeted)}</span>
            <span className="text-xs text-slate-400 font-medium">Cumulative goal value</span>
          </div>

          <div className="card p-5 border border-cobalt-100 bg-cobalt-50/30 rounded-3xl shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-cobalt-600 block">Total Saved</span>
            <span className="text-2xl font-black text-cobalt-700 font-mono tabular-nums block">{fmt(summary.totalSaved)}</span>
            <span className="text-xs text-cobalt-600 font-medium">Allocated capital</span>
          </div>
        </div>
      )}

      {/* Create Button Strip */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-ink-900">Active Capital Targets</h2>
          <p className="text-xs text-slate-500 font-medium">Progress against scheduled delivery dates</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer"
        >
          <Plus size={15} /> New Target
        </button>
      </div>

      {/* Active Goals Grid */}
      {!isLoading && activeGoals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                todayMs={todayMs}
                onContribute={(id) => setContributeGoal({ id, title: goal.title })}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h3 className="font-extrabold text-sm text-ink-900 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal-600" /> Fully Funded Milestones
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {completedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                todayMs={todayMs}
                onContribute={() => {}}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && goals.length === 0 && (
        <div className="card p-12 border border-slate-200 rounded-3xl bg-white text-center space-y-3">
          <Target size={36} className="text-slate-300 mx-auto" />
          <h3 className="text-sm font-extrabold text-ink-900">No Financial Targets Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Establish a savings milestone or reserve fund to keep your commercial operations financially disciplined.
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-primary inline-flex items-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer mt-2"
          >
            <Plus size={14} /> Establish First Target
          </button>
        </div>
      )}

      {showCreate && <CreateGoalModal onClose={() => setShowCreate(false)} onCreated={onCreated} />}
      {contributeGoal && (
        <ContributeModal
          goalId={contributeGoal.id}
          goalTitle={contributeGoal.title}
          onClose={() => setContributeGoal(null)}
          onDone={onContributed}
        />
      )}
    </div>
  );
};
