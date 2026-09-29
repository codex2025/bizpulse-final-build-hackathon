import React from 'react';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, AlertTriangle, Lightbulb, Wallet, ShieldCheck } from 'lucide-react';
import { usePersona } from '../../context/PersonaContext';

interface InsightProps {
  metrics: any;
}

export const AntigravityInsights: React.FC<InsightProps> = ({ metrics }) => {
  const { persona } = usePersona();

  const getInsights = () => {
    // 1. If backend returned personalized AI insights from the engine, format and use them
    if (metrics?.insights && Array.isArray(metrics.insights) && metrics.insights.length > 0) {
      return metrics.insights.map((ins: any) => ({
        type: ins.type || 'positive',
        icon: ins.type === 'danger' || ins.type === 'warning' ? AlertTriangle : ins.type === 'action' ? Zap : TrendingUp,
        title: ins.title,
        description: ins.desc || ins.description,
        color: ins.type === 'danger' ? 'text-red-600' : ins.type === 'warning' ? 'text-amber-600' : 'text-emerald-600',
        bg: ins.type === 'danger' ? 'bg-red-50 border-red-100' : ins.type === 'warning' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100',
      }));
    }

    // 2. Persona-tailored fallback insights
    const insights = [];
    const healthScore = metrics?.healthScore || metrics?.financialHealthScore || 78;

    if (persona === 'personal') {
      insights.push({
        type: 'positive',
        icon: Wallet,
        title: 'Personal Budget Health',
        description: `Your personal financial discipline score is ${healthScore}/100. Regular monthly savings cushion maintained.`,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 border-emerald-100',
      });
      insights.push({
        type: 'tip',
        icon: Lightbulb,
        title: 'Savings Optimization Tip',
        description: 'Tracking micro-expenses in Food & Leisure can unlock an additional 5-10% in monthly savings.',
        color: 'text-purple-600',
        bg: 'bg-purple-50 border-purple-100',
      });
    } else if (persona === 'employee') {
      insights.push({
        type: 'positive',
        icon: ShieldCheck,
        title: 'Salary & DTI Capacity',
        description: `Your financial health score is ${healthScore}/100 with a healthy debt-to-income margin for loan evaluations.`,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 border-emerald-100',
      });
      insights.push({
        type: 'tip',
        icon: Lightbulb,
        title: 'Emergency Fund Benchmark',
        description: 'Aim to keep 6 months of fixed living expenses in a liquid high-yield account.',
        color: 'text-blue-600',
        bg: 'bg-blue-50 border-blue-100',
      });
    } else if (persona === 'self_employed') {
      insights.push({
        type: 'positive',
        icon: TrendingUp,
        title: 'Freelance Runway Buffer',
        description: `Your stability rating is ${healthScore}/100. Maintain steady client retainer cycles to mitigate seasonal dips.`,
        color: 'text-purple-600',
        bg: 'bg-purple-50 border-purple-100',
      });
    } else {
      insights.push({
        type: 'positive',
        icon: TrendingUp,
        title: 'Corporate Cash Flow Health',
        description: `Business health score is ${healthScore}/100. Operating cash flow remains healthy.`,
        color: 'text-brand-600',
        bg: 'bg-brand-50 border-brand-100',
      });
    }

    return insights;
  };

  const insights = getInsights();

  return (
    <div className="card border-slate-200 relative overflow-hidden group bg-white">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100 opacity-50" />

      <div className="flex items-center gap-2 mb-6">
        <Zap className="text-brand-600" size={20} />
        <h3 className="font-semibold text-slate-900">Antigravity Intelligence</h3>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 ml-auto shadow-xs">
          AI Driven
        </span>
      </div>

      <div className="space-y-4">
        {insights.map((insight: any, idx: number) => {
          const Icon = insight.icon;
          return (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 + 0.3 }}
              key={idx}
              className={`p-4 rounded-xl flex gap-4 items-start ${insight.bg} border hover:shadow-xs transition-all`}
            >
              <div className={`mt-0.5 ${insight.color}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className={`text-sm font-bold mb-1 ${insight.color}`}>{insight.title}</p>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">{insight.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
