import api from './api';

export interface DecisionFactor {
  name: string;
  raw_value: any;
  score: number;
  weight: number;
  weighted_contribution: number;
  description: string;
}

export interface ProvenanceEntry {
  claim: string;
  publisher: string;
  url: string;
  published_date: string;
  retrieved_date?: string;
}

export interface RecommendationItem {
  recommendation_id: string;
  decision_run_id: string;
  opportunity_id: string;
  company_name: string;
  contact_name: string;
  contact_email?: string;
  industry: string;
  deal_value: number;
  stage: string;
  win_probability: number;
  priority_score: number;
  decision_class: 'IMMEDIATE_ACTION' | 'PROCEED_WITH_QUALIFICATION' | 'NURTURE_MONITOR';
  badge_color: 'emerald' | 'amber' | 'slate';
  factors: DecisionFactor[];
  evidence_pack: {
    structured_data: Record<string, any>;
    rag_notes: Array<{ snippet: string; company_name: string }>;
    /** Facts traceable to a cited URL (real-dataset records only). */
    sourced_facts?: Record<string, string | number>;
    /** Per-field reasoning for each analyst estimate, keyed by field name. */
    modeled_basis?: Record<string, string>;
    /** 'sourced' | 'estimated' for the real dataset; 'record' for legacy flat data. */
    field_origin?: Record<string, 'sourced' | 'estimated' | 'record'>;
    provenance?: ProvenanceEntry[];
    labels?: Record<string, string>;
    data_quality?: { issues: any[]; penalty_points: number; confidence: number };
    buying_intent?: { score: number; strong: any[]; medium: any[]; negative: any[]; definition: string };
    external_signal?: {
      title: string;
      source: string;
      url?: string | null;
      published_at?: string;
      retrieved_at: string;
      freshness_status: string;
      source_type?: string;
      impact_summary: string;
      relevance_score?: number;
      relevance_basis?: string | null;
    };
  };
  suggested_action: string;
  action_email_draft?: string;
  stale_data_warning?: string;
  external_context_available: boolean;
  external_context_fetched: boolean;
  confidence?: number;
  review_required?: boolean;
  warnings?: string[];
  data_quality_issues?: Array<{ issue_type: string; severity: string; details: string }>;
}

export interface DecisionRunData {
  decision_run_id: string;
  policy_version: string;
  data_snapshot: string;
  records_analyzed: number;
  recommendations_count: number;
  pipeline_total_value: number;
  weighted_pipeline_value: number;
  high_priority_count: number;
  stale_warning_count: number;
  recommendations: RecommendationItem[];
  generated_at: string;
  dataset_key?: string;
  snapshot_id?: string;
  policy?: Record<string, any>;
}

export interface SimulationParams {
  contacts_per_day: number;
  min_deal_value: number;
  sales_reps_count: number;
  followup_window_days: number;
  priority_threshold?: number;
}

export interface SimulationResult {
  simulation_id: string;
  baseline_expected_value: number;
  scenario_expected_value: number;
  delta_revenue_percent: number;
  rep_capacity_utilization_percent: number;
  capacity_warning?: string;
  expected_closed_deals: number;
  comparisons: Array<{
    parameter: string;
    baseline: any;
    scenario: any;
    delta: any;
    unit: string;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
  uncertainty_band_percent: number;
  disclaimer: string;
  label?: string;
  assumptions?: string[];
  opportunities_total?: number;
  opportunities_in_scope?: number;
  opportunities_covered?: number;
  opportunities_missed?: number;
  missed_expected_value?: number;
  excluded_invalid_records?: number;
  scenario_expected_value_no_assumptions?: number;
  baseline_params?: Record<string, number>;
  scenario_params?: Record<string, number>;
  full_pipeline_expected_value?: number;
}

/** One lever a what-if question changed, with the arithmetic that produced it ("4 baseline + 2"). */
export interface ScenarioLever {
  lever: string;
  label: string;
  mode: string;
  requested: number;
  unit: string;
  baseline: number;
  scenario: number;
  note: string;
}

/** Present only for what-if questions (intent scenario_simulation). `simulation` is null when nothing was run. */
export interface ScenarioPayload {
  recognized: boolean;
  levers: ScenarioLever[];
  problems: string[];
  unsupported: string[];
  notes: string[];
  baseline_params: Record<string, number>;
  scenario_params: Record<string, number> | null;
  simulation: SimulationResult | null;
}

export interface QueryResult {
  question: string;
  answer: string;
  intent: string;
  confidence: number;
  human_review_required: boolean;
  plan: { intent: string; planner: string; planner_error?: string | null; analytics_tools: string[]; rag_required: boolean; decision_run_required: boolean };
  matched_ids: string[];
  analytics: Array<{ tool: string; definition: string; timestamp: string; source: any }>;
  rag: { status: string; message?: string; evidence: Array<{ doc_id: string; record_id: string; source_type: string; text: string; relevance: number | null; company_name?: string }> };
  warnings: string[];
  fallbacks: string[];
  trace: Array<{ step: string; latency_ms: number }>;
  snapshot_id: string;
  data_snapshot: string;
  decision_run_id?: string | null;
  policy_version?: string | null;
  basis: string;
  scenario?: ScenarioPayload | null;
}

export interface DecisionSummary {
  hasRun: boolean;
  decisionRunId?: string;
  datasetKey?: string;
  policyVersion?: string;
  immediateActions?: number;
  staleOpportunities?: number;
  reviewRequired?: number;
  awaitingApproval?: number;
  requiresAttention?: number;
  pipelineTotal?: number;
  weightedExpectedValue?: number;
  message?: string;
}

export type DatasetKey = 'real' | 'synthetic' | 'legacy';

export interface DecisionPolicy {
  id: string;
  version: number;
  isActive: boolean;
  dealValueWeight: number;
  winProbabilityWeight: number;
  engagementWeight: number;
  recencyWeight: number;
  intentExternalWeight: number;
  highPriorityThreshold: number;
  mediumPriorityThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export const decisionForgeService = {
  async getDataset() {
    const res = await api.get('/decision-forge/dataset');
    return res.data;
  },

  async resetDemoData(dataset: DatasetKey = 'real', clearHistory = false) {
    const res = await api.post('/decision-forge/reset-demo', { dataset, clearHistory });
    return res.data;
  },

  async getQuality() {
    const res = await api.get('/decision-forge/quality');
    return res.data;
  },

  async getSummary(): Promise<DecisionSummary> {
    const res = await api.get('/decision-forge/summary');
    return res.data;
  },

  async queryDecision(question: string): Promise<QueryResult> {
    const res = await api.post('/decision-forge/decisions/query', { question });
    return res.data;
  },

  async startReview(id: string, decisionRunId?: string) {
    const res = await api.post(`/decision-forge/recommendations/${id}/review`, { decisionRunId });
    return res.data;
  },

  async uploadCsv(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/decision-forge/ingest/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async applyMapping(records: any[]) {
    const res = await api.post('/decision-forge/ingest/apply-mapping', { records });
    return res.data;
  },

  async getPolicy(): Promise<{ active: DecisionPolicy; history: DecisionPolicy[] }> {
    const res = await api.get('/decision-forge/policy');
    return res.data;
  },

  async savePolicy(weights: Partial<DecisionPolicy>): Promise<DecisionPolicy> {
    const res = await api.post('/decision-forge/policy', weights);
    return res.data;
  },

  async runDecisions(policyOverrides?: any): Promise<DecisionRunData> {
    const res = await api.post('/decision-forge/decide/run', policyOverrides || {});
    return res.data;
  },

  async fetchExternalContext(opportunityId: string) {
    const res = await api.post(`/decision-forge/opportunities/${opportunityId}/fetch-context`);
    return res.data as { status: 'fetched' | 'no_signal' | 'unavailable'; message: string; signal: any };
  },

  async simulateTwin(inputs: SimulationParams): Promise<SimulationResult> {
    const res = await api.post('/decision-forge/twin/simulate', inputs);
    return res.data;
  },

  async approveRecommendation(id: string, payload: any) {
    const res = await api.post(`/decision-forge/recommendations/${id}/approve`, payload);
    return res.data;
  },

  async modifyRecommendation(id: string, payload: any) {
    const res = await api.post(`/decision-forge/recommendations/${id}/modify`, payload);
    return res.data;
  },

  async rejectRecommendation(id: string, payload: any) {
    const res = await api.post(`/decision-forge/recommendations/${id}/reject`, payload);
    return res.data;
  },

  async convertToClient(id: string, payload: any) {
    const res = await api.post(`/decision-forge/recommendations/${id}/convert-to-client`, payload);
    return res.data;
  },

  async getAuditLogs() {
    const res = await api.get('/decision-forge/audit');
    return res.data;
  },

  async getApprovals() {
    const res = await api.get('/decision-forge/approvals');
    return res.data;
  },

  async replayDecision(runId: string) {
    const res = await api.get(`/decision-forge/replay/${runId}`);
    return res.data;
  },
};
