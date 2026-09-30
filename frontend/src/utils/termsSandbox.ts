// Deterministic "commercial terms" what-if on a pipeline's expected value.
//
// Stated assumptions (shown in the UI): revenue is the pipeline's probability-weighted value; a discount
// reduces price one-for-one with NO assumed volume uplift; the default probability is the share of invoiced
// value never collected; waiting for payment costs an annual cost of capital, pro-rated by credit days.

export interface TermsInput {
  /** Probability-weighted pipeline value (already expected value, in currency units). */
  revenue: number;
  /** Discount offered, percent 0-30. */
  discountPct: number;
  /** Payment terms in days, 15-90. */
  creditDays: number;
  /** Probability an invoice is never collected, percent 0-20. */
  defaultPct: number;
  /** Annual cost of capital, percent. */
  costOfCapitalPct?: number;
}

export interface TermsOutcome {
  gross: number;
  discount: number;
  defaultLoss: number;
  financingCost: number;
  net: number;
}

export const BASELINE_TERMS = { discountPct: 0, creditDays: 30, defaultPct: 2 } as const;
export const DEFAULT_COST_OF_CAPITAL_PCT = 12;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

export function evaluateTerms(input: TermsInput): TermsOutcome {
  const revenue = Math.max(0, input.revenue);
  const discountPct = clamp(input.discountPct, 0, 30);
  const creditDays = clamp(input.creditDays, 15, 90);
  const defaultPct = clamp(input.defaultPct, 0, 20);
  const coc = clamp(input.costOfCapitalPct ?? DEFAULT_COST_OF_CAPITAL_PCT, 0, 50);

  const discount = revenue * (discountPct / 100);
  const invoiced = revenue - discount;
  const defaultLoss = invoiced * (defaultPct / 100);
  const collected = invoiced - defaultLoss;
  const financingCost = collected * (coc / 100) * (creditDays / 365);
  return {
    gross: revenue,
    discount,
    defaultLoss,
    financingCost,
    net: collected - financingCost,
  };
}

export function compareTerms(revenue: number, scenario: Omit<TermsInput, 'revenue'>) {
  const baseline = evaluateTerms({ revenue, ...BASELINE_TERMS });
  const simulated = evaluateTerms({ revenue, ...scenario });
  return { baseline, simulated, delta: simulated.net - baseline.net };
}
