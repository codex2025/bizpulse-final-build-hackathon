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
    subtitle: 'A decision engine for business data',
    badge: 'Overview',
    badgeColor: 'bg-violet-50 text-violet-700 border border-violet-200',
    description:
      'Bizpulse turns a list of sales opportunities into ranked, explained decisions. It also keeps your invoices, expenses and contracts in one place. This short tour shows where everything is.',
    route: '/',
    placement: 'center',
    workflowPills: ['1. Add data', '2. Get decisions', '3. Approve'],
    keyTakeaway: 'Your workspace starts empty. Nothing is shown that you did not add.',
    primaryActionLabel: 'Start the tour',
  },
  {
    id: 'decision-forge',
    stepNumber: 2,
    title: 'DecisionForge: start here',
    subtitle: 'Which deals should we work on first?',
    badge: 'Main feature',
    badgeColor: 'bg-violet-50 text-violet-700 border border-violet-200',
    description:
      'Upload a CSV of sales opportunities (a sample file is one click away). The engine checks the data, scores each deal with a visible formula, shows the notes behind each recommendation and waits for your approval.',
    route: '/decision-forge',
    targetSelector: '[data-tour="decision-progression"]',
    placement: 'bottom',
    workflowPills: ['Upload', 'Check data', 'Rank', 'What-if', 'Approve'],
    keyTakeaway: 'Every score can be opened to see its formula and evidence.',
    primaryActionLabel: 'Next: Dashboard',
  },
  {
    id: 'dashboard',
    stepNumber: 3,
    title: 'Dashboard',
    subtitle: 'Money in, money out',
    badge: 'Dashboard',
    badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    description:
      'The top cards show this month’s income, expenses, profit and unpaid invoices. They read ₹0 until you add invoices and expenses.',
    route: '/',
    targetSelector: '[data-tour="dashboard-overview"]',
    placement: 'bottom',
    workflowPills: ['Income', 'Expenses', 'Profit', 'Unpaid'],
    keyTakeaway: 'A quick answer to: are we making money right now?',
    primaryActionLabel: 'Next: Contracts',
  },
  {
    id: 'contracts',
    stepNumber: 4,
    title: 'Contracts',
    subtitle: 'Find risky clauses before you sign',
    badge: 'Contracts',
    badgeColor: 'bg-rose-50 text-rose-700 border border-rose-200',
    description:
      'Upload a loan agreement or a vendor contract. Bizpulse lists the clauses, marks the risky ones and, for loans, shows what the repayments cost.',
    route: '/contracts',
    targetSelector: '[data-tour="contracts-workflow"]',
    placement: 'bottom',
    workflowPills: ['Upload', 'Read clauses', 'Flag risks'],
    keyTakeaway: 'Use "Try Sample" on that page if you have no contract to hand.',
    primaryActionLabel: 'Next: Analytics',
  },
  {
    id: 'analytics',
    stepNumber: 5,
    title: 'Analytics',
    subtitle: 'Trends over time',
    badge: 'Analytics',
    badgeColor: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    description:
      'Charts of cash flow, spending by category and loan repayments. Change the time range from 1 month to 2 years.',
    route: '/analytics',
    targetSelector: '[data-tour="analytics-lenses"]',
    placement: 'bottom',
    workflowPills: ['Cash flow', 'Spending', 'Loans', 'Pipeline'],
    keyTakeaway: 'Charts stay empty until there is data to draw.',
    primaryActionLabel: 'Next: Everyday tools',
  },
  {
    id: 'financial-tools',
    stepNumber: 6,
    title: 'Everyday tools',
    subtitle: 'Invoices, expenses, goals, net worth',
    badge: 'Menu',
    badgeColor: 'bg-amber-50 text-amber-800 border border-amber-200',
    description:
      'Use the menu to create invoices, record expenses, set goals and track what you own and owe. What you enter here feeds the dashboard and analytics.',
    route: '/',
    targetSelector: '[data-tour="sidebar-operations"]',
    placement: 'right',
    workflowPills: ['Invoices', 'Expenses', 'Goals', 'Net worth'],
    keyTakeaway: 'Each page has a labelled sample you can load with one click.',
    primaryActionLabel: 'Next: Evidence',
  },
  {
    id: 'insights',
    stepNumber: 7,
    title: 'Evidence behind every alert',
    subtitle: 'No unexplained advice',
    badge: 'Evidence',
    badgeColor: 'bg-teal-50 text-teal-700 border border-teal-200',
    description:
      'Alerts and recommendations link back to the invoice, clause or sales note they came from, so you can check them yourself.',
    route: '/',
    targetSelector: '[data-tour="dashboard-insights"]',
    placement: 'top',
    workflowPills: ['Data', 'Evidence', 'Recommendation', 'Your decision'],
    keyTakeaway: 'A person always approves, changes or rejects a recommendation.',
    primaryActionLabel: 'Next: Finish',
  },
  {
    id: 'ready',
    stepNumber: 8,
    title: 'Now add your data',
    subtitle: 'Tour complete',
    badge: 'Ready',
    badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    description:
      'You are on the DecisionForge start screen. Download the sample CSV and upload it, or use your own export, to see ranked decisions. You can restart this tour anytime from Help (?).',
    route: '/decision-forge',
    placement: 'center',
    workflowPills: ['Download sample', 'Upload', 'Decide'],
    keyTakeaway: 'About two minutes from an empty workspace to an approved decision.',
    primaryActionLabel: 'Add my data',
  },
];
