// An opt-in sample enterprise workspace (clients, itemised invoices, expenses, contracts). Nothing here is created
// unless the user clicks "Load sample workspace"; every record is labelled as sample data.

export const SAMPLE_CLIENTS = [
  { name: 'Apex Dynamics Ltd', email: 'accounts@apex-dynamics.example', phone: '+91 80 0000 0001', address: 'Sample workspace record: Bengaluru', gst_number: '29AAAAA0000A1Z5' },
  { name: 'Zenith Global Logistics', email: 'finance@zenith-global.example', phone: '+91 22 0000 0002', address: 'Sample workspace record: Mumbai', gst_number: '27BBBBB0000B1Z5' },
  { name: 'Hyperion Tech Corp', email: 'ap@hyperion-tech.example', phone: '+91 11 0000 0003', address: 'Sample workspace record: New Delhi', gst_number: '07CCCCC0000C1Z5' },
] as const;

export interface SampleInvoice {
  client: number;
  daysAgo: number;
  dueInDays: number;
  status: 'paid' | 'pending' | 'overdue';
  items: { description: string; quantity: number; unit_price: number }[];
}

export const SAMPLE_INVOICES: SampleInvoice[] = [
  { client: 0, daysAgo: 40, dueInDays: -10, status: 'paid', items: [{ description: 'Platform subscription (annual, 10 seats)', quantity: 10, unit_price: 24000 }, { description: 'Onboarding & training', quantity: 1, unit_price: 45000 }] },
  { client: 1, daysAgo: 20, dueInDays: 10, status: 'pending', items: [{ description: 'Fleet analytics module', quantity: 1, unit_price: 185000 }, { description: 'API integration support (hours)', quantity: 24, unit_price: 3500 }] },
  { client: 2, daysAgo: 75, dueInDays: -45, status: 'overdue', items: [{ description: 'Data warehouse connector licence', quantity: 2, unit_price: 96000 }] },
  { client: 0, daysAgo: 5, dueInDays: 25, status: 'pending', items: [{ description: 'Quarterly success review & optimisation', quantity: 1, unit_price: 60000 }] },
];

export const SAMPLE_EXPENSES = [
  { category: 'Software & SaaS', description: 'Amazon Web Services', amount: 184000, daysAgo: 3 },
  { category: 'Software & SaaS', description: 'Amazon Web Services', amount: 171500, daysAgo: 33 },
  { category: 'Software & SaaS', description: 'Atlassian', amount: 28400, daysAgo: 8 },
  { category: 'Payroll', description: 'Contractor engineering pool', amount: 420000, daysAgo: 6 },
  { category: 'Sales & Marketing', description: 'Google Ads', amount: 65000, daysAgo: 12 },
  { category: 'Sales & Marketing', description: 'LinkedIn campaigns', amount: 38000, daysAgo: 15 },
  { category: 'Office & Facilities', description: 'Co-working space', amount: 96000, daysAgo: 10 },
  { category: 'Professional Fees', description: 'Chartered accountant retainer', amount: 32000, daysAgo: 18 },
] as const;

export const SAMPLE_CONTRACTS = [
  {
    filename: 'sample_master_services_agreement.txt',
    text: `MASTER SERVICES AGREEMENT (SAMPLE)
1. SERVICES. The Provider shall deliver the software services described in each Statement of Work to the Client.
2. PAYMENT. The Client shall pay each invoice within thirty (30) days of receipt. Late payments accrue interest at 1.5% per month on the overdue amount.
3. LIABILITY. The Provider's total aggregate liability under this Agreement shall not exceed ₹25,00,000. Neither party is liable for indirect or consequential loss.
4. TERMINATION. Either party may terminate for convenience on ninety (90) days written notice. The Client shall pay all fees accrued to the termination date plus an early termination fee of 10% of the remaining committed fees.
5. CONFIDENTIALITY. Each party shall keep the other's confidential information secret for five (5) years after termination.
6. GOVERNING LAW. This Agreement is governed by the laws of India and the courts at Bengaluru shall have exclusive jurisdiction.
7. AUTO-RENEWAL. This Agreement renews automatically for successive one-year terms unless notice of non-renewal is given sixty (60) days before expiry.`,
  },
  {
    filename: 'sample_cloud_sla.txt',
    text: `CLOUD SERVICE LEVEL AGREEMENT (SAMPLE)
1. AVAILABILITY. The Provider commits to 99.9% monthly uptime for production services, measured excluding scheduled maintenance.
2. SERVICE CREDITS. If monthly uptime falls below 99.9% but not below 99.0%, the Client receives a credit of 10% of that month's fees; below 99.0%, a credit of 25%.
3. SUPPORT RESPONSE. Critical incidents receive a response within one (1) hour and a status update every four (4) hours until resolved.
4. DATA PROTECTION. The Provider shall encrypt Client data at rest and in transit and shall notify the Client of any breach within seventy-two (72) hours.
5. LIMITATION. Service credits are the Client's sole remedy for availability failures. The Provider's liability shall not exceed the fees paid in the preceding twelve (12) months.
6. GOVERNING LAW. This Agreement is governed by the laws of India.`,
  },
  {
    filename: 'sample_vendor_nda.txt',
    text: `MUTUAL NON-DISCLOSURE AGREEMENT (SAMPLE)
1. CONFIDENTIAL INFORMATION means all non-public business, technical and financial information disclosed by either party.
2. OBLIGATIONS. The receiving party shall use Confidential Information only for evaluating the proposed vendor relationship and shall not disclose it to any third party without written consent.
3. TERM. The confidentiality obligations continue for three (3) years from the date of disclosure.
4. REMEDIES. A breach may cause irreparable harm and the disclosing party may seek injunctive relief in addition to damages. The breaching party shall bear the other party's reasonable legal costs.
5. GOVERNING LAW. This Agreement is governed by the laws of India and subject to the jurisdiction of the courts at New Delhi.`,
  },
] as const;
