// Sample workspace presets for Goals and Net Worth.
//
// These are NOT shown as if they were the user's own numbers. An empty workspace offers them as a
// clearly labelled sample that the user can load with one click (they then become ordinary,
// editable, deletable records in the user's own workspace).

export interface SampleGoal {
  title: string;
  description: string;
  icon: string;
  color: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  milestones: { name: string; completed: boolean }[];
}

export const SAMPLE_GOALS: SampleGoal[] = [
  {
    title: 'FY26 ARR Milestone Target',
    description: 'Revenue milestone: Q1 ₹25L, Q2 ₹55L, Q3 ₹85L, Q4 ₹1.2Cr.',
    icon: '🎯',
    color: 'cobalt',
    target_amount: 12000000,
    current_amount: 8640000,
    deadline: '2026-12-31',
    milestones: [
      { name: 'Q1 Target Achieved (₹25L)', completed: true },
      { name: 'Q2 Mid-Year Review (₹55L)', completed: true },
      { name: 'Q3 Scale Expansion (₹85L)', completed: true },
      { name: 'Q4 Final Push (₹1.2Cr)', completed: false },
    ],
  },
  {
    title: 'SOC-2 Type II & ISO 27001 Certification',
    description: 'Compliance programme progress (percent complete).',
    icon: '🛡️',
    color: 'teal',
    target_amount: 100,
    current_amount: 90,
    deadline: '2026-10-15',
    milestones: [
      { name: 'Security Audit Readiness', completed: true },
      { name: 'Penetration Testing Passed', completed: true },
      { name: 'Final Auditor Sign-off', completed: false },
    ],
  },
  {
    title: 'SaaS Gross Margin Optimization (> 75%)',
    description: 'Operational target: gross margin percent.',
    icon: '📈',
    color: 'amber',
    target_amount: 75,
    current_amount: 68.5,
    deadline: '2026-11-30',
    milestones: [
      { name: 'AWS Cloud Cost Optimization', completed: true },
      { name: 'Vendor Contract Renegotiation', completed: false },
    ],
  },
];

export interface SampleWealthItem {
  type: 'asset' | 'liability';
  name: string;
  category: string;
  value: number;
  institution: string;
  notes: string;
}

export const SAMPLE_WEALTH: SampleWealthItem[] = [
  { type: 'asset', name: 'Treasury Bills', category: 'stocks', value: 4500000, institution: 'Sample', notes: 'Liquid asset' },
  { type: 'asset', name: 'Fixed Deposits', category: 'fd', value: 2500000, institution: 'Sample', notes: 'Liquid asset' },
  { type: 'asset', name: 'Operating Accounts', category: 'bank', value: 1850000, institution: 'Sample', notes: 'Liquid asset' },
  { type: 'asset', name: 'Proprietary Software IP', category: 'other', value: 8500000, institution: 'Sample', notes: 'Intellectual property' },
  { type: 'asset', name: 'Server Hardware Infrastructure', category: 'other', value: 1200000, institution: 'Sample', notes: 'Fixed asset' },
  { type: 'liability', name: 'Term Venture Debt', category: 'personal_loan', value: 2000000, institution: 'Sample', notes: 'Term facility' },
  { type: 'liability', name: 'Trade Payables', category: 'other', value: 480000, institution: 'Sample', notes: 'Supplier dues' },
];
