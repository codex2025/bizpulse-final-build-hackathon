import { HttpException } from '@nestjs/common';
import { DecisionForgeService, canTransition } from './decision-forge.service';
import { FakeRepo } from '../../test/helpers/fake-repo';

class TestableService extends DecisionForgeService {
  aiCalls: Array<{
    method: string;
    path: string;
    workspace: string;
    body?: any;
  }> = [];
  aiResponses: Record<string, any> = {};
  protected ai(userId: string): any {
    const record = (method: string) => async (path: string, body?: any) => {
      this.aiCalls.push({ method, path, workspace: userId, body });
      return { data: this.aiResponses[path] ?? {} };
    };
    return { get: record('get'), post: record('post') };
  }
}

const REC = (runId: string, oppId = 'OPP-1') => ({
  recommendation_id: `REC-${runId}-${oppId}`,
  opportunity_id: oppId,
  company_name: 'Real Corp',
  deal_value: 500000,
  priority_score: 80,
  decision_class: 'IMMEDIATE_ACTION',
  suggested_action: 'Call the customer',
  confidence: 0.9,
  factors: [{ name: 'Deal Size Impact' }],
  evidence_pack: { rag_notes: [] },
  warnings: [],
});

async function setup() {
  const runs = new FakeRepo<any>();
  const approvals = new FakeRepo<any>();
  const audit = new FakeRepo<any>();
  const policies = new FakeRepo<any>();
  const queries = new FakeRepo<any>();
  const clients = new FakeRepo<any>();
  const config = { get: (_k: string, d: string) => d };
  const svc = new TestableService(
    config as any,
    runs as any,
    approvals as any,
    audit as any,
    policies as any,
    queries as any,
    clients as any,
    new FakeRepo() as any,
  );
  await runs.save({
    decisionRunId: 'DR-A',
    userId: 'user-a',
    policyVersion: 'v1',
    snapshotId: 'snap-1',
    recordsAnalyzed: 1,
    recommendations: [REC('DR-A')],
    dataSnapshot: '2026-09-27',
    highPriorityCount: 1,
    staleWarningCount: 0,
  });
  return { svc, runs, approvals, audit, clients };
}

const status = async (p: Promise<any>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as HttpException).getStatus();
  }
};

describe('approval state machine', () => {
  it('allows the documented transitions only', () => {
    expect(canTransition('DRAFT', 'REVIEW')).toBe(true);
    expect(canTransition('REVIEW', 'APPROVED')).toBe(true);
    expect(canTransition('MODIFIED', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'REJECTED')).toBe(false);
    expect(canTransition('REJECTED', 'APPROVED')).toBe(false);
    expect(canTransition('APPROVED', 'MODIFIED')).toBe(false);
  });

  it('DRAFT -> REVIEW -> APPROVED records history, policy version and an evidence snapshot', async () => {
    const { svc } = await setup();
    const id = 'REC-DR-A-OPP-1';
    const review = await svc.startReview(id, {}, 'user-a', 'a@x.com');
    expect(review!.status).toBe('REVIEW');
    const done = await svc.reviewAction(
      id,
      'APPROVED',
      { reviewerNotes: 'looks right' },
      'user-a',
      'a@x.com',
    );
    expect(done!.status).toBe('APPROVED');
    expect(done!.policyVersion).toBe('v1');
    expect(done!.snapshotId).toBe('snap-1');
    expect(done!.evidenceSnapshot.factors[0].name).toBe('Deal Size Impact');
    expect(done!.evidenceSnapshot.priority_score).toBe(80);
    expect(done!.statusHistory.map((h: any) => h.to)).toEqual([
      'REVIEW',
      'APPROVED',
    ]);
    expect(done!.approvedAction).toBe('Call the customer'); // defaults to the recommended action
  });

  it('APPROVED and REJECTED are terminal', async () => {
    const { svc } = await setup();
    const id = 'REC-DR-A-OPP-1';
    await svc.reviewAction(
      id,
      'REJECTED',
      { reviewerNotes: 'no' },
      'user-a',
      'a@x.com',
    );
    expect(
      await status(svc.reviewAction(id, 'APPROVED', {}, 'user-a', 'a@x.com')),
    ).toBe(409);
  });

  it('MODIFIED requires the modified action and may be approved afterwards', async () => {
    const { svc } = await setup();
    const id = 'REC-DR-A-OPP-1';
    expect(
      await status(svc.reviewAction(id, 'MODIFIED', {}, 'user-a', 'a@x.com')),
    ).toBe(400);
    const mod = await svc.reviewAction(
      id,
      'MODIFIED',
      { approvedAction: 'Send pricing first' },
      'user-a',
      'a@x.com',
    );
    expect(mod!.approvedAction).toBe('Send pricing first');
    const fin = await svc.reviewAction(id, 'APPROVED', {}, 'user-a', 'a@x.com');
    expect(fin!.status).toBe('APPROVED');
  });

  it('writes an audit record with policy version and snapshot for every decision', async () => {
    const { svc, audit } = await setup();
    await svc.reviewAction(
      'REC-DR-A-OPP-1',
      'APPROVED',
      {},
      'user-a',
      'a@x.com',
    );
    const evt = audit.rows.find((r) => r.eventType === 'ACTION_APPROVED');
    expect(evt.payload).toMatchObject({
      policyVersion: 'v1',
      snapshotId: 'snap-1',
      from: 'DRAFT',
      to: 'APPROVED',
    });
  });
});

describe('ownership and tampering', () => {
  it("another user cannot approve, review or replay someone else's decision", async () => {
    const { svc } = await setup();
    const id = 'REC-DR-A-OPP-1';
    expect(
      await status(svc.reviewAction(id, 'APPROVED', {}, 'user-b', 'b@x.com')),
    ).toBe(404);
    expect(await status(svc.startReview(id, {}, 'user-b', 'b@x.com'))).toBe(
      404,
    );
    expect(await status(svc.replayDecision('DR-A', 'user-b'))).toBe(404);
    expect(await status(svc.getEvidence('DR-A', 'user-b'))).toBe(404);
    expect(await status(svc.replayDecision('DR-A', 'user-a'))).toBe(200);
  });

  it('a spoofed decisionRunId does not let a user act on another workspace', async () => {
    const { svc } = await setup();
    expect(
      await status(
        svc.reviewAction(
          'REC-DR-A-OPP-1',
          'APPROVED',
          { decisionRunId: 'DR-A' },
          'user-b',
          'b@x.com',
        ),
      ),
    ).toBe(404);
  });

  it('company, deal value and opportunity come from the stored run, never the request body', async () => {
    const { svc } = await setup();
    const done = await svc.reviewAction(
      'REC-DR-A-OPP-1',
      'APPROVED',
      {
        companyName: 'Evil Inc',
        dealValue: 1,
        opportunityId: 'OPP-999',
        approvedAction: 'ok',
      } as any,
      'user-a',
      'a@x.com',
    );
    expect(done).toMatchObject({
      companyName: 'Real Corp',
      dealValue: 500000,
      opportunityId: 'OPP-1',
    });
  });

  it('unknown recommendations are rejected', async () => {
    const { svc } = await setup();
    expect(
      await status(
        svc.reviewAction('REC-DR-A-NOPE', 'APPROVED', {}, 'user-a', 'a@x.com'),
      ),
    ).toBe(404);
    expect(
      await status(
        svc.reviewAction('garbage', 'APPROVED', {}, 'user-a', 'a@x.com'),
      ),
    ).toBe(404);
  });

  it('rejects oversized or non-text comments', async () => {
    const { svc } = await setup();
    expect(
      await status(
        svc.reviewAction(
          'REC-DR-A-OPP-1',
          'APPROVED',
          { reviewerNotes: 'x'.repeat(2001) },
          'user-a',
          'a@x.com',
        ),
      ),
    ).toBe(400);
    expect(
      await status(
        svc.reviewAction(
          'REC-DR-A-OPP-1',
          'APPROVED',
          { reviewerNotes: { $ne: 1 } as any },
          'user-a',
          'a@x.com',
        ),
      ),
    ).toBe(400);
  });

  it('convert-to-client needs an approved recommendation owned by the caller', async () => {
    const { svc, clients } = await setup();
    const id = 'REC-DR-A-OPP-1';
    expect(await status(svc.convertToClient(id, {}, 'user-a', 'a@x.com'))).toBe(
      404,
    ); // no approval yet
    await svc.startReview(id, {}, 'user-a', 'a@x.com');
    expect(await status(svc.convertToClient(id, {}, 'user-a', 'a@x.com'))).toBe(
      409,
    ); // still in review
    await svc.reviewAction(id, 'APPROVED', {}, 'user-a', 'a@x.com');
    expect(
      await status(
        svc.convertToClient(
          id,
          { companyName: 'Evil Inc' },
          'user-b',
          'b@x.com',
        ),
      ),
    ).toBe(404);
    const res = await svc.convertToClient(
      id,
      { companyName: 'Evil Inc' },
      'user-a',
      'a@x.com',
    );
    expect(res.clientName).toBe('Real Corp'); // name from the approval, not the body
    expect(clients.rows).toHaveLength(1);
  });

  it("lists only the caller's approvals and audit events", async () => {
    const { svc } = await setup();
    await svc.reviewAction(
      'REC-DR-A-OPP-1',
      'APPROVED',
      {},
      'user-a',
      'a@x.com',
    );
    expect(await svc.getApprovals('user-a')).toHaveLength(1);
    expect(await svc.getApprovals('user-b')).toHaveLength(0);
    expect((await svc.getAuditLogs('user-b')).length).toBe(0);
  });
});

describe('workspace scoping and query trail', () => {
  it('every ai-service call carries the caller as the workspace', async () => {
    const { svc } = await setup();
    svc.aiResponses['/dataset'] = { count: 12 };
    svc.aiResponses['/decide/run'] = {
      decision_run_id: 'DR-Z',
      recommendations: [],
      policy: {},
      snapshot_id: 's',
    };
    await svc.getDataset('user-a');
    await svc.getQuality('user-b');
    await svc.simulateTwin({}, 'user-a');
    await svc.runDecisionEngine('user-b', 'b@x.com');
    expect(svc.aiCalls.map((c) => [c.path, c.workspace])).toEqual([
      ['/dataset', 'user-a'],
      ['/quality', 'user-b'],
      ['/twin/simulate', 'user-a'],
      ['/decide/run', 'user-b'],
    ]);
  });

  it('stores the question, plan, snapshot and policy so the decision can be replayed', async () => {
    const { svc } = await setup();
    svc.aiResponses['/decisions/query'] = {
      answer: 'Top: Real Corp',
      intent: 'prioritize_opportunities',
      confidence: 0.9,
      decision_run_id: 'DR-Q',
      plan: {
        intent: 'prioritize_opportunities',
        planner: 'rules',
        analytics_tools: [],
      },
      analytics: [{ tool: 'get_pipeline_summary' }],
      rag: { status: 'ok', evidence: [{ doc_id: 'd1' }] },
      trace: [{ step: 'plan' }],
      snapshot_id: 'snap-9',
      dataset_key: 'real',
      policy_version: 'v1',
      data_snapshot: '2026-09-27',
      recommendations: [REC('DR-Q')],
      run_summary: {
        records_analyzed: 1,
        pipeline_total_value: 5,
        weighted_pipeline_value: 4,
        high_priority_count: 1,
        stale_warning_count: 0,
        policy_version: 'v1',
        policy: { w: 1 },
      },
    };
    await svc.queryDecision(
      'Which opportunities should we prioritize today?',
      'user-a',
      'a@x.com',
    );
    const replay = await svc.replayDecision('DR-Q', 'user-a');
    const steps = replay.replay.map((s: any) => s.step);
    expect(steps).toEqual([
      'question',
      'query_plan',
      'data_snapshot',
      'analytics',
      'rag_results',
      'evidence',
      'policy',
      'score',
      'recommendation',
      'approval',
    ]);
    expect(replay.replay[0].detail.question).toBe(
      'Which opportunities should we prioritize today?',
    );
    expect(replay.replay[2].detail.snapshotId).toBe('snap-9');
    expect(replay.replay[6].detail.policy).toEqual({ w: 1 });
  });

  it('records a what-if asked in words as a simulation, with its parameters and result', async () => {
    const { svc, audit } = await setup();
    svc.aiResponses['/decisions/query'] = {
      answer:
        'Scenario estimate (not a forecast): 6 sales reps (baseline 4) ...',
      intent: 'scenario_simulation',
      confidence: 0.8,
      plan: {
        intent: 'scenario_simulation',
        planner: 'rules',
        analytics_tools: ['run_decision_twin'],
      },
      analytics: [
        { tool: 'run_decision_twin', result: { simulation_id: 'SIM-abc' } },
      ],
      rag: { status: 'not_required', evidence: [] },
      trace: [{ step: 'plan' }, { step: 'scenario_parse' }],
      snapshot_id: 'snap-9',
      dataset_key: 'synthetic',
      scenario: {
        recognized: true,
        levers: [
          {
            lever: 'sales_reps_count',
            label: 'sales reps',
            baseline: 4,
            scenario: 6,
            note: '4 baseline + 2',
          },
        ],
        baseline_params: { sales_reps_count: 4 },
        scenario_params: { sales_reps_count: 6 },
        simulation: {
          simulation_id: 'SIM-abc',
          delta_revenue_percent: -47,
          rep_capacity_utilization_percent: 7.2,
          comparisons: [],
        },
      },
    };
    const res = await svc.queryDecision(
      'What happens if we add two sales reps?',
      'user-a',
      'a@x.com',
    );
    expect(res.scenario.recognized).toBe(true); // the UI payload passes through untouched
    expect((svc as any).queryRepo.rows[0].analytics[0].tool).toBe(
      'run_decision_twin',
    );
    expect(
      audit.rows.find((r) => r.eventType === 'QUERY_RUN').payload,
    ).toMatchObject({
      intent: 'scenario_simulation',
      tools: ['run_decision_twin'],
    });
    const sim = audit.rows.find((r) => r.eventType === 'SIMULATION_RUN');
    expect(sim.payload).toMatchObject({
      source: 'question',
      inputs: { sales_reps_count: 6 },
      baseline: { sales_reps_count: 4 },
      simulationId: 'SIM-abc',
      deltaRevenuePercent: -47,
    });
    expect(sim.payload.message).toContain('sales reps 4 -> 6');
    expect(sim.payload.message).toContain('-47%');
  });

  it('a blocked what-if (nothing simulated) logs the question but no simulation', async () => {
    const { svc, audit } = await setup();
    svc.aiResponses['/decisions/query'] = {
      answer: "I can't run that scenario as asked.",
      intent: 'scenario_simulation',
      confidence: 0,
      plan: {
        intent: 'scenario_simulation',
        planner: 'rules',
        analytics_tools: ['run_decision_twin'],
      },
      analytics: [],
      rag: { status: 'not_required', evidence: [] },
      trace: [],
      scenario: { recognized: false, levers: [], simulation: null },
    };
    await svc.queryDecision('What if we add 50 reps?', 'user-a', 'a@x.com');
    expect(audit.rows.some((r) => r.eventType === 'QUERY_RUN')).toBe(true);
    expect(audit.rows.some((r) => r.eventType === 'SIMULATION_RUN')).toBe(
      false,
    );
  });

  it('rejects empty and oversized questions', async () => {
    const { svc } = await setup();
    expect(await status(svc.queryDecision('   ', 'user-a', 'a@x.com'))).toBe(
      400,
    );
    expect(
      await status(svc.queryDecision('x'.repeat(501), 'user-a', 'a@x.com')),
    ).toBe(400);
    expect(
      await status(svc.queryDecision({ $gt: '' } as any, 'user-a', 'a@x.com')),
    ).toBe(400);
  });

  it('external context failure degrades to internal-only instead of failing the decision', async () => {
    const { svc } = await setup();
    (svc as any).ai = () => ({
      post: async () => {
        throw Object.assign(new Error('down'), { response: undefined });
      },
    });
    const res = await svc.fetchExternalContext('OPP-1', 'user-a', 'a@x.com');
    expect(res.status).toBe('unavailable');
    expect(res.message).toContain(
      'Decision calculated from internal business data',
    );
  });

  it('summary counts open items and excludes finally-decided ones', async () => {
    const { svc, runs } = await setup();
    runs.rows[0].recommendations = [
      { ...REC('DR-A', 'O1'), decision_class: 'IMMEDIATE_ACTION' },
      {
        ...REC('DR-A', 'O2'),
        decision_class: 'NURTURE_MONITOR',
        stale_data_warning: 'stale',
      },
      {
        ...REC('DR-A', 'O3'),
        decision_class: 'NURTURE_MONITOR',
        review_required: true,
      },
    ];
    runs.rows[0].recordsAnalyzed = 3;
    let s: any = await svc.getSummary('user-a', 'a@x.com');
    expect(s).toMatchObject({
      immediateActions: 1,
      staleOpportunities: 1,
      reviewRequired: 1,
      requiresAttention: 3,
    });
    await svc.reviewAction('REC-DR-A-O1', 'APPROVED', {}, 'user-a', 'a@x.com');
    s = await svc.getSummary('user-a', 'a@x.com');
    expect(s).toMatchObject({ immediateActions: 0, requiresAttention: 2 });
  });
});

describe('rate limiting and service token', () => {
  it('limits questions per user without affecting other users', async () => {
    const { svc } = await setup();
    svc.aiResponses['/decisions/query'] = {
      answer: 'ok',
      intent: 'unknown',
      plan: {},
      analytics: [],
      rag: {},
      trace: [],
      confidence: 0,
    };
    for (let i = 0; i < 30; i++) {
      await svc.queryDecision(
        'Which customers have gone cold?',
        'busy-user',
        'b@x.com',
      );
    }
    expect(
      await status(svc.queryDecision('one more', 'busy-user', 'b@x.com')),
    ).toBe(429);
    expect(
      await status(svc.queryDecision('hello', 'quiet-user', 'q@x.com')),
    ).toBe(200);
  });

  it('sends the shared service token when configured', async () => {
    const runs = new FakeRepo<any>();
    const config = {
      get: (k: string, d: any) => (k === 'AI_SERVICE_TOKEN' ? 'tok-123' : d),
    };
    const svc: any = new DecisionForgeService(
      config as any,
      runs as any,
      new FakeRepo() as any,
      new FakeRepo() as any,
      new FakeRepo() as any,
      new FakeRepo() as any,
      new FakeRepo() as any,
      new FakeRepo() as any,
    );
    expect(svc.serviceHeaders()).toEqual({ 'X-Internal-Token': 'tok-123' });
    const noToken: any = new DecisionForgeService(
      { get: (_k: string, d: any) => d } as any,
      runs as any,
      new FakeRepo() as any,
      new FakeRepo() as any,
      new FakeRepo() as any,
      new FakeRepo() as any,
      new FakeRepo() as any,
      new FakeRepo() as any,
    );
    expect(noToken.serviceHeaders()).toEqual({});
  });
});

describe('demo reset', () => {
  it("clears the caller's runs, approvals and query logs but never the audit log, and only for that caller", async () => {
    const { svc, runs, approvals, audit } = await setup();
    svc.aiResponses['/reset-demo'] = { snapshot_id: 'snap-x', count: 12 };
    await svc.reviewAction(
      'REC-DR-A-OPP-1',
      'APPROVED',
      {},
      'user-a',
      'a@x.com',
    );
    await runs.save({
      decisionRunId: 'DR-B',
      userId: 'user-b',
      recommendations: [REC('DR-B')],
    });
    const policies = (svc as any).policyRepo as FakeRepo<any>;
    await policies.save({ userId: 'user-a', version: 7, isActive: true });
    await policies.save({ userId: 'user-b', version: 3, isActive: true });
    await svc.resetDemoData('user-a', 'a@x.com', 'real', true);
    expect(policies.rows.map((r) => r.userId)).toEqual(['user-b']); // saved policy reset to default for the caller only
    expect(runs.rows.map((r) => r.userId)).toEqual(['user-b']); // other tenants untouched
    expect(approvals.rows).toHaveLength(0);
    expect(audit.rows.some((r) => r.eventType === 'ACTION_APPROVED')).toBe(
      true,
    ); // history of what happened survives
    expect(
      audit.rows.some(
        (r) => r.eventType === 'DEMO_RESET' && r.payload.historyCleared,
      ),
    ).toBe(true);
  });

  it('a plain dataset switch keeps history', async () => {
    const { svc, runs } = await setup();
    svc.aiResponses['/reset-demo'] = { snapshot_id: 'snap-x', count: 520 };
    await svc.resetDemoData('user-a', 'a@x.com', 'synthetic');
    expect(runs.rows).toHaveLength(1);
  });
});

describe('empty start: nothing is analysed until the user chooses data', () => {
  it('a user with no dataset and no runs is not configured, and the summary does not run the engine', async () => {
    const { svc } = await setup();
    expect(await svc.getWorkspaceStatus('user-new')).toEqual({
      configured: false,
      datasetKey: null,
    });
    expect(await svc.getSummary('user-new', 'n@x.com')).toEqual({
      hasRun: false,
      needsData: true,
    });
    expect(svc.aiCalls).toHaveLength(0);
  });

  it('loading a dataset configures the workspace; Start Over empties it but keeps the audit log', async () => {
    const { svc, runs, audit } = await setup();
    svc.aiResponses['/reset-demo'] = {
      dataset_key: 'real',
      snapshot_id: 's1',
      state_fingerprint: 'fp1',
      count: 12,
    };
    await svc.resetDemoData('user-a', 'a@x.com', 'real');
    expect(await svc.getWorkspaceStatus('user-a')).toEqual({
      configured: true,
      datasetKey: 'real',
    });

    expect(await svc.clearWorkspace('user-a', 'a@x.com')).toEqual({
      configured: false,
      datasetKey: null,
    });
    expect(await svc.getWorkspaceStatus('user-a')).toEqual({
      configured: false,
      datasetKey: null,
    });
    expect(runs.rows.filter((r: any) => r.userId === 'user-a')).toHaveLength(0);
    expect(audit.rows.map((r: any) => r.eventType)).toContain(
      'WORKSPACE_CLEARED',
    );
  });
});
