import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { DecisionRun } from './entities/decision-run.entity';
import { DecisionApproval, ApprovalStatus } from './entities/approval.entity';
import { DecisionAuditLog } from './entities/audit-log.entity';
import { DecisionPolicyConfig } from './entities/policy-config.entity';
import { DecisionQueryLog } from './entities/query-log.entity';
import { DecisionWorkspaceState } from './entities/workspace-state.entity';
import { Client } from '../clients/entities/client.entity';

const DEFAULT_POLICY = {
  dealValueWeight: 0.25,
  winProbabilityWeight: 0.2,
  engagementWeight: 0.2,
  recencyWeight: 0.15,
  intentExternalWeight: 0.2,
  highPriorityThreshold: 75.0,
  mediumPriorityThreshold: 55.0,
};

/** Approval state machine. APPROVED and REJECTED are terminal; MODIFIED may still be decided. */
const TRANSITIONS: Record<string, ApprovalStatus[]> = {
  DRAFT: ['REVIEW', 'APPROVED', 'REJECTED', 'MODIFIED'],
  PENDING: ['REVIEW', 'APPROVED', 'REJECTED', 'MODIFIED'],
  REVIEW: ['APPROVED', 'REJECTED', 'MODIFIED'],
  MODIFIED: ['APPROVED', 'REJECTED', 'MODIFIED'],
  APPROVED: [],
  REJECTED: [],
};
const FINAL_STATES: ApprovalStatus[] = ['APPROVED', 'REJECTED'];

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from] || []).includes(to as ApprovalStatus);
}

const MAX_NOTES = 2000;
const MAX_ACTION = 1000;
const MAX_QUESTION = 500;

function cleanText(value: any, max: number, field: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new HttpException(`${field} must be text.`, HttpStatus.BAD_REQUEST);
  }
  if (value.length > max) {
    throw new HttpException(`${field} is too long (limit ${max} characters).`, HttpStatus.BAD_REQUEST);
  }
  return value.trim();
}

/**
 * The ai-service address as configured. Hosting platforms hand out different shapes (Render's
 * `hostport` is `name:10000` with no scheme), so a missing scheme means plain http on a private
 * network; trailing slashes are dropped.
 */
export function normalizeServiceUrl(raw?: string): string {
  const value = (raw || '').trim().replace(/\/+$/, '');
  if (!value) return 'http://localhost:8000';
  return /^https?:\/\//i.test(value) ? value : `http://${value}`;
}

const RESTORE_REQUIRED = 'WORKSPACE_RESTORE_REQUIRED';

@Injectable()
export class DecisionForgeService {
  private readonly logger = new Logger(DecisionForgeService.name);
  private readonly aiUrl: string;

  constructor(
    private config: ConfigService,
    @InjectRepository(DecisionRun)
    private readonly runRepo: Repository<DecisionRun>,
    @InjectRepository(DecisionApproval)
    private readonly approvalRepo: Repository<DecisionApproval>,
    @InjectRepository(DecisionAuditLog)
    private readonly auditRepo: Repository<DecisionAuditLog>,
    @InjectRepository(DecisionPolicyConfig)
    private readonly policyRepo: Repository<DecisionPolicyConfig>,
    @InjectRepository(DecisionQueryLog)
    private readonly queryRepo: Repository<DecisionQueryLog>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(DecisionWorkspaceState)
    private readonly workspaceRepo: Repository<DecisionWorkspaceState>,
  ) {
    this.aiUrl = normalizeServiceUrl(this.config.get('AI_SERVICE_URL', 'http://localhost:8000'));
  }

  /**
   * HTTP client for the ai-service, bound to ONE workspace. The workspace id is the authenticated
   * user's id, so every dataset, RAG index and fetch state on the ai-service side is per user.
   */
  protected ai(userId: string): AxiosInstance {
    const client = axios.create({
      baseURL: `${this.aiUrl}/decision-forge`,
      timeout: 30000,
      headers: { 'X-Workspace-Id': userId, ...this.serviceHeaders() },
    });

    // Say which workspace state we expect the ai-service to hold (dataset, upload, fetched context).
    client.interceptors.request.use(async (cfg) => {
      const state = await this.getWorkspaceState(userId);
      if (state?.stateFingerprint) cfg.headers.set('X-Workspace-State', state.stateFingerprint);
      return cfg;
    });

    // A cold, restarted or different ai-service instance answers 409 rather than serving a default
    // dataset: rebuild the workspace from what we persisted, then retry the original call once.
    client.interceptors.response.use(undefined, async (err) => {
      const cfg = err?.config as (InternalAxiosRequestConfig & { restoreTried?: boolean }) | undefined;
      const code = err?.response?.data?.detail?.code;
      if (cfg && !cfg.restoreTried && err?.response?.status === 409 && code === RESTORE_REQUIRED) {
        cfg.restoreTried = true;
        await this.restoreWorkspace(userId);
        return client.request(cfg);
      }
      throw err;
    });
    return client;
  }

  // ---- recoverable workspace state ------------------------------------------------------------

  protected getWorkspaceState(userId: string) {
    return this.workspaceRepo.findOne({ where: { userId } });
  }

  /** Remembers what this user's ai-service workspace was built from (see workspace-state.entity.ts). */
  private async saveWorkspaceState(
    userId: string,
    next: { datasetKey: string; snapshotId?: string; stateFingerprint?: string; records: any[] | null; fetchedOpportunityIds: string[] },
  ) {
    if (!next.stateFingerprint) {
      // The ai-service did not describe its state, so nothing we could store would be checkable.
      await this.workspaceRepo.delete({ userId });
      return;
    }
    const existing = await this.getWorkspaceState(userId);
    if (existing) await this.workspaceRepo.update({ userId }, next);
    else await this.workspaceRepo.save({ userId, ...next });
  }

  /** Adds an opportunity whose external context was fetched, and adopts the ai-service's new fingerprint. */
  private async recordFetched(userId: string, opportunityId: string, view: any) {
    if (!view?.state_fingerprint) return;
    const existing = await this.getWorkspaceState(userId);
    if (existing) {
      const ids = Array.from(new Set([...(existing.fetchedOpportunityIds || []), opportunityId]));
      await this.workspaceRepo.update({ userId }, {
        fetchedOpportunityIds: ids, stateFingerprint: view.state_fingerprint, snapshotId: view.snapshot_id,
      });
    } else if (view.dataset_key && view.dataset_key !== 'custom') {
      // Default (never explicitly reset) preset workspace; an uploaded one cannot be rebuilt without its records.
      await this.workspaceRepo.save({
        userId, datasetKey: view.dataset_key, snapshotId: view.snapshot_id, stateFingerprint: view.state_fingerprint,
        records: null, fetchedOpportunityIds: [opportunityId],
      });
    }
  }

  private restoring = new Map<string, Promise<void>>();

  /**
   * Rebuilds the caller's workspace on the ai-service from the persisted state. Parallel requests that
   * all hit a cold instance share ONE restore. Nothing persisted means the ai-service default is right.
   */
  protected restoreWorkspace(userId: string): Promise<void> {
    const inflight = this.restoring.get(userId);
    if (inflight) return inflight;
    const job = (async () => {
      const state = await this.getWorkspaceState(userId);
      if (!state) return;
      const res = await axios.post(
        `${this.aiUrl}/decision-forge/workspace/restore`,
        {
          dataset_key: state.datasetKey,
          records: state.datasetKey === 'custom' ? state.records || [] : undefined,
          fetched_opportunity_ids: state.fetchedOpportunityIds || [],
          expected_state: state.stateFingerprint,
        },
        { timeout: 60000, headers: { 'X-Workspace-Id': userId, ...this.serviceHeaders() } },
      );
      const restored = res.data || {};
      if (restored.state_fingerprint && restored.state_fingerprint !== state.stateFingerprint) {
        // Rebuilt from the same inputs but the data differs from when it was saved (for example a new
        // release of a preset dataset). Adopt the new fingerprint so the mismatch is not repeated.
        await this.workspaceRepo.update({ userId }, {
          stateFingerprint: restored.state_fingerprint, snapshotId: restored.snapshot_id,
        });
      }
      await this.auditRepo.save({
        eventType: 'WORKSPACE_RESTORED',
        actorId: userId,
        payload: {
          datasetKey: state.datasetKey, snapshotId: restored.snapshot_id, matchesExpected: restored.matches_expected,
          uploadedRecords: state.datasetKey === 'custom' ? (state.records || []).length : 0,
          fetchedContext: (state.fetchedOpportunityIds || []).length,
        },
      });
    })().finally(() => this.restoring.delete(userId));
    this.restoring.set(userId, job);
    return job;
  }

  /** Shared secret proving the caller is this gateway (see ai-service security.py). Optional locally. */
  private serviceHeaders(): Record<string, string> {
    const token = this.config.get<string>('AI_SERVICE_TOKEN', '');
    return token ? { 'X-Internal-Token': token } : {};
  }

  private static readonly QUERY_LIMIT = 30;
  private static readonly QUERY_WINDOW_MS = 60_000;
  private queryHits = new Map<string, number[]>();

  /** Per-user sliding-window limit on questions (each one can run a full decision pass). */
  private checkQueryRate(userId: string): void {
    const now = Date.now();
    const recent = (this.queryHits.get(userId) || []).filter((t) => now - t < DecisionForgeService.QUERY_WINDOW_MS);
    if (recent.length >= DecisionForgeService.QUERY_LIMIT) {
      throw new HttpException('Too many questions. Please wait a moment and try again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.queryHits.set(userId, recent);
  }

  private aiError(err: any, fallback: string): HttpException {
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail;
    if (status && status >= 400 && status < 500 && typeof detail === 'string') {
      return new HttpException(detail, status);
    }
    if (!err?.response) {
      return new HttpException('The decision service is temporarily unavailable.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return new HttpException(typeof detail === 'string' ? detail : fallback, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  async getDataset(userId: string) {
    try {
      return (await this.ai(userId).get('/dataset')).data;
    } catch (err: any) {
      this.logger.error(`Error getting dataset: ${err.message}`);
      throw this.aiError(err, 'AI service dataset error');
    }
  }

  async getQuality(userId: string) {
    try {
      return (await this.ai(userId).get('/quality')).data;
    } catch (err: any) {
      throw this.aiError(err, 'Data quality report unavailable');
    }
  }

  async getDatasets() {
    try {
      return (await axios.get(`${this.aiUrl}/decision-forge/datasets`, { timeout: 10000, headers: this.serviceHeaders() })).data;
    } catch (err: any) {
      throw this.aiError(err, 'Dataset list unavailable');
    }
  }

  /**
   * Reloads a deterministic dataset into the caller's workspace. With `clearHistory` it also deletes
   * the caller's decision runs, approvals, query logs and saved policy versions (back to the default
   * policy) so a demo starts from a known state. The
   * audit log is never deleted: the reset itself is recorded in it.
   */
  async resetDemoData(userId: string, email: string, dataset?: string, clearHistory = false) {
    const key = dataset || 'real';
    try {
      const res = await this.ai(userId).post('/reset-demo', { dataset: key });
      await this.saveWorkspaceState(userId, {
        datasetKey: res.data.dataset_key || key,
        snapshotId: res.data.snapshot_id,
        stateFingerprint: res.data.state_fingerprint,
        records: null,
        fetchedOpportunityIds: [],
      });
      if (clearHistory) {
        await this.approvalRepo.delete({ userId });
        await this.queryRepo.delete({ userId });
        await this.runRepo.delete({ userId });
        await this.policyRepo.delete({ userId }); // getPolicy() recreates the default policy (v1) on next use
      }
      await this.auditRepo.save({
        eventType: clearHistory ? 'DEMO_RESET' : 'DEMO_DATASET_LOADED',
        actorId: userId,
        actorEmail: email,
        payload: { dataset: key, snapshotId: res.data.snapshot_id, count: res.data.count, historyCleared: clearHistory },
      });
      return res.data;
    } catch (err: any) {
      throw this.aiError(err, 'Failed to reset demo dataset');
    }
  }

  async ingestFile(file: Express.Multer.File, userId: string, email: string) {
    if (!file) {
      throw new HttpException('No file uploaded.', HttpStatus.BAD_REQUEST);
    }
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', file.buffer, file.originalname);

    try {
      const res = await this.ai(userId).post('/ingest/file', form, { headers: { ...form.getHeaders(), 'X-Workspace-Id': userId } });

      await this.auditRepo.save({
        eventType: 'DATASET_UPLOADED',
        actorId: userId,
        actorEmail: email,
        payload: { filename: file.originalname, rows: res.data.total_rows, validation: res.data.validation_report },
      });

      return res.data;
    } catch (err: any) {
      this.logger.error(`Ingest error: ${err.message}`);
      throw this.aiError(err, 'Failed to parse uploaded file');
    }
  }

  async applyMapping(records: any[], userId: string, email: string) {
    if (!Array.isArray(records) || records.length === 0) {
      throw new HttpException('No records provided to activate.', HttpStatus.BAD_REQUEST);
    }
    try {
      const res = await this.ai(userId).post('/ingest/apply-mapping', { records });
      await this.saveWorkspaceState(userId, {
        datasetKey: 'custom',
        snapshotId: res.data.snapshot_id,
        stateFingerprint: res.data.state_fingerprint,
        records,
        fetchedOpportunityIds: [],
      });

      await this.auditRepo.save({
        eventType: 'DATASET_ACTIVATED',
        actorId: userId,
        actorEmail: email,
        payload: { recordsCount: records.length, qualityScore: res.data.quality_score, snapshotId: res.data.snapshot_id },
      });

      return res.data;
    } catch (err: any) {
      throw this.aiError(err, 'Failed to activate mapped dataset');
    }
  }

  async getPolicy(userId: string) {
    let active = await this.policyRepo.findOne({
      where: { userId, isActive: true },
      order: { version: 'DESC' },
    });

    if (!active) {
      active = await this.policyRepo.save({ userId, version: 1, isActive: true, ...DEFAULT_POLICY });
    }

    const history = await this.policyRepo.find({ where: { userId }, order: { version: 'DESC' }, take: 10 });
    return { active, history };
  }

  async savePolicy(userId: string, email: string, body: any) {
    const weights = {
      dealValueWeight: Number(body.dealValueWeight ?? DEFAULT_POLICY.dealValueWeight),
      winProbabilityWeight: Number(body.winProbabilityWeight ?? DEFAULT_POLICY.winProbabilityWeight),
      engagementWeight: Number(body.engagementWeight ?? DEFAULT_POLICY.engagementWeight),
      recencyWeight: Number(body.recencyWeight ?? DEFAULT_POLICY.recencyWeight),
      intentExternalWeight: Number(body.intentExternalWeight ?? DEFAULT_POLICY.intentExternalWeight),
      highPriorityThreshold: Number(body.highPriorityThreshold ?? DEFAULT_POLICY.highPriorityThreshold),
      mediumPriorityThreshold: Number(body.mediumPriorityThreshold ?? DEFAULT_POLICY.mediumPriorityThreshold),
    };

    if (Object.values(weights).some((v) => !Number.isFinite(v) || v < 0)) {
      throw new HttpException('Policy values must be non-negative numbers.', HttpStatus.BAD_REQUEST);
    }

    const total =
      weights.dealValueWeight +
      weights.winProbabilityWeight +
      weights.engagementWeight +
      weights.recencyWeight +
      weights.intentExternalWeight;

    if (Math.abs(total - 1.0) > 0.02) {
      throw new HttpException(
        `Policy weights must sum to 1.00 (currently ${total.toFixed(2)}). Adjust the sliders and try again.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const previous = await this.policyRepo.findOne({ where: { userId, isActive: true }, order: { version: 'DESC' } });
    if (previous) {
      await this.policyRepo.update({ id: previous.id }, { isActive: false });
    }
    const nextVersion = (previous?.version || 0) + 1;

    const saved = await this.policyRepo.save({
      userId,
      version: nextVersion,
      isActive: true,
      ...weights,
    });

    await this.auditRepo.save({
      eventType: 'POLICY_SAVED',
      actorId: userId,
      actorEmail: email,
      payload: { version: `v${nextVersion}`, ...weights },
    });

    return saved;
  }

  private async persistRun(userId: string, data: any, recommendations: any[]) {
    return this.runRepo.save({
      decisionRunId: data.decision_run_id,
      userId,
      policyVersion: data.policy_version,
      recordsAnalyzed: data.records_analyzed,
      pipelineTotalValue: data.pipeline_total_value,
      weightedPipelineValue: data.weighted_pipeline_value,
      highPriorityCount: data.high_priority_count,
      staleWarningCount: data.stale_warning_count,
      recommendations,
      policySnapshot: data.policy || null,
      snapshotId: data.snapshot_id || null,
      datasetKey: data.dataset_key || null,
      dataSnapshot: data.data_snapshot || null,
    });
  }

  async runDecisionEngine(userId: string, email: string, policyOverride?: any) {
    try {
      const activePolicy = await this.getPolicy(userId);
      const p = activePolicy.active;
      const body = policyOverride && Object.keys(policyOverride).length
        ? policyOverride
        : {
            deal_value_weight: p.dealValueWeight,
            win_probability_weight: p.winProbabilityWeight,
            engagement_weight: p.engagementWeight,
            recency_weight: p.recencyWeight,
            intent_external_weight: p.intentExternalWeight,
            high_priority_threshold: p.highPriorityThreshold,
            medium_priority_threshold: p.mediumPriorityThreshold,
            policy_version: `v${p.version}`,
          };

      const res = await this.ai(userId).post('/decide/run', body);
      const data = res.data;

      await this.persistRun(userId, data, data.recommendations);

      await this.auditRepo.save({
        eventType: 'DECISION_GENERATED',
        decisionRunId: data.decision_run_id,
        actorId: userId,
        actorEmail: email,
        payload: {
          recommendationsCount: data.recommendations_count,
          highPriorityCount: data.high_priority_count,
          pipelineTotal: data.pipeline_total_value,
          dataSnapshot: data.data_snapshot,
          snapshotId: data.snapshot_id,
          policyVersion: data.policy_version,
        },
      });

      return data;
    } catch (err: any) {
      this.logger.error(`Run decision error: ${err.message}`);
      throw this.aiError(err, 'Failed to run decision engine');
    }
  }

  /** Natural-language question -> plan -> analytics -> RAG -> answer. The whole trail is stored for replay. */
  async queryDecision(question: any, userId: string, email: string, preset?: string) {
    const q = cleanText(question, MAX_QUESTION, 'Question');
    if (!q) {
      throw new HttpException('A question is required.', HttpStatus.BAD_REQUEST);
    }
    this.checkQueryRate(userId);
    try {
      const res = await this.ai(userId).post('/decisions/query', { question: q, preset });
      const data = res.data;

      let runId: string | null = data.decision_run_id || null;
      if (runId && data.run_summary) {
        await this.persistRun(userId, { ...data.run_summary, decision_run_id: runId, snapshot_id: data.snapshot_id,
          dataset_key: data.dataset_key, data_snapshot: data.data_snapshot }, data.recommendations || []);
      }
      const log = await this.queryRepo.save({
        userId,
        decisionRunId: runId || undefined,
        question: q,
        plan: data.plan,
        answer: data.answer,
        analytics: data.analytics,
        rag: { status: data.rag?.status, message: data.rag?.message, evidence: (data.rag?.evidence || []).slice(0, 20) },
        trace: data.trace,
        policyVersion: data.policy_version || undefined,
        snapshotId: data.snapshot_id,
        datasetKey: data.dataset_key,
        confidence: data.confidence,
      });
      await this.auditRepo.save({
        eventType: 'QUERY_RUN',
        decisionRunId: runId || undefined,
        actorId: userId,
        actorEmail: email,
        payload: { intent: data.intent, planner: data.plan?.planner, tools: data.plan?.analytics_tools, confidence: data.confidence },
      });
      if (data.scenario?.simulation) {
        // A what-if asked in words is a simulation like a slider run: record its parameters and result the same way.
        const sim = data.scenario.simulation;
        const levers = (data.scenario.levers || []).map((l: any) => ({ lever: l.lever, baseline: l.baseline, scenario: l.scenario, note: l.note }));
        const delta = sim.delta_revenue_percent;
        await this.auditRepo.save({
          eventType: 'SIMULATION_RUN',
          actorId: userId,
          actorEmail: email,
          payload: {
            source: 'question',
            question: q,
            inputs: data.scenario.scenario_params,
            baseline: data.scenario.baseline_params,
            levers,
            deltaRevenuePercent: delta,
            utilization: sim.rep_capacity_utilization_percent,
            simulationId: sim.simulation_id,
            message: `What-if question: ${(data.scenario.levers || []).map((l: any) => `${l.label} ${l.baseline} -> ${l.scenario}`).join(', ')} `
              + `(expected value ${delta >= 0 ? '+' : ''}${delta}% vs baseline)`,
          },
        });
      }
      return { ...data, query_log_id: log.id };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Query error: ${err.message}`);
      throw this.aiError(err, 'Failed to answer the question');
    }
  }

  async fetchExternalContext(opportunityId: string, userId: string, email: string) {
    try {
      const res = await this.ai(userId).post(`/opportunities/${encodeURIComponent(opportunityId)}/fetch-context`);
      if (res.data?.status === 'fetched') await this.recordFetched(userId, opportunityId, res.data);

      await this.auditRepo.save({
        eventType: 'EXTERNAL_CONTEXT_FETCHED',
        opportunityId,
        actorId: userId,
        actorEmail: email,
        payload: { status: res.data.status, message: res.data.message },
      });

      return res.data;
    } catch (err: any) {
      this.logger.error(`Fetch external context error: ${err.message}`);
      // External context is optional: report it as unavailable instead of failing the decision.
      if (!err?.response || err.response.status >= 500) {
        return {
          status: 'unavailable',
          message: 'External context unavailable. Decision calculated from internal business data.',
          signal: null,
        };
      }
      throw this.aiError(err, 'Failed to fetch external context');
    }
  }

  async simulateTwin(inputs: any, userId: string) {
    try {
      const res = await this.ai(userId).post('/twin/simulate', inputs);

      await this.auditRepo.save({
        eventType: 'SIMULATION_RUN',
        actorId: userId,
        payload: {
          inputs,
          deltaRevenuePercent: res.data.delta_revenue_percent,
          utilization: res.data.rep_capacity_utilization_percent,
          simulationId: res.data.simulation_id,
        },
      });

      return res.data;
    } catch (err: any) {
      throw this.aiError(err, 'Simulation failed');
    }
  }

  // ---- human approval -----------------------------------------------------------------

  /** The recommendation must exist in a run owned by THIS user; anything else looks like "not found". */
  private async requireOwnedRecommendation(userId: string, recId: string, decisionRunId?: string) {
    const runId = decisionRunId || /^REC-(DR-[A-Z0-9]+)-/.exec(recId || '')?.[1];
    const run = runId ? await this.runRepo.findOne({ where: { decisionRunId: runId, userId } }) : null;
    const rec = run?.recommendations?.find((r: any) => r.recommendation_id === recId);
    if (!run || !rec) {
      throw new HttpException('Recommendation not found.', HttpStatus.NOT_FOUND);
    }
    return { run, rec };
  }

  private async getOrCreateApproval(userId: string, recId: string, run: DecisionRun, rec: any) {
    const existing = await this.approvalRepo.findOne({ where: { recommendationId: recId, userId } });
    if (existing) return existing;
    return this.approvalRepo.save({
      recommendationId: recId,
      decisionRunId: run.decisionRunId,
      opportunityId: rec.opportunity_id,
      companyName: rec.company_name,
      dealValue: rec.deal_value,
      status: 'DRAFT',
      approvedAction: '',
      reviewerNotes: '',
      userId,
      policyVersion: run.policyVersion,
      snapshotId: run.snapshotId || undefined,
      priorityScore: rec.priority_score,
      confidence: rec.confidence,
      // Frozen copy of exactly what the reviewer is shown.
      evidenceSnapshot: {
        priority_score: rec.priority_score,
        decision_class: rec.decision_class,
        factors: rec.factors,
        evidence_pack: rec.evidence_pack,
        warnings: rec.warnings,
        suggested_action: rec.suggested_action,
        data_snapshot: run.dataSnapshot,
      },
      statusHistory: [],
    });
  }

  private async transition(approval: DecisionApproval, to: ApprovalStatus, userId: string, patch: Partial<DecisionApproval> = {}) {
    if (!canTransition(approval.status, to)) {
      throw new HttpException(
        `This recommendation is already ${approval.status} and cannot move to ${to}.`,
        HttpStatus.CONFLICT,
      );
    }
    const history = [...(approval.statusHistory || []), { from: approval.status, to, at: new Date().toISOString(), by: userId }];
    await this.approvalRepo.update({ id: approval.id }, { ...patch, status: to, statusHistory: history });
    return this.approvalRepo.findOne({ where: { id: approval.id } });
  }

  async startReview(recId: string, body: any, userId: string, email: string) {
    const { run, rec } = await this.requireOwnedRecommendation(userId, recId, body?.decisionRunId);
    const approval = await this.getOrCreateApproval(userId, recId, run, rec);
    const updated = approval.status === 'REVIEW' ? approval : await this.transition(approval, 'REVIEW', userId);
    await this.auditRepo.save({
      eventType: 'REVIEW_STARTED', decisionRunId: run.decisionRunId, opportunityId: rec.opportunity_id,
      companyName: rec.company_name, actorId: userId, actorEmail: email, payload: { recommendationId: recId },
    });
    return updated;
  }

  async reviewAction(
    recId: string,
    action: 'APPROVED' | 'MODIFIED' | 'REJECTED',
    body: { decisionRunId?: string; approvedAction?: string; reviewerNotes?: string } & Record<string, any>,
    userId: string,
    email: string,
  ) {
    // Only the recommendation id and the reviewer's own words come from the request. Company,
    // deal value and opportunity are read from the stored run -- a client cannot rewrite them.
    const approvedAction = cleanText(body?.approvedAction, MAX_ACTION, 'Action');
    const reviewerNotes = cleanText(body?.reviewerNotes, MAX_NOTES, 'Comment');
    if (action === 'MODIFIED' && !approvedAction) {
      throw new HttpException('Describe the modified action before saving.', HttpStatus.BAD_REQUEST);
    }

    const { run, rec } = await this.requireOwnedRecommendation(userId, recId, body?.decisionRunId);
    const approval = await this.getOrCreateApproval(userId, recId, run, rec);
    const updated = await this.transition(approval, action, userId, {
      approvedAction: approvedAction || rec.suggested_action || '',
      reviewerNotes,
    });

    await this.auditRepo.save({
      eventType: `ACTION_${action}`,
      decisionRunId: run.decisionRunId,
      opportunityId: rec.opportunity_id,
      companyName: rec.company_name,
      actorId: userId,
      actorEmail: email,
      payload: {
        recommendationId: recId,
        approvedAction: updated?.approvedAction,
        reviewerNotes,
        dealValue: rec.deal_value,
        policyVersion: run.policyVersion,
        snapshotId: run.snapshotId,
        priorityScore: rec.priority_score,
        from: approval.status,
        to: action,
      },
    });

    return updated;
  }

  async convertToClient(recId: string, body: any, userId: string, email: string) {
    const approval = await this.approvalRepo.findOne({ where: { recommendationId: recId, userId } });
    if (!approval) {
      throw new HttpException('Recommendation not found.', HttpStatus.NOT_FOUND);
    }
    if (approval.status !== 'APPROVED' && approval.status !== 'MODIFIED') {
      throw new HttpException('Only an approved (or modified) recommendation can be converted to a client.', HttpStatus.CONFLICT);
    }
    const companyName = approval.companyName;

    let client = await this.clientRepo.findOne({ where: { name: companyName, user_id: userId } });
    if (!client) {
      client = await this.clientRepo.save({
        name: companyName,
        email: cleanText(body?.contactEmail, 200, 'Email'),
        phone: cleanText(body?.contactPhone, 50, 'Phone'),
        address: cleanText(body?.location, 300, 'Location'),
        // GST/KYC details are not fabricated -- they're unknown until the business
        // supplies them, and the placeholder makes that explicit in the UI.
        gst_number: 'PENDING VERIFICATION',
        user_id: userId,
      });
    }

    await this.approvalRepo.update({ id: approval.id }, { convertedClientId: client.id });

    await this.auditRepo.save({
      eventType: 'CLIENT_CONVERTED',
      opportunityId: approval.opportunityId,
      companyName,
      actorId: userId,
      actorEmail: email,
      payload: { clientId: client.id, clientName: client.name, dealValue: approval.dealValue },
    });

    return {
      status: 'success',
      clientId: client.id,
      clientName: client.name,
      dealValue: approval.dealValue,
      message: `Successfully created client ${client.name} in Bizpulse!`,
    };
  }

  async getAuditLogs(userId: string) {
    return this.auditRepo.find({ where: { actorId: userId }, order: { timestamp: 'DESC' }, take: 50 });
  }

  async getApprovals(userId: string) {
    return this.approvalRepo.find({ where: { userId }, order: { updatedAt: 'DESC' } });
  }

  // ---- decisions, evidence, replay ------------------------------------------------------

  async listDecisions(userId: string) {
    const runs = await this.runRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 20 });
    return runs.map((r) => ({
      decisionRunId: r.decisionRunId,
      policyVersion: r.policyVersion,
      datasetKey: r.datasetKey,
      snapshotId: r.snapshotId,
      recordsAnalyzed: r.recordsAnalyzed,
      highPriorityCount: r.highPriorityCount,
      staleWarningCount: r.staleWarningCount,
      createdAt: r.createdAt,
    }));
  }

  private async requireOwnedRun(runId: string, userId: string) {
    const run = await this.runRepo.findOne({ where: { decisionRunId: runId, userId } });
    if (!run) {
      throw new HttpException('Decision run not found', HttpStatus.NOT_FOUND);
    }
    return run;
  }

  async getEvidence(runId: string, userId: string, opportunityId?: string) {
    const run = await this.requireOwnedRun(runId, userId);
    const recs = (run.recommendations || []).filter((r: any) => !opportunityId || r.opportunity_id === opportunityId);
    return {
      decisionRunId: run.decisionRunId,
      snapshotId: run.snapshotId,
      policyVersion: run.policyVersion,
      dataSnapshot: run.dataSnapshot,
      evidence: recs.map((r: any) => ({
        recommendationId: r.recommendation_id,
        opportunityId: r.opportunity_id,
        companyName: r.company_name,
        priorityScore: r.priority_score,
        factors: r.factors,
        evidencePack: r.evidence_pack,
        warnings: r.warnings,
        confidence: r.confidence,
      })),
    };
  }

  /** Ordered, inspectable trail: question -> plan -> data snapshot -> analytics -> RAG -> evidence -> policy -> score -> recommendation -> approval. */
  async replayDecision(runId: string, userId: string) {
    const run = await this.requireOwnedRun(runId, userId);
    const auditEvents = await this.auditRepo.find({ where: { decisionRunId: runId, actorId: userId }, order: { timestamp: 'ASC' } });
    const approvals = await this.approvalRepo.find({ where: { decisionRunId: runId, userId }, order: { updatedAt: 'ASC' } });
    const queries = await this.queryRepo.find({ where: { decisionRunId: runId, userId }, order: { createdAt: 'ASC' } });

    const q = queries[0];
    const top = (run.recommendations || []).slice(0, 3);
    const replay = [
      { step: 'question', detail: q ? { question: q.question } : { question: null, note: 'Run started from the Decision Center, not a typed question.' } },
      { step: 'query_plan', detail: q?.plan ?? null },
      { step: 'data_snapshot', detail: { snapshotId: run.snapshotId, datasetKey: run.datasetKey, dataSnapshot: run.dataSnapshot, recordsAnalyzed: run.recordsAnalyzed } },
      { step: 'analytics', detail: q?.analytics ?? { pipelineTotal: run.pipelineTotalValue, weightedExpectedValue: run.weightedPipelineValue } },
      { step: 'rag_results', detail: q?.rag ?? { notes: top.map((r: any) => ({ opportunityId: r.opportunity_id, notes: r.evidence_pack?.rag_notes })) } },
      { step: 'evidence', detail: top.map((r: any) => ({ opportunityId: r.opportunity_id, evidencePack: r.evidence_pack })) },
      { step: 'policy', detail: { policyVersion: run.policyVersion, policy: run.policySnapshot } },
      { step: 'score', detail: top.map((r: any) => ({ opportunityId: r.opportunity_id, priorityScore: r.priority_score, factors: r.factors })) },
      { step: 'recommendation', detail: top.map((r: any) => ({ opportunityId: r.opportunity_id, decisionClass: r.decision_class, action: r.suggested_action, confidence: r.confidence })) },
      { step: 'approval', detail: approvals.map((a) => ({ opportunityId: a.opportunityId, status: a.status, notes: a.reviewerNotes, history: a.statusHistory })) },
    ];

    return { run, auditEvents, approvals, queries, replay };
  }

  // ---- dashboard summary ----------------------------------------------------------------

  async getSummary(userId: string, email: string) {
    let run = await this.runRepo.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
    // Use the newest run that contains every recommendation (query runs keep only the top 10).
    const runs = await this.runRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 10 });
    run = runs.find((r) => (r.recommendations || []).length >= (r.recordsAnalyzed || 0) && r.recordsAnalyzed > 0) || null;
    if (!run) {
      try {
        await this.runDecisionEngine(userId, email);
        run = await this.runRepo.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
      } catch {
        return { hasRun: false, message: 'Decision service unavailable.' };
      }
    }
    if (!run) return { hasRun: false };

    const approvals = await this.approvalRepo.find({ where: { userId, decisionRunId: run.decisionRunId } });
    const finalIds = new Set(approvals.filter((a) => FINAL_STATES.includes(a.status)).map((a) => a.recommendationId));
    const recs: any[] = run.recommendations || [];
    const open = recs.filter((r) => !finalIds.has(r.recommendation_id));
    const immediate = open.filter((r) => r.decision_class === 'IMMEDIATE_ACTION');
    const stale = open.filter((r) => r.stale_data_warning);
    const review = open.filter((r) => r.review_required);
    const attention = new Set([...immediate, ...stale, ...review].map((r) => r.recommendation_id));
    const awaiting = approvals.filter((a) => ['DRAFT', 'REVIEW', 'MODIFIED', 'PENDING'].includes(a.status)).length;

    return {
      hasRun: true,
      decisionRunId: run.decisionRunId,
      datasetKey: run.datasetKey,
      policyVersion: run.policyVersion,
      immediateActions: immediate.length,
      staleOpportunities: stale.length,
      reviewRequired: review.length,
      awaitingApproval: awaiting,
      requiresAttention: attention.size,
      pipelineTotal: run.pipelineTotalValue,
      weightedExpectedValue: run.weightedPipelineValue,
      generatedAt: run.createdAt,
    };
  }
}
