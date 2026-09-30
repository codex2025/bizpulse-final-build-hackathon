export interface ExpenseLike {
  category?: string | null;
  amount?: number | string | null;
  vendor_or_payee?: string | null;
  description?: string | null;
  expense_date?: string | null;
}

export interface Slice {
  name: string;
  value: number;
  share: number;
}

const amountOf = (e: ExpenseLike) => {
  const n = Number(e.amount);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** True aggregation: every expense in the window counts toward its category (not just the first one). */
export function aggregateBy(expenses: ExpenseLike[], key: 'category' | 'vendor_or_payee', since?: Date): Slice[] {
  const totals = new Map<string, number>();
  let grand = 0;
  for (const e of expenses) {
    if (since && e.expense_date && new Date(e.expense_date) < since) continue;
    const amount = amountOf(e);
    if (amount === 0) continue;
    // Expenses store no separate payee column: the description (the bank narration or the typed label) is the payee.
    const raw = key === 'vendor_or_payee' ? e.vendor_or_payee || e.description : e.category;
    const name = (raw || '').toString().trim() || (key === 'category' ? 'Uncategorised' : 'Unknown payee');
    totals.set(name, (totals.get(name) || 0) + amount);
    grand += amount;
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, value, share: grand > 0 ? value / grand : 0 }))
    .sort((a, b) => b.value - a.value);
}

/** Share of spend going to the `n` largest vendors (0-1). */
export const topShare = (slices: Slice[], n: number) => slices.slice(0, n).reduce((s, x) => s + x.share, 0);

/** Herfindahl-Hirschman index of vendor concentration, 0-10,000 (above 2,500 is highly concentrated). */
export const hhi = (slices: Slice[]) => Math.round(slices.reduce((s, x) => s + (x.share * 100) ** 2, 0));
