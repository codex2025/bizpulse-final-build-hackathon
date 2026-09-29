import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DecisionRun } from './entities/decision-run.entity';
import { DecisionApproval } from './entities/approval.entity';
import { DecisionAuditLog } from './entities/audit-log.entity';
import { DecisionPolicyConfig } from './entities/policy-config.entity';
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
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {
    this.aiUrl = this.config.get('AI_SERVICE_URL', 'http://localhost:8000');
  }

  async getDataset() {
    try {
      const res = await axios.get(`${this.aiUrl}/decision-forge/dataset`);
      return res.data;
    } catch (err: any) {
      this.logger.error(`Error getting dataset: ${err.message}`);
      throw new HttpException('AI service dataset error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async resetDemoData(userId: string, email: string) {
    try {
      const res = await axios.post(`${this.aiUrl}/decision-forge/reset-demo`);

      await this.auditRepo.save({
        eventType: 'DEMO_DATASET_LOADED',
        actorId: userId,
        actorEmail: email,
        payload: { message: 'Reset to verified B2B Industrial Machinery dataset' },
      });

      return res.data;
    } catch (err: any) {
      throw new HttpException('Failed to reset demo dataset', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async ingestFile(file: Express.Multer.File, userId: string, email: string) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', file.buffer, file.originalname);

    try {
      const res = await axios.post(`${this.aiUrl}/decision-forge/ingest/file`, form, {
        headers: form.getHeaders(),
      });

      await this.auditRepo.save({
        eventType: 'DATASET_UPLOADED',
        actorId: userId,
        actorEmail: email,
        payload: {
          filename: file.originalname,
          rows: res.data.total_rows,
          qualityScore: res.data.quality_report?.health_score,
        },
      });

      return res.data;
    } catch (err: any) {
      this.logger.error(`Ingest file error: ${err.message}`);
      throw new HttpException(err.response?.data?.detail || 'Failed to ingest file', HttpStatus.BAD_REQUEST);
    }
  }

  async applyMapping(records: any[], userId: string, email: string) {
    try {
      const res = await axios.post(`${this.aiUrl}/decision-forge/ingest/apply-mapping`, { records });

      await this.auditRepo.save({
        eventType: 'DATASET_ACTIVATED',
        actorId: userId,
        actorEmail: email,
        payload: {
          recordsCount: res.data.records_count,
          qualityScore: res.data.quality_score,
        },
      });

      return res.data;
    } catch (err: any) {
      this.logger.error(`Apply mapping error: ${err.message}`);
      throw new HttpException(err.response?.data?.detail || 'Failed to activate dataset', HttpStatus.BAD_REQUEST);
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

      const res = await axios.post(`${this.aiUrl}/decision-forge/decide/run`, body);
      const data = res.data;

      // Save run to SQLite
      const run = await this.runRepo.save({
        decisionRunId: data.decision_run_id,
        userId,
        policyVersion: data.policy_version,
        recordsAnalyzed: data.records_analyzed,
        pipelineTotalValue: data.pipeline_total_value,
        weightedPipelineValue: data.weighted_pipeline_value,
        highPriorityCount: data.high_priority_count,
        staleWarningCount: data.stale_warning_count,
        recommendations: data.recommendations,
      });

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
        },
      });

      return data;
    } catch (err: any) {
      this.logger.error(`Run decision error: ${err.message}`);
      throw new HttpException(err.response?.data?.detail || 'Failed to run decision engine', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async fetchExternalContext(opportunityId: string, userId: string, email: string) {
    try {
      const res = await axios.post(`${this.aiUrl}/decision-forge/opportunities/${opportunityId}/fetch-context`);

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
      throw new HttpException(err.response?.data?.detail || 'Failed to fetch external context', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async simulateTwin(inputs: any, userId: string) {
    try {
      const res = await axios.post(`${this.aiUrl}/decision-forge/twin/simulate`, inputs);

      await this.auditRepo.save({
        eventType: 'SIMULATION_RUN',
        actorId: userId,
        payload: {
          inputs,
          deltaRevenuePercent: res.data.delta_revenue_percent,
          utilization: res.data.rep_capacity_utilization_percent,
        },
      });

      return res.data;
    } catch (err: any) {
      throw new HttpException('Simulation failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async reviewAction(
    recId: string,
    action: 'APPROVED' | 'MODIFIED' | 'REJECTED',
    body: {
      opportunityId: string;
      companyName: string;
      dealValue: number;
      decisionRunId?: string;
      approvedAction?: string;
      reviewerNotes?: string;
    },
    userId: string,
    email: string,
  ) {
    const approval = await this.approvalRepo.save({
      recommendationId: recId,
      decisionRunId: body.decisionRunId || undefined,
      opportunityId: body.opportunityId,
      companyName: body.companyName,
      dealValue: body.dealValue,
      status: action,
      approvedAction: body.approvedAction || '',
      reviewerNotes: body.reviewerNotes || '',
      userId,
    });

    await this.auditRepo.save({
      eventType: `ACTION_${action}`,
      decisionRunId: body.decisionRunId,
      opportunityId: body.opportunityId,
      companyName: body.companyName,
      actorId: userId,
      actorEmail: email,
      payload: {
        recommendationId: recId,
        approvedAction: body.approvedAction,
        reviewerNotes: body.reviewerNotes,
        dealValue: body.dealValue,
      },
    });

    return approval;
  }

  async convertToClient(recId: string, body: any, userId: string, email: string) {
    // 1. Create client in Bizpulse Client Directory
    let client = await this.clientRepo.findOne({
      where: { name: body.companyName, user_id: userId },
    });

    if (!client) {
      client = await this.clientRepo.save({
        name: body.companyName,
        email: body.contactEmail || '',
        phone: body.contactPhone || '',
        address: body.location || '',
        // GST/KYC details are not fabricated -- they're unknown until the business
        // supplies them, and the placeholder makes that explicit in the UI.
        gst_number: 'PENDING VERIFICATION',
        user_id: userId,
      });
    }

    // Update approval record
    await this.approvalRepo.update({ recommendationId: recId }, {
      convertedClientId: client.id,
    });

    await this.auditRepo.save({
      eventType: 'CLIENT_CONVERTED',
      opportunityId: body.opportunityId,
      companyName: body.companyName,
      actorId: userId,
      actorEmail: email,
      payload: {
        clientId: client.id,
        clientName: client.name,
        dealValue: body.dealValue,
      },
    });

    return {
      status: 'success',
      clientId: client.id,
      clientName: client.name,
      dealValue: body.dealValue,
      message: `Successfully created client ${client.name} in Bizpulse!`,
    };
  }

  async getAuditLogs(userId: string) {
    return this.auditRepo.find({
      where: { actorId: userId },
      order: { timestamp: 'DESC' },
      take: 50,
    });
  }

  async getApprovals(userId: string) {
    return this.approvalRepo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async replayDecision(runId: string) {
    const run = await this.runRepo.findOne({ where: { decisionRunId: runId } });
    if (!run) {
      throw new HttpException('Decision run not found', HttpStatus.NOT_FOUND);
    }
    const auditEvents = await this.auditRepo.find({
      where: { decisionRunId: runId },
      order: { timestamp: 'ASC' },
    });
    const approvals = await this.approvalRepo.find({
      where: { decisionRunId: runId },
      order: { updatedAt: 'ASC' },
    });

    return {
      run,
      auditEvents,
      approvals,
    };
  }
}
