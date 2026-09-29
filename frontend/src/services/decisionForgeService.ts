import api from './api';

export interface DecisionFactor {
  name: string;
  raw_value: any;
  score: number;
  weight: number;
  weighted_contribution: number;
  description: string;
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
    external_signal?: {
      title: string;
      source: string;
      url: string;
      published_at?: string;
      retrieved_at: string;
      freshness_status: string;
      source_type?: string;
      impact_summary: string;
    };
  };
  suggested_action: string;
  action_email_draft?: string;
  stale_data_warning?: string;
  external_context_available: boolean;
  external_context_fetched: boolean;
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
}

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

  async resetDemoData() {
    const res = await api.post('/decision-forge/reset-demo');
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
    return res.data as { status: 'fetched' | 'no_signal'; message: string; signal: any };
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
