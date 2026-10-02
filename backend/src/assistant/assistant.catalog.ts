/**
 * The assistant's fixed tool list. A question is mapped to tools from this list only, either by the
 * language model (which sees the question text and nothing else) or by the keyword rules below.
 * Tools are run by the gateway for the signed-in user; neither the model nor the rules produce a number.
 */

export const PAGES: Record<string, { path: string; label: string; about: string }> = {
  dashboard: { path: '/', label: 'Dashboard', about: 'This month’s income, expenses, profit, unpaid invoices and the latest recommendations.' },
  decision_forge: { path: '/decision-forge', label: 'DecisionForge', about: 'The decision engine. Upload sales opportunities, get them ranked with reasons and evidence, test what-if scenarios and approve the actions.' },
  billing: { path: '/billing', label: 'Invoicing', about: 'Create GST invoices for clients and track which are paid, pending or overdue.' },
  expenses: { path: '/expenses', label: 'Expenses', about: 'Record what the business spends, by category, and export it.' },
  contracts: { path: '/contracts', label: 'Contracts', about: 'Upload a loan agreement or vendor contract to see its clauses, the risky ones, and what a loan costs.' },
  analytics: { path: '/analytics', label: 'Analytics', about: 'Cash flow, spending by category, unit economics and a forecast over a chosen time range.' },
  goals: { path: '/goals', label: 'Goals', about: 'Savings and business targets with progress towards each.' },
  wealth: { path: '/wealth', label: 'Net Worth', about: 'What the business owns and owes, and the net worth.' },
  settings: { path: '/settings', label: 'Settings', about: 'Your profile and the light or dark appearance.' },
};

export type ToolName =
  | 'finance_overview' | 'invoices' | 'expenses' | 'contracts' | 'goals' | 'net_worth'
  | 'cash_forecast' | 'sales_decisions' | 'app_guide' | 'navigate' | 'start_tour';

export const TOOLS: Record<ToolName, { description: string; page?: keyof typeof PAGES }> = {
  finance_overview: { description: 'This month: income, expenses, profit, unpaid and overdue invoice amounts, financial health score.', page: 'dashboard' },
  invoices: { description: 'Invoices and clients: how many, paid / pending / overdue totals, who owes money.', page: 'billing' },
  expenses: { description: 'Expenses: totals, spending by category, largest expenses.', page: 'expenses' },
  contracts: { description: 'Analysed contracts and loans: risky clauses, monthly repayments (EMI).', page: 'contracts' },
  goals: { description: 'Goals and savings targets and their progress.', page: 'goals' },
  net_worth: { description: 'Assets, liabilities and net worth.', page: 'wealth' },
  cash_forecast: { description: 'Projected spending and balance for the rest of this month, daily burn rate.', page: 'analytics' },
  sales_decisions: {
    description: 'Anything about sales opportunities, deals, pipeline, customers, sales reps, which deals to prioritise, stale deals, evidence for a deal, and what-if questions (for example adding sales reps). args: {"question": the user’s question}.',
    page: 'decision_forge',
  },
  app_guide: { description: 'What the product can do, how to use a page, how to upload data, or a guided walk through every page. args: {"topic": one page name or "all"}.' },
  navigate: { description: `Open a page. args: {"page": one of ${Object.keys(PAGES).join(', ')}}.` },
  start_tour: { description: 'Start the built-in product tour with pop-up cards.' },
};

export interface PlannedTool {
  name: ToolName;
  args: { question?: string; page?: string; topic?: string };
}

const PAGE_WORDS: Array<[RegExp, keyof typeof PAGES]> = [
  [/\b(decision ?forge|decision engine|decision center|decision twin|data quality|audit)\b/, 'decision_forge'],
  [/\b(invoic\w*|billing)\b/, 'billing'],
  [/\bexpenses?\b/, 'expenses'],
  [/\bcontracts?\b/, 'contracts'],
  [/\banalytics\b/, 'analytics'],
  [/\bgoals?\b/, 'goals'],
  [/\b(net worth|wealth|assets?)\b/, 'wealth'],
  [/\bsettings?\b/, 'settings'],
  [/\b(dashboard|home)\b/, 'dashboard'],
];

const TOPIC_RULES: Array<[RegExp, ToolName]> = [
  [/\b(what if|what happens if|deals?|opportunit\w*|pipeline|prioriti[sz]e\w*|sales|reps?|customers?|win probability|stale|gone cold|evidence)\b/, 'sales_decisions'],
  [/\b(invoic\w*|bills?|billing|unpaid|overdue|receivables?|owes?|owed|clients?)\b/, 'invoices'],
  [/\b(expenses?|spend\w*|spent|costs?)\b/, 'expenses'],
  [/\b(contracts?|loans?|emi|clauses?|repayments?)\b/, 'contracts'],
  [/\b(goals?|targets?)\b/, 'goals'],
  [/\b(net worth|assets?|liabilit\w*|wealth)\b/, 'net_worth'],
  [/\b(forecast|burn rate|month[- ]end|projected|projection)\b/, 'cash_forecast'],
  [/\b(revenue|profit|income|earn\w*|health score|financial health|how am i doing|overview|this month)\b/, 'finance_overview'],
];

/** Keyword routing: used when no language model is configured, or when its plan is unusable. */
export function planByRules(question: string): PlannedTool[] {
  const q = question.toLowerCase();
  if (/\b(product tour|start (the )?tour|restart (the )?tour)\b/.test(q)) return [{ name: 'start_tour', args: {} }];
  if (/\b(show me around|walk me through|guide me|give me a tour|explore everything|each (page|feature|functionalit\w*))\b/.test(q)) {
    return [{ name: 'app_guide', args: { topic: 'all' } }];
  }

  const page = PAGE_WORDS.find(([re]) => re.test(q))?.[1];
  if (page && /\b(go to|open|take me to|navigate to|show me the|switch to|bring up)\b/.test(q)) {
    return [{ name: 'navigate', args: { page } }];
  }
  if (/\b(how do i|how to|how can i|what is|what does|what can|explain|help)\b/.test(q) && !/\bwhat (is|are) (my|our|the total)\b/.test(q)) {
    return [{ name: 'app_guide', args: { topic: page || 'all_summary' } }];
  }

  const tools = TOPIC_RULES.filter(([re]) => re.test(q)).map(([, name]) => name);
  const unique = [...new Set(tools)].slice(0, 3);
  if (unique.length === 0) return [{ name: 'app_guide', args: { topic: 'all_summary' } }];
  return unique.map((name) => ({ name, args: name === 'sales_decisions' ? { question } : {} }));
}

/** Accepts a model's plan only if every tool and argument is one we defined; anything else is dropped. */
export function validatePlan(raw: unknown, question: string): PlannedTool[] | null {
  const list = (raw as { tools?: unknown })?.tools;
  if (!Array.isArray(list)) return null;
  const out: PlannedTool[] = [];
  for (const item of list.slice(0, 3)) {
    const name = (item as { name?: unknown })?.name;
    if (typeof name !== 'string' || !(name in TOOLS)) continue;
    const args = ((item as { args?: unknown }).args || {}) as Record<string, unknown>;
    const tool: PlannedTool = { name: name as ToolName, args: {} };
    if (name === 'sales_decisions') tool.args.question = question; // always the user's own words, never the model's
    if (name === 'navigate') {
      if (typeof args.page !== 'string' || !(args.page in PAGES)) continue;
      tool.args.page = args.page;
    }
    if (name === 'app_guide') {
      tool.args.topic = typeof args.topic === 'string' && (args.topic in PAGES || args.topic === 'all') ? args.topic : 'all_summary';
    }
    out.push(tool);
  }
  return out.length ? out : null;
}

/** Numbers of two or more digits in a text, without separators, for checking a model's wording against the facts. */
export function numbersIn(text: string): string[] {
  return (text.replace(/(\d)[,  ](?=\d)/g, '$1').match(/\d+(?:\.\d+)?/g) || [])
    .map((n) => n.replace(/\.0+$/, ''))
    .filter((n) => n.replace('.', '').length >= 2);
}

/** True when every number the model wrote also appears in the facts it was given. */
export function isGrounded(answer: string, facts: string[]): boolean {
  const allowed = new Set(numbersIn(facts.join(' ')));
  return numbersIn(answer).every((n) => allowed.has(n));
}
