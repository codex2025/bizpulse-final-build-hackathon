// Unit-economics formulas. Every function returns null when an input it needs is missing or not positive, so the
// UI shows "enter a value" instead of a made-up number.

const pos = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Customer acquisition cost = acquisition spend / new customers won in the same period. */
export const cac = (spend: number | null, newCustomers: number | null): number | null =>
  pos(spend) && pos(newCustomers) ? spend / newCustomers : null;

/** Lifetime value = monthly revenue per customer x margin / monthly churn. */
export const ltv = (arpaMonthly: number | null, marginPct: number | null, churnPctMonthly: number | null): number | null =>
  pos(arpaMonthly) && pos(marginPct) && pos(churnPctMonthly) ? (arpaMonthly * (marginPct / 100)) / (churnPctMonthly / 100) : null;

export const ltvToCac = (l: number | null, c: number | null): number | null => (pos(l) && pos(c) ? l / c : null);

/** Net revenue retention = (start + expansion - contraction - churn) / start recurring revenue. */
export const nrr = (start: number | null, expansion: number, contraction: number, churn: number): number | null =>
  pos(start) ? ((start + expansion - contraction - churn) / start) * 100 : null;

/** SaaS quick ratio = (new + expansion) / (contraction + churn). */
export const quickRatio = (newMrr: number, expansion: number, contraction: number, churn: number): number | null =>
  pos(contraction + churn) ? (newMrr + expansion) / (contraction + churn) : null;

/** Months of revenue to earn back the acquisition cost = CAC / (monthly revenue x margin). */
export const paybackMonths = (c: number | null, arpaMonthly: number | null, marginPct: number | null): number | null =>
  pos(c) && pos(arpaMonthly) && pos(marginPct) ? c / (arpaMonthly * (marginPct / 100)) : null;
