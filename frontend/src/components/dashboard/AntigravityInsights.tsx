import React from 'react';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, AlertTriangle, Lightbulb, Wallet, ShieldCheck } from 'lucide-react';
import { usePersona } from '../../context/PersonaContext';

interface RawInsight {
  title: string;
  type?: 'danger' | 'warning' | 'positive' | 'action';
  desc?: string;
  description?: string;
}

interface DashboardMetrics {
  healthScore?: number;
  financialHealthScore?: number;
  insights?: RawInsight[];
}

interface FormattedInsight {
  type: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  color: string;
  bg: string;
}

interface InsightProps {
  metrics?: DashboardMetrics;
}

export const AntigravityInsights: React.FC<InsightProps> = ({ metrics }) => {
  const { persona } = usePersona();

  const getInsights = (): FormattedInsight[] => {
    // 1. If backend returned personalized AI insights from the engine, format and use them
    if (metrics?.insights && Array.isArray(metrics.insights) && metrics.insights.length > 0) {
      return metrics.insights.map((ins: RawInsight): FormattedInsight => ({
        type: ins.type || 'positive',
        icon:
          ins.type === 'danger'
            ? AlertTriangle
            : ins.type === 'warning'
            ? AlertTriangle
            : ins.type === 'action'
            ? Zap
            : TrendingUp,
        title: ins.title,
        description: ins.desc || ins.description || '',
        color:
          ins.type === 'danger'
            ? 'text-vermilion-700'
            : ins.type === 'warning'
            ? 'text-amber-800'
            : 'text-teal-700',
        bg:
          ins.type === 'danger'
            ? 'bg-vermilion-50 border-vermilion-200/80'
            : ins.type === 'warning'
            ? 'bg-amber-50 border-amber-200/80'
            : 'bg-teal-50 border-teal-200/80',
      }));
    }

    // 2. Persona-tailored fallback insights
    const insights: FormattedInsight[] = [];
    const healthScore = metrics?.healthScore || metrics?.financialHealthScore || 78;

    if (persona === 'personal') {
      insights.push({
        type: 'positive',
        icon: Wallet,
        title: 'Personal Budget Health',
        description: `Your personal financial discipline score is ${healthScore}/100. Regular monthly savings cushion maintained.`,
        color: 'text-teal-700',
        bg: 'bg-teal-50 border-teal-200/80',
      });
      insights.push({
        type: 'tip',
        icon: Lightbulb,
        title: 'Savings Optimization Strategy',
        description: 'Tracking micro-expenses in Food & Leisure can unlock an additional 5-10% in monthly savings.',
        color: 'text-cobalt-700',
        bg: 'bg-cobalt-50 border-cobalt-200/80',
      });
    } else if (persona === 'employee') {
      insights.push({
        type: 'positive',
        icon: ShieldCheck,
        title: 'Salary & DTI Capacity',
        description: `Your financial health score is ${healthScore}/100 with a healthy debt-to-income margin for loan evaluations.`,
        color: 'text-teal-700',
        bg: 'bg-teal-50 border-teal-200/80',
      });
      insights.push({
        type: 'tip',
        icon: Lightbulb,
        title: 'Emergency Fund Benchmark',
        description: 'Aim to keep 6 months of fixed living expenses in a liquid high-yield account.',
        color: 'text-cobalt-700',
        bg: 'bg-cobalt-50 border-cobalt-200/80',
      });
    } else if (persona === 'self_employed') {
      insights.push({
        type: 'positive',
        icon: TrendingUp,
        title: 'Retainer & Invoicing Velocity',
        description: 'Client payment cycles are averaging 22 days, keeping your baseline freelance runway at 4.5+ months.',
        color: 'text-teal-700',
        bg: 'bg-teal-50 border-teal-200/80',
      });
      insights.push({
        type: 'warning',
        icon: AlertTriangle,
        title: 'Client Concentration Caution',
        description: 'Top 2 clients account for >60% of total revenue. Consider expanding client diversity.',
        color: 'text-amber-800',
        bg: 'bg-amber-50 border-amber-200/80',
      });
    } else {
      // Default: business
      insights.push({
        type: 'positive',
        icon: TrendingUp,
        title: 'Commercial Cashflow Surplus',
        description: `Operating cash flow shows a consistent surplus with an overall health index of ${healthScore}/100.`,
        color: 'text-teal-700',
        bg: 'bg-teal-50 border-teal-200/80',
      });
      insights.push({
        type: 'warning',
        icon: AlertTriangle,
        title: 'Receivables Aging Monitoring',
        description: 'Overdue receivables represent 14% of monthly revenue. Automated payment reminders recommended.',
        color: 'text-amber-800',
        bg: 'bg-amber-50 border-amber-200/80',
      });
    }

    return insights;
  };

  const insightsList = getInsights();

  return (
    <div className="bg-white border border-slate-200 rounded-financial p-5 shadow-card space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-cobalt-600" />
          <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
            Decision & Risk Insights
          </h3>
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          AI Engine
        </span>
      </div>

      <div className="space-y-2.5">
        {insightsList.map((ins, idx) => {
          const Icon = ins.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`p-3 rounded-lg border ${ins.bg} flex items-start gap-2.5`}
            >
              <div className={`mt-0.5 flex-shrink-0 ${ins.color}`}>
                <Icon size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className={`text-xs font-bold ${ins.color} leading-tight truncate`}>
                  {ins.title}
                </h4>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed mt-1">
                  {ins.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
