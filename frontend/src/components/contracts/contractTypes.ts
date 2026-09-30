export interface ContractClause {
  id?: string;
  clause_type: string;
  original_text: string;
  simple_explanation?: string;
  plain_explanation?: string;
  risk_level: 'High' | 'Medium' | 'Low' | string;
  is_red_flag?: boolean;
  red_flag_reason?: string | null;
  financial_impact?: string;
  actionable_tip?: string;
  source_page?: number;
  confidence?: string;
  confidence_reason?: string;
  financial_values?: Record<string, number | string>;
  matched_glossary_terms?: string[];
}

export interface ContractDecision {
  decision_type?: 'ACCEPT' | 'DECLINE' | 'RENEGOTIATE' | string;
  decision?: string;
  action_headline?: string;
  action_summary?: string;
  reasons?: string[];
  alternatives?: string[];
}

export interface ContractSimulation {
  loan_amount?: number;
  annual_interest_rate?: number;
  tenure_months?: number;
  monthly_emi?: number;
  total_repayment?: number;
  total_interest?: number;
  penalty_rate?: number;
  prepayment_penalty?: number;
}

export interface ContractLedgerImpact {
  avg_monthly_income?: number;
  avg_monthly_expense?: number;
  monthly_emi?: number;
  net_cash_flow_before?: number;
  net_cash_flow_after?: number;
  emi_to_income_ratio?: number;
  buffer_status?: string;
}

export interface ContractRedFlag {
  clause_name: string;
  severity: 'High' | 'Medium' | string;
  why_risky: string;
  mitigation_tip: string;
}

export interface CitedClause {
  page_number?: number;
  section_title?: string;
  text_snippet?: string;
}

export interface ContractQueryMessage {
  id?: string;
  question: string;
  answer: string;
  cited_clauses?: CitedClause[];
}

export interface ContractAnalysisData {
  id: string;
  document_name: string;
  analysis_status: 'processing' | 'completed' | 'failed' | string;
  created_at: string;
  chroma_collection_id?: string;
  total_chunks?: number;
  executive_summary?: string[];
  overall_risk_rating?: string;
  red_flags?: ContractRedFlag[];
  borrower_rights?: string[];
  clauses?: ContractClause[];
  simulation_results?: ContractSimulation;
  decision?: ContractDecision;
  ledger_impact?: ContractLedgerImpact;
  negotiation_tips?: string[];
}

export type ContractWorkflowStep = 'split' | 'extracted' | 'risk' | 'clauses' | 'evidence' | 'assistant';
