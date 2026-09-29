import {
  BarChart3,
  BrainCircuit,
  Briefcase,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  FileSearch,
  FileText,
  GitCompareArrows,
  History,
  KeyRound,
  Laptop,
  LineChart,
  Lock,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  UploadCloud,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/*
 * Landing-page copy and illustrative data, kept out of the JSX so sections stay
 * readable. Every capability listed here maps to something that exists in the app;
 * every number is labelled on the page as sample data.
 */

export interface NavItem {
  label: string;
  href: `#${string}`;
  sectionId: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '#top', sectionId: 'top' },
  { label: 'Features', href: '#features', sectionId: 'features' },
  { label: 'Solutions', href: '#solutions', sectionId: 'solutions' },
  { label: 'Pricing', href: '#pricing', sectionId: 'pricing' },
  { label: 'About', href: '#about', sectionId: 'about' },
];

export interface IconItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

/** Compact value strip under the hero copy. */
export const VALUE_ITEMS: IconItem[] = [
  { icon: BarChart3, title: 'Smart Analytics', description: 'Real-time financial insights' },
  { icon: BrainCircuit, title: 'AI Decision Engine', description: 'Evidence-backed decisions' },
  { icon: TrendingUp, title: 'Growth Tracking', description: 'Forecasts, trends & planning' },
  { icon: ShieldCheck, title: 'Secure Access', description: 'Authenticated and audited' },
];

export const AUDIENCES: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Building2, label: 'Businesses & SMEs' },
  { icon: Users, label: 'Finance & sales teams' },
  { icon: Laptop, label: 'Freelancers' },
  { icon: Briefcase, label: 'Salaried professionals' },
];

export const STEPS: Array<IconItem & { number: string }> = [
  {
    number: '01',
    icon: UploadCloud,
    title: 'Connect your data',
    description: 'Import CSV exports, bank statements and invoices, or start from a guided workspace.',
  },
  {
    number: '02',
    icon: Sparkles,
    title: 'Get AI-powered insights',
    description: 'Analytics, contract reviews and ranked recommendations, each with its evidence.',
  },
  {
    number: '03',
    icon: CheckCircle2,
    title: 'Take action confidently',
    description: 'Simulate the outcome, approve the action, and keep a complete audit trail.',
  },
];

export const DECISION_FLOW: IconItem[] = [
  { icon: Database, title: 'Business data', description: 'CRM records, invoices and rep notes' },
  { icon: BrainCircuit, title: 'AI analysis', description: 'Weighted, deterministic scoring' },
  { icon: FileSearch, title: 'Evidence', description: 'Records, notes and external signals' },
  { icon: Target, title: 'Recommendation', description: 'A ranked, explained next action' },
  { icon: UserCheck, title: 'Human approval', description: 'Approve, modify or reject' },
];

export const DECISIONFORGE_POINTS = [
  'Every score breaks down into the factors behind it',
  'Evidence links back to the records, notes and signals used',
  'Nothing happens until a person approves it',
];

/**
 * Sample recommendation shown in the DecisionForge preview. The factor contributions
 * follow the default policy weights (25/20/20/15/20) and sum to the displayed score.
 */
export const SAMPLE_RECOMMENDATION = {
  company: 'Vanguard Robotics & Automation',
  stage: 'Final contract review',
  score: 86.7,
  factors: [
    { name: 'Deal size', value: 25.0 },
    { name: 'Engagement', value: 19.2 },
    { name: 'Win likelihood', value: 18.2 },
    { name: 'Recency', value: 14.3 },
    { name: 'External signal', value: 10.0 },
  ],
};

/**
 * Decision Twin sample. The DecisionForge module reports pipeline values in USD in the
 * product, so the landing page matches it. Change this one constant to switch symbols.
 */
export const DECISION_CURRENCY = '$';
export const TWIN_BASELINE = 2.17;
export const TWIN_SCENARIO_LIFT = 6.8;
export const TWIN_SCENARIO = Math.round(TWIN_BASELINE * (1 + TWIN_SCENARIO_LIFT / 100) * 100) / 100;

/**
 * Lever positions for the Decision Twin visual. Baseline matches the simulator's
 * status-quo assumptions; the scenario matches the Decision Twin tab's defaults.
 * `fill` is the position on each slider's real range in the product.
 */
export const TWIN_LEVERS = [
  { label: 'Contacts per day', baseline: { value: '15', fill: 0.3 }, scenario: { value: '20', fill: 0.4 } },
  { label: 'Follow-up window', baseline: { value: '7 days', fill: 0.46 }, scenario: { value: '3 days', fill: 0.15 } },
  { label: 'Minimum deal value', baseline: { value: `${DECISION_CURRENCY}0`, fill: 0 }, scenario: { value: `${DECISION_CURRENCY}50k`, fill: 0.2 } },
];

export const TWIN_STAGES = ['Analyze', 'Simulate', 'Compare', 'Approve'];

export const FEATURES: IconItem[] = [
  { icon: BarChart3, title: 'Smart Analytics', description: 'Cash flow, trends and business performance in one view.' },
  { icon: Receipt, title: 'Invoicing & GST', description: 'Create GST-ready invoices and track what has been paid.' },
  { icon: CreditCard, title: 'Corporate Expenses', description: 'Categorise spending, import statements and watch operating burn.' },
  { icon: FileText, title: 'Contract Intelligence', description: 'Pull key terms and risk flags out of agreements, in English and 7 Indian languages.' },
  { icon: LineChart, title: 'Growth Tracking', description: 'Follow trends, set goals and see month-end forecasts.' },
  { icon: BrainCircuit, title: 'AI Decision Engine', description: 'Turn business data into ranked, explainable recommendations.' },
];

export interface Persona {
  id: string;
  icon: LucideIcon;
  title: string;
  audience: string;
  description: string;
  headlineMetric: string;
}

/** Mirrors the three workspaces offered on the onboarding screen and their persona config. */
export const PERSONAS: Persona[] = [
  {
    id: 'solutions-business',
    icon: Building2,
    title: 'Business Owner / SME',
    audience: 'Founders, companies and SMEs',
    description: 'GST invoicing, commercial cash flow, corporate expenses and DecisionForge deal prioritization.',
    headlineMetric: 'Net Operating Profit',
  },
  {
    id: 'solutions-freelancer',
    icon: Laptop,
    title: 'Freelancer / Self-Employed',
    audience: 'Independent contractors and agencies',
    description: 'Milestone invoicing, retainer tracking, freelance expenses and runway analytics.',
    headlineMetric: 'Freelance Net Margin',
  },
  {
    id: 'solutions-personal',
    icon: Wallet,
    title: 'Personal & Salaried',
    audience: 'Working professionals and employees',
    description: 'Salary budgets, daily expense logging, savings goals and net worth.',
    headlineMetric: 'Net Personal Savings',
  },
];

/** Only controls that exist in the current implementation. */
export const SECURITY_CONTROLS: IconItem[] = [
  { icon: KeyRound, title: 'Hashed credentials', description: 'Passwords are stored as bcrypt hashes, never in plain text.' },
  { icon: Lock, title: 'Authenticated access', description: 'Every data request requires a signed session token that expires.' },
  { icon: Users, title: 'Account-scoped records', description: 'Invoices, expenses, approvals and audit history belong to your account.' },
  { icon: History, title: 'Audit history', description: 'Recommendations, policy changes and approvals are all logged.' },
  { icon: UserCheck, title: 'Human approval', description: 'AI recommendations never act on their own.' },
];

export const PRICING_INCLUDES = [
  'Financial dashboard and analytics',
  'Invoicing with GST and printable bills',
  'Expense tracking and statement import',
  'Contract Intelligence',
  'DecisionForge AI and Decision Twin',
  'Goals and net-worth tracking',
];

export interface DemoStep {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  where: string;
}

/** The product story walked through in the "Watch Demo" modal. */
export const DEMO_STEPS: DemoStep[] = [
  { key: 'data', icon: UploadCloud, title: 'Data', description: 'Bring in invoices, expenses, statements or a CRM export. Columns are mapped automatically, and you confirm before anything is used.', where: 'Billing · Expenses · DecisionForge ingestion' },
  { key: 'understand', icon: BarChart3, title: 'Understand', description: 'See cash flow, operating burn and profit in one place, labelled for your kind of workspace.', where: 'Dashboard · Analytics' },
  { key: 'analyze', icon: FileSearch, title: 'Analyze', description: 'Review contracts clause by clause and check data health before it drives a decision.', where: 'Contract Intelligence · Data health' },
  { key: 'decide', icon: Target, title: 'Decide', description: 'DecisionForge ranks your opportunities and shows every factor and piece of evidence behind each score.', where: 'DecisionForge · Decision Center' },
  { key: 'simulate', icon: SlidersHorizontal, title: 'Simulate', description: 'Change capacity, deal thresholds or follow-up speed and compare the estimated outcome with today.', where: 'DecisionForge · Decision Twin' },
  { key: 'approve', icon: UserCheck, title: 'Approve', description: 'Approve, modify or reject each recommendation. Nothing is sent or changed without you.', where: 'DecisionForge · Review & approve' },
  { key: 'act', icon: GitCompareArrows, title: 'Act', description: 'Approved deals can be saved as Bizpulse clients, ready to invoice, and every step stays in the audit trail for replay.', where: 'Billing · Approvals & audit replay' },
];

/**
 * Illustrative monthly figures for the hero dashboard (₹ lakhs). KPI cards and deltas
 * are computed from this series, so the preview stays internally consistent.
 */
export const SAMPLE_CASHFLOW = [
  { month: 'Jan', income: 9.95, expense: 7.02 },
  { month: 'Feb', income: 10.4, expense: 7.35 },
  { month: 'Mar', income: 10.1, expense: 7.61 },
  { month: 'Apr', income: 11.3, expense: 7.7 },
  { month: 'May', income: 11.02, expense: 7.59 },
  { month: 'Jun', income: 12.4, expense: 8.21 },
];
