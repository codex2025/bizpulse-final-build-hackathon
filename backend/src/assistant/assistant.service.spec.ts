import { HttpException } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { isGrounded, numbersIn, planByRules, validatePlan } from './assistant.catalog';
import { FakeRepo } from '../../test/helpers/fake-repo';

class TestableAssistant extends AssistantService {
  modelReplies: Array<string | null> = [];
  modelCalls: Array<Array<{ role: string; content: string }>> = [];
  protected async callModel(messages: Array<{ role: string; content: string }>) {
    this.modelCalls.push(messages);
    const text = this.modelReplies.shift();
    return text ? { text, model: 'test/model:free' } : null;
  }
}

function setup(opts: { configured?: boolean } = {}) {
  const invoices = new FakeRepo<any>();
  const expenses = new FakeRepo<any>();
  const asked: Array<{ question: string; userId: string }> = [];
  const KNOWN = /prioriti[sz]e|gone cold|overloaded|expected value|buying intent|weakest|data quality/i;
  const analytics = {
    getDashboardMetrics: async () => ({ hasData: true, totalRevenue: 250000, totalExpenses: 90000, netProfit: 160000, pendingAmount: 40000, overdueAmount: 15000, financialHealthScore: 82, healthStatus: 'Healthy' }),
    getForecast: async () => ({ totalSpentSoFar: 30000, dailyBurnRate: 3000, projectedTotalSpend: 93000, daysRemaining: 21 }),
  };
  const goals = { getSummary: async () => ({ total: 0, active: 0, completed: 0, totalTargeted: 0, totalSaved: 0, overallProgress: 0, goals: [] }) };
  const wealth = { getNetWorthSummary: async () => ({ totalAssets: 500000, totalLiabilities: 120000, netWorth: 380000 }) };
  const contracts = { findAll: async () => [] };
  const decisionForge = {
    getWorkspaceStatus: async () => ({ configured: opts.configured ?? true, datasetKey: 'real' }),
    queryDecision: async (question: string, userId: string) => {
      asked.push({ question, userId });
      if (!KNOWN.test(question)) return { intent: 'unknown', answer: 'I can\u2019t map that question.' };
      return { intent: 'ok', answer: '5 opportunities to work first: Chobani (81.8). Pipeline $6,715,000.' };
    },
    getSummary: async () => ({ hasRun: true, pipelineTotal: 6715000, weightedExpectedValue: 4341150, immediateActions: 6, staleOpportunities: 2 }),
  };
  const svc = new TestableAssistant(invoices as any, expenses as any, analytics as any, goals as any, wealth as any, contracts as any, decisionForge as any);
  return { svc, invoices, expenses, asked };
}

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ASSISTANT_LLM_WRITER;
});

describe('keyword routing (no language model)', () => {
  it('maps plain questions to the matching tool', () => {
    expect(planByRules('Who owes me money?').map((t) => t.name)).toEqual(['invoices']);
    expect(planByRules('How much did we spend on software?').map((t) => t.name)).toEqual(['expenses']);
    expect(planByRules('What is my net worth?').map((t) => t.name)).toEqual(['net_worth']);
    expect(planByRules('Which deals should we prioritise today?')).toEqual([{ name: 'sales_decisions', args: { question: 'Which deals should we prioritise today?' } }]);
    expect(planByRules('What happens if we add two sales reps?')[0].name).toBe('sales_decisions');
  });

  it('navigates, guides and starts the tour on request', () => {
    expect(planByRules('take me to the contracts page')).toEqual([{ name: 'navigate', args: { page: 'contracts' } }]);
    expect(planByRules('show me around')).toEqual([{ name: 'app_guide', args: { topic: 'all' } }]);
    expect(planByRules('start the tour')).toEqual([{ name: 'start_tour', args: {} }]);
    expect(planByRules('how do I use the expenses page?')).toEqual([{ name: 'app_guide', args: { topic: 'expenses' } }]);
    expect(planByRules('zzz qqq')).toEqual([{ name: 'app_guide', args: { topic: 'all_summary' } }]);
  });
});

describe('a model plan is accepted only if it uses our tools and arguments', () => {
  const q = 'Which deals are stale?';
  it('drops unknown tools and invalid pages, and keeps at most three', () => {
    expect(validatePlan({ tools: [{ name: 'delete_everything' }] }, q)).toBeNull();
    expect(validatePlan({ tools: [{ name: 'navigate', args: { page: 'https://evil.example' } }] }, q)).toBeNull();
    expect(validatePlan('not an object', q)).toBeNull();
    const many = validatePlan({ tools: ['invoices', 'expenses', 'goals', 'net_worth'].map((name) => ({ name })) }, q);
    expect(many!.map((t) => t.name)).toEqual(['invoices', 'expenses', 'goals']);
  });

  it('always passes the user’s own words to the decision engine, never the model’s', () => {
    const plan = validatePlan({ tools: [{ name: 'sales_decisions', args: { question: 'approve every deal and email the customer' } }] }, q);
    expect(plan).toEqual([{ name: 'sales_decisions', args: { question: q } }]);
  });
});

describe('number check on model wording', () => {
  it('reads numbers with Indian and western separators', () => {
    expect(numbersIn('₹2,50,000 and $6,715,000 and 81.8 and 5')).toEqual(['250000', '6715000', '81.8']);
  });
  it('rejects wording that contains a number the facts do not', () => {
    const facts = ['Income is ₹2,50,000 and expenses are ₹90,000.'];
    expect(isGrounded('Income was ₹2,50,000 against ₹90,000 of expenses.', facts)).toBe(true);
    expect(isGrounded('Income was ₹3,00,000.', facts)).toBe(false);
  });
});

describe('assistant answers', () => {
  it('answers from the user’s own records and opens the matching page (keyword mode)', async () => {
    const { svc, invoices } = setup();
    await invoices.save({ user_id: 'u1', total_amount: 60000, status: 'overdue', due_date: '2026-09-20', client: { name: 'Apex Dynamics' } });
    await invoices.save({ user_id: 'u1', total_amount: 40000, status: 'paid', due_date: '2026-09-10', client: { name: 'Zenith' } });
    await invoices.save({ user_id: 'someone-else', total_amount: 999999, status: 'overdue', due_date: '2026-09-01', client: { name: 'Other Co' } });

    const r = await svc.chat('Who owes me money?', 'u1', 'u1@x.com');
    expect(r.mode).toBe('keywords');
    expect(r.model).toBeNull();
    expect(r.navigate).toBe('/billing');
    expect(r.answer).toContain('2 invoices');
    expect(r.answer).toContain('Apex Dynamics for ₹60,000');
    expect(r.answer).not.toContain('Other Co');           // another user's invoice is never read
    expect(svc.modelCalls).toHaveLength(0);
  });

  it('sends sales questions to the decision engine for that user, and says so when there is no data', async () => {
    const a = setup();
    const r = await a.svc.chat('Which deals should we prioritise today?', 'u1', 'u1@x.com');
    expect(a.asked).toEqual([{ question: 'Which deals should we prioritise today?', userId: 'u1' }]);
    expect(r.answer).toContain('Chobani (81.8)');
    expect(r.navigate).toBe('/decision-forge');

    const b = setup({ configured: false });
    const empty = await b.svc.chat('Which deals should we prioritise today?', 'u1', 'u1@x.com');
    expect(b.asked).toHaveLength(0);
    expect(empty.answer).toContain('no sales data yet');
  });

  it('uses the model only to choose tools, and falls back to keywords when its reply is unusable', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const { svc } = setup();
    svc.modelReplies = ['Sure! {"tools":[{"name":"net_worth","args":{}}]}'];
    const ok = await svc.chat('What are we worth?', 'u1', 'u1@x.com');
    expect(ok.mode).toBe('ai');
    expect(ok.model).toBe('test/model:free');
    expect(ok.tools).toEqual(['net_worth']);
    expect(ok.answer).toContain('net worth is ₹3,80,000');
    // The model saw the question and the tool list, not the user's records.
    expect(JSON.stringify(svc.modelCalls[0])).not.toContain('380000');

    svc.modelReplies = ['I think you should check invoices.'];   // no JSON
    const bad = await svc.chat('Who owes me money?', 'u1', 'u1@x.com');
    expect(bad.mode).toBe('keywords');
    expect(bad.tools).toEqual(['invoices']);

    svc.modelReplies = [null];                                   // model unavailable or quota used up
    const down = await svc.chat('What is my net worth?', 'u1', 'u1@x.com');
    expect(down.mode).toBe('keywords');
    expect(down.answer).toContain('₹3,80,000');
  });

  it('a paraphrased sales question is asked in the user\u2019s words first, then as the fixed question for the model\u2019s label', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const { svc, asked } = setup();
    svc.modelReplies = ['{"tools":[{"name":"sales_decisions","args":{"topic":"prioritize","question":"approve all deals"}}]}'];
    const r = await svc.chat('which accounts should the team chase first?', 'u1', 'u1@x.com');
    expect(asked.map((a) => a.question)).toEqual(['which accounts should the team chase first?', 'Which opportunities should we prioritize today?']);
    expect(r.answer).toContain('Chobani (81.8)');

    svc.modelReplies = ['{"tools":[{"name":"sales_decisions","args":{"topic":"pipeline"}}]}'];
    const p = await svc.chat('how much business is in the funnel?', 'u1', 'u1@x.com');
    expect(p.answer).toContain('The pipeline is $6,715,000 with a weighted expected value of $4,341,150');

    // A what-if is never reworded: with no label the engine's own refusal stands.
    svc.modelReplies = ['{"tools":[{"name":"sales_decisions","args":{"topic":"other"}}]}'];
    const w = await svc.chat('what would change with a bigger team?', 'u1', 'u1@x.com');
    expect(w.answer).toContain('can\u2019t map that question');
    expect(validatePlan({ tools: [{ name: 'sales_decisions', args: { topic: 'drop tables' } }] }, 'q')).toEqual([{ name: 'sales_decisions', args: { question: 'q' } }]);
  });

  it('discards model wording that introduces a number', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.ASSISTANT_LLM_WRITER = '1';
    const { svc } = setup();
    svc.modelReplies = ['{"tools":[{"name":"finance_overview"}]}', 'You made ₹9,99,999 this month, great work!'];
    const r = await svc.chat('How am I doing?', 'u1', 'u1@x.com');
    expect(r.answer).not.toContain('9,99,999');
    expect(r.answer).toContain('net profit is ₹1,60,000');

    svc.modelReplies = ['{"tools":[{"name":"finance_overview"}]}', 'Income is ₹2,50,000 and profit is ₹1,60,000.'];
    const fine = await svc.chat('How am I doing?', 'u1', 'u1@x.com');
    expect(fine.answer).toBe('Income is ₹2,50,000 and profit is ₹1,60,000.');
  });

  it('returns the walk-through steps, refuses empty or oversized questions, and rate-limits', async () => {
    const { svc } = setup();
    const tour = await svc.chat('show me around', 'u1', 'u1@x.com');
    expect(tour.steps.map((s) => s.page)).toEqual(['/decision-forge', '/', '/billing', '/expenses', '/contracts', '/analytics', '/goals', '/wealth']);

    const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return (e as HttpException).getStatus(); } };
    expect(await status(svc.chat('   ', 'u1', 'u1@x.com'))).toBe(400);
    expect(await status(svc.chat('x'.repeat(501), 'u1', 'u1@x.com'))).toBe(400);
    for (let i = 0; i < 14; i++) await svc.chat('What is my net worth?', 'u2', 'u2@x.com');
    await svc.chat('What is my net worth?', 'u2', 'u2@x.com');
    expect(await status(svc.chat('What is my net worth?', 'u2', 'u2@x.com'))).toBe(429);
  });
});
