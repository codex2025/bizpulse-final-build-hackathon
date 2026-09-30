// Cash runway: how many months the liquid balance covers the current monthly outflow.
// Only liquid asset categories count (cash, bank, fixed deposits, liquid funds); property, gold and statutory
// funds are not treated as spendable.

export const LIQUID_CATEGORIES = ['cash', 'bank', 'fd', 'mutual_funds'] as const;

export interface AssetLike {
  type?: string;
  category?: string;
  value?: number | string;
}

export const liquidBalance = (items: AssetLike[]): number =>
  items
    .filter((i) => i.type === 'asset' && (LIQUID_CATEGORIES as readonly string[]).includes(String(i.category)))
    .reduce((s, i) => s + (Number(i.value) > 0 ? Number(i.value) : 0), 0);

/** Months of runway, or null when either figure is missing (never a made-up number). */
export const runwayMonths = (liquid: number, monthlyOutflow: number): number | null =>
  liquid > 0 && monthlyOutflow > 0 ? liquid / monthlyOutflow : null;

export type RunwayBand = 'critical' | 'watch' | 'healthy';
export const runwayBand = (months: number): RunwayBand => (months < 3 ? 'critical' : months < 6 ? 'watch' : 'healthy');
