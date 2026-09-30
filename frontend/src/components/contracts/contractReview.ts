import type { ContractClause } from './contractTypes';

// Deterministic helpers for the master-detail review. Nothing here calls a model: every figure is computed
// from the clauses the analysis already extracted, and the formula is shown to the user.

export type RiskBand = 'critical' | 'moderate' | 'standard';

export const bandOf = (c: Pick<ContractClause, 'risk_level' | 'is_red_flag'>): RiskBand => {
  if (c.risk_level === 'High' || c.is_red_flag) return 'critical';
  if (c.risk_level === 'Medium') return 'moderate';
  return 'standard';
};

/** Weighted share of risk: a critical clause counts 2, a moderate clause 1, a standard clause 0. Range 0-100. */
export function contractRiskScore(clauses: ContractClause[]): number {
  if (clauses.length === 0) return 0;
  const points = clauses.reduce((sum, c) => {
    const b = bandOf(c);
    return sum + (b === 'critical' ? 2 : b === 'moderate' ? 1 : 0);
  }, 0);
  return Math.round((points / (2 * clauses.length)) * 100);
}

export const RISK_SCORE_FORMULA = 'Risk score = 100 × (2 × critical + 1 × moderate) ÷ (2 × total clauses)';

export function riskLabel(score: number): 'Low' | 'Moderate' | 'Elevated' | 'High' {
  return score >= 60 ? 'High' : score >= 40 ? 'Elevated' : score >= 20 ? 'Moderate' : 'Low';
}

export function bandCounts(clauses: ContractClause[]): Record<RiskBand, number> {
  const out: Record<RiskBand, number> = { critical: 0, moderate: 0, standard: 0 };
  for (const c of clauses) out[bandOf(c)]++;
  return out;
}

const textOf = (c: ContractClause) => `${c.clause_type} ${c.original_text || ''}`;

/** The governing-law wording as written in the document, or null when it is not stated. */
export function findJurisdiction(clauses: ContractClause[]): string | null {
  for (const c of clauses) {
    const t = textOf(c);
    const m =
      t.match(/governed\s+by\s+(?:and\s+construed\s+in\s+accordance\s+with\s+)?(?:the\s+)?laws?\s+of\s+(?:the\s+)?([A-Z][A-Za-z.\s]{2,40}?)(?=[,.;]|\s+and\b|\s+without\b|\s+including\b|$)/i) ||
      t.match(/jurisdiction\s+of\s+(?:the\s+)?courts?\s+(?:at|in|of)\s+([A-Z][A-Za-z.\s]{2,30}?)(?=[,.;]|$)/i);
    if (m) return m[1].trim();
  }
  return null;
}

/** A stated liability cap (for example "shall not exceed ₹X"), or null. */
export function findLiabilityCap(clauses: ContractClause[]): string | null {
  for (const c of clauses) {
    if (!/liabilit|indemn/i.test(textOf(c))) continue;
    const m = (c.original_text || '').match(/(?:not\s+exceed|limited\s+to|capped\s+at)\s+((?:₹|Rs\.?|INR|\$)\s?[\d,]+(?:\.\d+)?(?:\s?(?:lakh|crore|million))?|\d+\s?%[^.,;]{0,40})/i);
    if (m) return m[1].trim();
  }
  return null;
}

export type ObligationKind = 'Penalty' | 'Interest' | 'Fee' | 'SLA / milestone' | 'Confidentiality';

const OBLIGATION_RULES: { kind: ObligationKind; test: RegExp }[] = [
  { kind: 'Penalty', test: /penalt|default|late\s+payment|liquidated/i },
  { kind: 'Interest', test: /interest|rate\s+of/i },
  { kind: 'Fee', test: /fee|charge|prepay|foreclos/i },
  { kind: 'SLA / milestone', test: /sla|service\s+level|uptime|milestone|deliverable|delivery/i },
  { kind: 'Confidentiality', test: /confidential|non-?disclosure|nda/i },
];

export interface Obligation {
  kind: ObligationKind;
  clause: string;
  impact: string;
  band: RiskBand;
}

/** Clauses that carry a money or service commitment, classified by the first rule that matches. */
export function extractObligations(clauses: ContractClause[]): Obligation[] {
  const rows: Obligation[] = [];
  for (const c of clauses) {
    const rule = OBLIGATION_RULES.find((r) => r.test.test(textOf(c)));
    if (!rule) continue;
    rows.push({
      kind: rule.kind,
      clause: c.clause_type,
      impact: c.financial_impact || (c.original_text || '').slice(0, 120) || '—',
      band: bandOf(c),
    });
  }
  return rows;
}

/** Splits text around case-insensitive matches of `term` so the viewer can highlight them without innerHTML. */
export function splitForHighlight(text: string, term: string): { text: string; hit: boolean }[] {
  const t = term.trim();
  if (!t) return [{ text, hit: false }];
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .split(new RegExp(`(${escaped})`, 'ig'))
    .filter((s) => s !== '')
    .map((s) => ({ text: s, hit: s.toLowerCase() === t.toLowerCase() }));
}
