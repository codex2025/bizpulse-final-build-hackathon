export interface TourStep {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor?: string;
  description: string;
  route: string;
  targetSelector?: string;
  placement: 'bottom' | 'top' | 'left' | 'right' | 'center';
  workflowPills?: string[];
  keyTakeaway?: string;
  primaryActionLabel?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    stepNumber: 1,
    title: 'Welcome to Bizpulse',
    subtitle: 'Intelligent Financial Engine',
    badge: 'Overview',
    badgeColor: 'bg-violet-50 text-violet-700 border border-violet-200',
    description:
      'Bizpulse unifies your company’s financial telemetry, audit covenants, and automated risk models into one clear operational platform.',
    route: '/',
    placement: 'center',
    workflowPills: ['1. Telemetry', '2. Contracts', '3. Decision Engine'],
    keyTakeaway: 'Live financials + transparent models = confident business choices.',
    primaryActionLabel: 'Explore Dashboard',
  },
  {
    id: 'dashboard',
    stepNumber: 2,
    title: 'Financial Command Center',
    subtitle: 'Immediate Solvency & Trends',
    badge: 'Dashboard',
    badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    description:
      'The top cards show verified inflows, operating burn, retained spread, and aging receivables. Check here first every day for a quick health check.',
    route: '/',
    targetSelector: '[data-tour="dashboard-overview"]',
    placement: 'bottom',
    workflowPills: ['Inflows', 'Burn Rate', 'Net Spread', 'Receivables'],
    keyTakeaway: 'Immediate answer to: "Are we profitable and liquid right now?"',
    primaryActionLabel: 'Next: Contracts',
  },
  {
    id: 'contracts',
    stepNumber: 3,
    title: 'Contract Intelligence',
    subtitle: 'Clause & Covenant Audit',
    badge: 'Legal & Risk',
    badgeColor: 'bg-rose-50 text-rose-700 border border-rose-200',
    description:
      'Upload loan agreements, commercial leases, or vendor terms. Bizpulse extracts covenants, flags penal rate hikes, and checks affordability against your ledger.',
    route: '/contracts',
    targetSelector: '[data-tour="contracts-workflow"]',
    placement: 'bottom',
    workflowPills: ['Upload', 'Extract', 'Audit Clauses', 'Flag Risks'],
    keyTakeaway: 'Never sign a credit facility without automated covenant verification.',
    primaryActionLabel: 'Next: DecisionForge',
  },
  {
    id: 'decision-forge',
    stepNumber: 4,
    title: 'DecisionForge AI',
    subtitle: 'Evidence-Backed Reasoning',
    badge: 'AI Policy',
    badgeColor: 'bg-violet-50 text-violet-700 border border-violet-200',
    description:
      'Evaluate high-stakes commercial decisions. Progresses cleanly through Decision → Inputs → Calculations → Risks → Evidence → Outcome.',
    route: '/decision-forge',
    targetSelector: '[data-tour="decision-progression"]',
    placement: 'bottom',
    workflowPills: ['Inputs', 'Formulas', 'Risks', 'Evidence', 'Verdict'],
    keyTakeaway: 'Every AI output is inspectable with clear mathematical formulas.',
    primaryActionLabel: 'Next: Analytics',
  },
  {
    id: 'analytics',
    stepNumber: 5,
    title: 'Financial Analytics',
    subtitle: 'Velocity & Pattern Lenses',
    badge: 'Analytics',
    badgeColor: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    description:
      'Inspect cash velocity, category burn, and loan amortization. Toggle timeframes from 1 month to 2 years to separate temporary dips from structural variance.',
    route: '/analytics',
    targetSelector: '[data-tour="analytics-lenses"]',
    placement: 'bottom',
    workflowPills: ['Cash Velocity', 'Category Burn', 'Obligations', 'Pipeline'],
    keyTakeaway: 'Filter multi-month timelines to spot margin compression early.',
    primaryActionLabel: 'Next: Core Tools',
  },
  {
    id: 'financial-tools',
    stepNumber: 6,
    title: 'Connected Operations',
    subtitle: 'Everyday Feeds',
    badge: 'Operations',
    badgeColor: 'bg-amber-50 text-amber-800 border border-amber-200',
    description:
      'Client Invoicing, Daily Expenses, Goals, and Net Worth are interconnected. Every recorded entry updates your runway and DecisionForge risk scores in real time.',
    route: '/',
    targetSelector: '[data-tour="sidebar-operations"]',
    placement: 'right',
    workflowPills: ['Invoicing & GST', 'Expenses', 'Goals', 'Balance Sheet'],
    keyTakeaway: 'Every recorded transaction continuously trains your business health.',
    primaryActionLabel: 'Next: Insights',
  },
  {
    id: 'insights',
    stepNumber: 7,
    title: 'Evidence & Actions',
    subtitle: 'Reasoning Transparency',
    badge: 'Reasoning',
    badgeColor: 'bg-teal-50 text-teal-700 border border-teal-200',
    description:
      'Bizpulse never gives blind recommendations. Inspect the evidence drawer to review source invoices, legal clauses, and calculations behind every alert.',
    route: '/',
    targetSelector: '[data-tour="dashboard-insights"]',
    placement: 'top',
    workflowPills: ['DATA', '→ EVIDENCE', '→ INSIGHT', '→ ACTION'],
    keyTakeaway: 'Act with confidence supported by concrete audit records.',
    primaryActionLabel: 'Next: Wrap Up',
  },
  {
    id: 'ready',
    stepNumber: 8,
    title: "You're Ready to Build",
    subtitle: 'Tour Complete',
    badge: 'Ready',
    badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    description:
      'You have the full picture: Understand → Explore → Spot Risks → Inspect Evidence → Make Informed Decisions. You can restart this tour anytime from Help (?).',
    route: '/',
    placement: 'center',
    workflowPills: ['Understand', 'Explore', 'Audit', 'Decide'],
    keyTakeaway: 'Start by reviewing your Dashboard metrics or running DecisionForge.',
    primaryActionLabel: 'Explore Dashboard',
  },
];
