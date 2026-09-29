import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Plus, Trash2, TrendingUp, CheckCircle2,
  Calendar, Wallet, X, PlusCircle
} from 'lucide-react';
import { Topbar } from '../common/Topbar';
import { goalsService } from '../../services/analyticsService';

const GOAL_ICONS = ['🎯', '💻', '✈️', '🏠', '🚗', '📚', '💍', '🏋️', '🌍', '💰', '🎓', '🏖️'];
const GOAL_COLORS = [
  { id: 'brand', label: 'Rose', bg: 'bg-brand-50', text: 'text-brand-700', bar: 'bg-brand-500', border: 'border-brand-200' },
  { id: 'emerald', label: 'Green', bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500', border: 'border-emerald-200' },
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-50', text: 'text-indigo-700', bar: 'bg-indigo-500', border: 'border-indigo-200' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', border: 'border-amber-200' },
  { id: 'purple', label: 'Purple', bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-500', border: 'border-purple-200' },
];

const fmt = (n: number) => '₹' + (n >= 100000 ? (n / 100000).toFixed(1) + 'L' : n.toLocaleString('en-IN'));

const colorTheme = (colorId: string) =>
  GOAL_COLORS.find((c) => c.id === colorId) || GOAL_COLORS[0];

const GoalCard: React.FC<{ goal: any; onContribute: (id: string) => void; onDelete: (id: string) => void }> = ({
  goal, onContribute, onDelete,
}) => {
  const theme = colorTheme(goal.color);
  const progress = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
  const isCompleted = goal.status === 'completed';
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const deadline = goal.deadline ? new Date(goal.deadline) : null;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card border ${theme.border} bg-white p-5 space-y-4 relative overflow-hidden group`}
    >
      {isCompleted && (
        <div className="absolute top-3 right-3">
          <span className="flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 size={11} /> Completed
          </span>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-2xl ${theme.bg} border ${theme.border} flex items-center justify-center text-xl flex-shrink-0`}>
          {goal.icon || '🎯'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-extrabold text-sm text-slate-900 truncate">{goal.title}</h3>
          {goal.description && <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">{goal.description}</p>}
          {daysLeft !== null && (
            <div className="flex items-center gap-1 mt-1">
              <Calendar size={10} className="text-slate-400" />
              <span className={`text-[10px] font-bold ${daysLeft < 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                {daysLeft > 0 ? `${daysLeft} days left` : 'Past deadline'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className={theme.text}>{fmt(goal.current_amount)} saved</span>
          <span className="text-slate-500">of {fmt(goal.target_amount)}</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full ${theme.bar} rounded-full`}
          />
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-black text-slate-700">{progress}% complete</span>
          {!isCompleted && <span className="font-semibold text-slate-400">{fmt(remaining)} to go</span>}
        </div>
      </div>

      {/* Actions */}
      {!isCompleted && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onContribute(goal.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-extrabold ${theme.bg} ${theme.text} border ${theme.border} hover:shadow-sm transition-all cursor-pointer`}
          >
            <PlusCircle size={13} /> Add Funds
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all cursor-pointer"
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
    color: 'brand',
    target_amount: '',
    deadline: '',
  });

  const mutation = useMutation({
    mutationFn: () => goalsService.create({ ...form, target_amount: Number(form.target_amount) }),
    onSuccess: () => { onCreated(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-slate-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-brand-600" />
            <h2 className="font-extrabold text-slate-900">New Financial Goal</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><X size={16} /></button>
        </div>

        {/* Icon Picker */}
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-2">Choose Icon</label>
          <div className="flex flex-wrap gap-2">
            {GOAL_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setForm({ ...form, icon: ic })}
                className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer ${
                  form.icon === ic ? 'border-brand-400 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                }`}
              >{ic}</button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-2">Color Theme</label>
          <div className="flex gap-2">
            {GOAL_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => setForm({ ...form, color: c.id })}
                className={`w-7 h-7 rounded-full ${c.bar} border-2 transition-all cursor-pointer ${
                  form.color === c.id ? 'border-slate-900 scale-110' : 'border-transparent'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Goal Title *</label>
            <input
              type="text"
              placeholder="e.g. Emergency Fund, New Laptop..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field w-full text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Description (optional)</label>
            <input
              type="text"
              placeholder="Brief note about this goal"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field w-full text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Target Amount *</label>
              <input
                type="number"
                placeholder="₹0"
                value={form.target_amount}
                onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                className="input-field w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Target Date</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="input-field w-full text-sm"
              />
            </div>
          </div>
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={!form.title || !form.target_amount || mutation.isPending}
          className="w-full btn-primary py-3 text-sm font-extrabold rounded-2xl disabled:opacity-50 cursor-pointer"
        >
          {mutation.isPending ? 'Creating...' : 'Create Goal'}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5 border border-slate-200"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-slate-900">Add Funds</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><X size={16} /></button>
        </div>
        <p className="text-sm text-slate-600">Contributing towards: <span className="font-bold text-slate-900">{goalTitle}</span></p>
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">Amount to Add (₹)</label>
          <input
            type="number"
            placeholder="e.g. 5000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field w-full text-lg font-bold"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          {[1000, 5000, 10000, 25000].map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(String(preset))}
              className="flex-1 py-1.5 text-xs font-extrabold rounded-xl bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 hover:border-brand-200 transition-all cursor-pointer"
            >
              ₹{(preset / 1000).toFixed(0)}K
            </button>
          ))}
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={!amount || Number(amount) <= 0 || mutation.isPending}
          className="w-full btn-primary py-3 text-sm font-extrabold rounded-2xl disabled:opacity-50 cursor-pointer"
        >
          {mutation.isPending ? 'Saving...' : 'Confirm Contribution'}
        </button>
      </motion.div>
    </div>
  );
};

export const GoalsPage: React.FC = () => {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<{ id: string; title: string } | null>(null);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['goals-summary'],
    queryFn: goalsService.getSummary,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals-summary'] }),
  });

  const onCreated = () => qc.invalidateQueries({ queryKey: ['goals-summary'] });
  const onContributed = () => qc.invalidateQueries({ queryKey: ['goals-summary'] });

  const goals = summary?.goals || [];
  const activeGoals = goals.filter((g: any) => g.status === 'active');
  const completedGoals = goals.filter((g: any) => g.status === 'completed');

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      <Topbar
        title="Financial Goals"
        subtitle="Track savings targets and milestones that matter to you"
      />

      {/* Summary Row */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Goals', value: summary.active, icon: Target, color: 'bg-brand-50 text-brand-600' },
            { label: 'Completed', value: summary.completed, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Total Targeted', value: '₹' + (summary.totalTargeted >= 100000 ? (summary.totalTargeted / 100000).toFixed(1) + 'L' : summary.totalTargeted.toLocaleString('en-IN')), icon: Wallet, color: 'bg-indigo-50 text-indigo-600' },
            { label: 'Total Saved', value: '₹' + (summary.totalSaved >= 100000 ? (summary.totalSaved / 100000).toFixed(1) + 'L' : summary.totalSaved.toLocaleString('en-IN')), icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
          ].map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card border border-slate-200 bg-white p-4 flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.color}`}>
                <m.icon size={18} />
              </div>
              <div>
                <p className="text-xl font-black text-slate-900">{m.value}</p>
                <p className="text-xs font-semibold text-slate-500">{m.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Header + Add */}
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold text-slate-900">
          {activeGoals.length > 0 ? `${activeGoals.length} Active Goal${activeGoals.length !== 1 ? 's' : ''}` : 'No Active Goals'}
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 text-sm font-extrabold px-4 py-2.5 rounded-2xl cursor-pointer"
        >
          <Plus size={16} /> New Goal
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card border border-slate-100 bg-white p-5 h-52 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-6" />
              <div className="h-2 bg-slate-100 rounded mb-4" />
              <div className="h-8 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && activeGoals.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-20 flex flex-col items-center justify-center text-center space-y-4"
        >
          <div className="w-20 h-20 rounded-3xl bg-brand-50 border border-brand-100 flex items-center justify-center">
            <Target size={36} className="text-brand-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-lg">No Goals Yet</h3>
            <p className="text-sm text-slate-500 font-medium mt-1 max-w-sm">
              Set a savings target for something that matters — emergency fund, laptop, vacation, or anything else.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 text-sm font-extrabold px-5 py-3 rounded-2xl cursor-pointer"
          >
            <Plus size={16} /> Create Your First Goal
          </button>
        </motion.div>
      )}

      {/* Active Goals Grid */}
      {!isLoading && activeGoals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {activeGoals.map((goal: any) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onContribute={(id) => setContributeGoal({ id, title: goal.title })}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h3 className="font-extrabold text-slate-700 mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" /> Completed Goals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {completedGoals.map((goal: any) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onContribute={() => {}}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
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
