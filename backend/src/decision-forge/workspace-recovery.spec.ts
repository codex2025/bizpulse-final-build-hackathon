import * as http from 'http';
import { AddressInfo } from 'net';
import { HttpException } from '@nestjs/common';
import {
  DecisionForgeService,
  normalizeServiceUrl,
} from './decision-forge.service';
import { FakeRepo } from '../../test/helpers/fake-repo';

/**
 * A real HTTP server that follows the ai-service contract for workspace state:
 *  - state-dependent endpoints answer 409 WORKSPACE_RESTORE_REQUIRED when the caller's expected
 *    fingerprint is not what this "instance" holds;
 *  - /reset-demo, /ingest/apply-mapping and /workspace/restore establish state and return its fingerprint.
 * `coldStart()` forgets every workspace, like a restart or a different serverless instance.
 * (The real ai-service side is covered by ai-service/tests/test_workspace_recovery.py.)
 */
type WsState = { dataset: string; records: number; fetched: string[] };

class FakeAiService {
  server!: http.Server;
  url = '';
  workspaces = new Map<string, WsState>();
  calls: Array<{
    method: string;
    path: string;
    workspace: string;
    state?: string;
    body?: any;
  }> = [];
  restores = 0;
  restoreDelayMs = 0;
  alwaysConflict = false;
  dataVersion = 1;

  fingerprint(s: WsState) {
    return `ws-${s.dataset}-v${this.dataVersion}-${s.records}-${[...s.fetched].sort().join('+')}`;
  }

  async start() {
    this.server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const body = raw ? JSON.parse(raw) : undefined;
        const workspace = String(req.headers['x-workspace-id']);
        const state = req.headers['x-workspace-state'] as string | undefined;
        const path = (req.url || '').replace('/decision-forge', '');
        this.calls.push({
          method: req.method as string,
          path,
          workspace,
          state,
          body,
        });
        const send = (status: number, data: any) => {
          res.writeHead(status, { 'content-type': 'application/json' });
          res.end(JSON.stringify(data));
        };
        const view = (s: WsState) => ({
          dataset_key: s.dataset,
          snapshot_id: `snap-${s.dataset}`,
          count: 1,
          state_fingerprint: this.fingerprint(s),
        });

        if (path === '/reset-demo') {
          const s = { dataset: body.dataset, records: 0, fetched: [] };
          this.workspaces.set(workspace, s);
          return send(200, view(s));
        }
        if (path === '/ingest/apply-mapping') {
          const s = {
            dataset: 'custom',
            records: body.records.length,
            fetched: [],
          };
          this.workspaces.set(workspace, s);
          return send(200, { status: 'activated', ...view(s) });
        }
        if (path === '/workspace/restore') {
          this.restores++;
          if (this.restoreDelayMs)
            await new Promise((r) => setTimeout(r, this.restoreDelayMs));
          const s = {
            dataset: body.dataset_key,
            records: body.dataset_key === 'custom' ? body.records.length : 0,
            fetched: body.fetched_opportunity_ids || [],
          };
          this.workspaces.set(workspace, s);
          return send(200, {
            status: 'restored',
            matches_expected: this.fingerprint(s) === body.expected_state,
            ...view(s),
          });
        }

        // State-dependent endpoints.
        let current = this.workspaces.get(workspace);
        if (state) {
          if (
            this.alwaysConflict ||
            !current ||
            this.fingerprint(current) !== state
          ) {
            return send(409, {
              detail: {
                code: 'WORKSPACE_RESTORE_REQUIRED',
                message: 'restore first',
              },
            });
          }
        } else if (!current) {
          current = { dataset: 'real', records: 0, fetched: [] }; // the ai-service default
          this.workspaces.set(workspace, current);
        }
        if (
          path.startsWith('/opportunities/') &&
          path.endsWith('/fetch-context')
        ) {
          const id = decodeURIComponent(path.split('/')[2]);
          current.fetched = Array.from(new Set([...current.fetched, id]));
          return send(200, {
            status: 'fetched',
            opportunity_id: id,
            signal: {},
            ...view(current),
          });
        }
        return send(200, { ...view(current), ok: true });
      });
    });
    await new Promise<void>((resolve) =>
      this.server.listen(0, '127.0.0.1', () => resolve()),
    );
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  stop() {
    return new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  coldStart() {
    this.workspaces.clear();
    this.calls.length = 0;
  }

  route() {
    return this.calls.map((c) => `${c.method} ${c.path}`);
  }
}

async function harness(extraConfig: Record<string, any> = {}) {
  const ai = new FakeAiService();
  await ai.start();
  const repos = {
    runs: new FakeRepo<any>(),
    approvals: new FakeRepo<any>(),
    audit: new FakeRepo<any>(),
    policies: new FakeRepo<any>(),
    queries: new FakeRepo<any>(),
    clients: new FakeRepo<any>(),
    workspaces: new FakeRepo<any>(),
  };
  const config = {
    get: (k: string, d: any) =>
      k === 'AI_SERVICE_URL' ? ai.url : (extraConfig[k] ?? d),
  };
  const svc = new DecisionForgeService(
    config as any,
    repos.runs as any,
    repos.approvals as any,
    repos.audit as any,
    repos.policies as any,
    repos.queries as any,
    repos.clients as any,
    repos.workspaces as any,
  );
  return { ai, svc, repos };
}

const RECORDS = [
  { company_name: 'Acme Metals', opportunity_id: 'U1', deal_value: 120000 },
  { company_name: 'Bolt Co', opportunity_id: 'U3', deal_value: 50000 },
  { company_name: 'Cast Ltd', opportunity_id: 'U4' },
];

describe('recoverable workspace state', () => {
  let ctx: Awaited<ReturnType<typeof harness>>;
  beforeEach(async () => {
    ctx = await harness();
  });
  afterEach(async () => {
    await ctx.ai.stop();
  });

  it('remembers the dataset the user chose and sends its fingerprint on later calls', async () => {
    const { svc, ai, repos } = ctx;
    await svc.resetDemoData('u1', 'u1@x.com', 'synthetic');
    const stored = repos.workspaces.rows.find((r) => r.userId === 'u1');
    expect(stored).toMatchObject({
      datasetKey: 'synthetic',
      records: null,
      fetchedOpportunityIds: [],
    });

    await svc.getDataset('u1');
    const call = ai.calls.filter((c) => c.path === '/dataset').pop()!;
    expect(call.state).toBe(stored.stateFingerprint);
    expect(ai.restores).toBe(0); // warm instance: no extra round trip
  });

  it('restores the chosen dataset after an ai-service cold start and retries the original call once', async () => {
    const { svc, ai, repos } = ctx;
    await svc.resetDemoData('u1', 'u1@x.com', 'synthetic');
    ai.coldStart();

    const dataset = await svc.getDataset('u1');
    expect(dataset.dataset_key).toBe('synthetic'); // NOT silently the default 'real'
    expect(ai.route()).toEqual([
      'GET /dataset',
      'POST /workspace/restore',
      'GET /dataset',
    ]);
    expect(ai.calls[1].body).toMatchObject({
      dataset_key: 'synthetic',
      fetched_opportunity_ids: [],
    });
    expect(ai.calls[1].body.records).toBeUndefined(); // presets are rebuilt from their key alone
    expect(
      repos.audit.rows.some(
        (r) => r.eventType === 'WORKSPACE_RESTORED' && r.actorId === 'u1',
      ),
    ).toBe(true);
  });

  it('restores an uploaded dataset from the records stored at the gateway', async () => {
    const { svc, ai } = ctx;
    await svc.applyMapping(RECORDS, 'u1', 'u1@x.com');
    ai.coldStart();

    const dataset = await svc.getDataset('u1');
    expect(dataset.dataset_key).toBe('custom');
    const restore = ai.calls.find((c) => c.path === '/workspace/restore')!;
    expect(restore.body.dataset_key).toBe('custom');
    expect(restore.body.records).toEqual(RECORDS);
  });

  it('restores external context that had been fetched', async () => {
    const { svc, ai, repos } = ctx;
    await svc.resetDemoData('u1', 'u1@x.com', 'real');
    await svc.fetchExternalContext('OPP-7', 'u1', 'u1@x.com');
    const stored = repos.workspaces.rows.find((r) => r.userId === 'u1');
    expect(stored.fetchedOpportunityIds).toEqual(['OPP-7']);
    expect(stored.stateFingerprint).toBe(
      ai.fingerprint(ai.workspaces.get('u1')!),
    ); // adopted the new fingerprint

    ai.coldStart();
    await svc.getQuality('u1');
    expect(
      ai.calls.find((c) => c.path === '/workspace/restore')!.body
        .fetched_opportunity_ids,
    ).toEqual(['OPP-7']);
  });

  it('a fetch by a user who never reset (default dataset) is still recoverable', async () => {
    const { svc, ai, repos } = ctx;
    await svc.fetchExternalContext('OPP-1', 'fresh', 'f@x.com');
    expect(repos.workspaces.rows[0]).toMatchObject({
      userId: 'fresh',
      datasetKey: 'real',
      fetchedOpportunityIds: ['OPP-1'],
    });
    ai.coldStart();
    expect((await svc.getDataset('fresh')).dataset_key).toBe('real');
    expect(
      ai.calls.find((c) => c.path === '/workspace/restore')!.body
        .fetched_opportunity_ids,
    ).toEqual(['OPP-1']);
  });

  it('parallel requests after a cold start share ONE restore', async () => {
    const { svc, ai } = ctx;
    await svc.resetDemoData('u1', 'u1@x.com', 'synthetic');
    ai.coldStart();
    ai.restoreDelayMs = 60;
    const results = await Promise.all([
      svc.getDataset('u1'),
      svc.getQuality('u1'),
      svc.getDataset('u1'),
    ]);
    expect(results.every((r) => r.dataset_key === 'synthetic')).toBe(true);
    expect(ai.restores).toBe(1);
  });

  it('does nothing special for a user with nothing persisted', async () => {
    const { svc, ai } = ctx;
    await svc.getDataset('never-reset');
    expect(ai.calls[0].state).toBeUndefined();
    expect(ai.restores).toBe(0);
  });

  it("one user's state is never sent for, or restored into, another user", async () => {
    const { svc, ai } = ctx;
    await svc.applyMapping(RECORDS, 'alice', 'a@x.com');
    await svc.resetDemoData('bob', 'b@x.com', 'synthetic');
    ai.coldStart();
    await svc.getDataset('bob');
    const restore = ai.calls.find((c) => c.path === '/workspace/restore')!;
    expect(restore.workspace).toBe('bob');
    expect(restore.body.dataset_key).toBe('synthetic');
    expect(JSON.stringify(ai.calls)).not.toContain('Acme Metals'); // alice's records never appear in bob's traffic
  });

  it('switching back to a preset forgets the uploaded records', async () => {
    const { svc, repos } = ctx;
    await svc.applyMapping(RECORDS, 'u1', 'u1@x.com');
    expect(repos.workspaces.rows[0].records).toEqual(RECORDS);
    await svc.resetDemoData('u1', 'u1@x.com', 'real');
    expect(repos.workspaces.rows).toHaveLength(1);
    expect(repos.workspaces.rows[0]).toMatchObject({
      datasetKey: 'real',
      records: null,
    });
  });

  it('gives up after a single restore attempt instead of looping', async () => {
    const { svc, ai } = ctx;
    await svc.resetDemoData('u1', 'u1@x.com', 'synthetic');
    ai.alwaysConflict = true;
    ai.calls.length = 0;
    await expect(svc.getDataset('u1')).rejects.toBeInstanceOf(HttpException);
    expect(ai.restores).toBe(1);
    expect(ai.calls.filter((c) => c.path === '/dataset')).toHaveLength(2); // the original call and exactly one retry
  });

  it('adopts the new fingerprint when the rebuilt data differs from what was saved', async () => {
    const { svc, ai, repos } = ctx;
    await svc.resetDemoData('u1', 'u1@x.com', 'synthetic');
    ai.coldStart();
    ai.dataVersion = 2; // e.g. a new release changed the generator
    await svc.getDataset('u1');
    expect(
      repos.audit.rows.find((r) => r.eventType === 'WORKSPACE_RESTORED').payload
        .matchesExpected,
    ).toBe(false);
    expect(repos.workspaces.rows[0].stateFingerprint).toContain('-v2-');

    ai.calls.length = 0;
    await svc.getDataset('u1');
    expect(ai.route()).toEqual(['GET /dataset']); // no repeated restore
  });

  it('a restore failure is reported instead of silently serving another dataset', async () => {
    const { svc, ai } = ctx;
    await svc.resetDemoData('u1', 'u1@x.com', 'synthetic');
    ai.coldStart();
    await ai.stop(); // the ai-service is down entirely
    await expect(svc.getDataset('u1')).rejects.toMatchObject({ status: 503 });
    ctx.ai = new FakeAiService(); // keep afterEach happy
    await ctx.ai.start();
  });
});

describe('normalizeServiceUrl', () => {
  it.each([
    [undefined, 'http://localhost:8000'],
    ['', 'http://localhost:8000'],
    ['http://localhost:8000', 'http://localhost:8000'],
    ['https://ai.example.com/', 'https://ai.example.com'],
    ['bizpulse-ai-service:10000', 'http://bizpulse-ai-service:10000'], // Render "hostport": no scheme
    ['  bizpulse-ai-service  ', 'http://bizpulse-ai-service'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeServiceUrl(input as any)).toBe(expected);
  });
});
