import { describe, expect, it } from 'vitest';
import { amountInWords } from '../utils/amountInWords';
import { simulateRetainedCash } from '../utils/monteCarlo';
import { BASELINE_TERMS, compareTerms, evaluateTerms } from '../utils/termsSandbox';
import { cac, ltv, ltvToCac, nrr, paybackMonths, quickRatio } from '../utils/unitEconomics';
import { aggregateBy, hhi, topShare } from '../utils/expenseAllocation';
import { csvField, toCsv } from '../utils/csv';
import { liquidBalance, runwayBand, runwayMonths } from '../utils/runway';
import {
  bandCounts, contractRiskScore, extractObligations, findJurisdiction, findLiabilityCap, riskLabel, splitForHighlight,
} from '../components/contracts/contractReview';
import type { ContractClause } from '../components/contracts/contractTypes';

describe('amountInWords (Indian numbering)', () => {
  it('spells lakhs and thousands', () => {
    expect(amountInWords(147500)).toBe('Indian Rupees One Lakh Forty Seven Thousand Five Hundred Only');
    expect(amountInWords(118000)).toContain('One Lakh Eighteen Thousand');
  });
  it('handles crore, zero and paise', () => {
    expect(amountInWords(12500000)).toBe('Indian Rupees One Crore Twenty Five Lakh Only');
    expect(amountInWords(0)).toBe('Indian Rupees Zero Only');
    expect(amountInWords(10.5)).toBe('Indian Rupees Ten and Fifty Paise Only');
  });
});

describe('Monte Carlo retained cash', () => {
  const input = { monthlyInflow: 200000, monthlyOutflow: 150000, inflowVolatility: 0.1, outflowVolatility: 0.05 };
  it('is deterministic for the same inputs', () => {
    expect(simulateRetainedCash(input)).toEqual(simulateRetainedCash(input));
  });
  it('with no volatility collapses to the straight line', () => {
    const r = simulateRetainedCash({ ...input, inflowVolatility: 0, outflowVolatility: 0, months: 12 });
    expect(r.endP50).toBe(600000);
    expect(r.endP10).toBe(r.endP90);
    expect(r.probabilityOfShortfall).toBe(0);
  });
  it('orders the bands and flags shortfall risk when outflow exceeds inflow', () => {
    const r = simulateRetainedCash(input);
    expect(r.endP10).toBeLessThanOrEqual(r.endP50);
    expect(r.endP50).toBeLessThanOrEqual(r.endP90);
    expect(simulateRetainedCash({ ...input, monthlyInflow: 100000 }).probabilityOfShortfall).toBeGreaterThan(0.9);
  });
});

describe('commercial terms sandbox', () => {
  it('no discount, no default, no financing cost = revenue', () => {
    expect(evaluateTerms({ revenue: 1000, discountPct: 0, defaultPct: 0, creditDays: 15, costOfCapitalPct: 0 }).net).toBe(1000);
  });
  it('applies discount, then default, then financing cost, with exact arithmetic', () => {
    const o = evaluateTerms({ revenue: 1_000_000, discountPct: 10, defaultPct: 5, creditDays: 60, costOfCapitalPct: 12 });
    expect(o.discount).toBe(100_000);
    expect(o.defaultLoss).toBe(45_000);
    expect(o.financingCost).toBeCloseTo(855_000 * 0.12 * (60 / 365), 6);
    expect(o.net).toBeCloseTo(855_000 - o.financingCost, 6);
  });
  it('clamps levers to their stated ranges', () => {
    expect(evaluateTerms({ revenue: 100, discountPct: 99, defaultPct: 0, creditDays: 15, costOfCapitalPct: 0 }).discount).toBe(30);
  });
  it('baseline vs baseline has zero difference; a discount is negative', () => {
    expect(compareTerms(500000, { ...BASELINE_TERMS }).delta).toBe(0);
    expect(compareTerms(500000, { ...BASELINE_TERMS, discountPct: 10 }).delta).toBeLessThan(0);
  });
});

describe('unit economics', () => {
  it('computes each metric from its formula', () => {
    expect(cac(100000, 10)).toBe(10000);
    expect(ltv(5000, 80, 2)).toBe(200000);
    expect(ltvToCac(200000, 10000)).toBe(20);
    expect(paybackMonths(10000, 5000, 80)).toBe(2.5);
    expect(nrr(100, 20, 5, 5)).toBeCloseTo(110, 9);
    expect(quickRatio(30, 20, 5, 5)).toBe(5);
  });
  it('never invents a number from missing or zero inputs', () => {
    expect(cac(null, 10)).toBeNull();
    expect(cac(100, 0)).toBeNull();
    expect(ltv(5000, 80, 0)).toBeNull();
    expect(nrr(0, 1, 1, 1)).toBeNull();
    expect(quickRatio(10, 10, 0, 0)).toBeNull();
  });
});

describe('expense allocation', () => {
  const rows = [
    { category: 'Cloud', description: 'AWS', amount: 100, expense_date: '2026-09-10' },
    { category: 'Cloud', description: 'AWS', amount: 50, expense_date: '2026-09-11' },
    { category: 'Ads', description: 'Google Ads', amount: 50, expense_date: '2026-09-12' },
    { category: 'Old', description: 'Legacy', amount: 999, expense_date: '2020-01-01' },
    { category: 'Junk', description: 'x', amount: -5, expense_date: '2026-09-12' },
  ];
  it('aggregates every expense per category inside the window', () => {
    const cats = aggregateBy(rows, 'category', new Date('2026-01-01'));
    expect(cats.map((c) => [c.name, c.value])).toEqual([['Cloud', 150], ['Ads', 50]]);
    expect(cats[0].share).toBeCloseTo(0.75);
  });
  it('uses the description as the payee and measures concentration', () => {
    const v = aggregateBy(rows, 'vendor_or_payee', new Date('2026-01-01'));
    expect(v[0].name).toBe('AWS');
    expect(topShare(v, 1)).toBeCloseTo(0.75);
    expect(hhi(v)).toBe(Math.round(75 ** 2 + 25 ** 2));
  });
});

describe('CSV writer (RFC 4180)', () => {
  it('quotes commas, quotes and newlines and ends rows with CRLF', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"\r\n');
  });
  it('neutralises spreadsheet formulas in text but keeps negative numbers', () => {
    expect(csvField('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvField('@cmd')).toBe("'@cmd");
    expect(csvField(-250.5)).toBe('-250.5');
    expect(csvField(null)).toBe('');
  });
});

describe('runway', () => {
  it('counts only liquid assets and divides by outflow', () => {
    const items = [
      { type: 'asset', category: 'bank', value: 600000 },
      { type: 'asset', category: 'fd', value: 300000 },
      { type: 'asset', category: 'real_estate', value: 9_000_000 },
      { type: 'liability', category: 'bank', value: 50000 },
    ];
    expect(liquidBalance(items)).toBe(900000);
    expect(runwayMonths(900000, 150000)).toBe(6);
  });
  it('is unavailable (not zero, not invented) without both figures', () => {
    expect(runwayMonths(0, 100)).toBeNull();
    expect(runwayMonths(100, 0)).toBeNull();
    expect([runwayBand(2), runwayBand(4), runwayBand(9)]).toEqual(['critical', 'watch', 'healthy']);
  });
});

const clause = (over: Partial<ContractClause>): ContractClause => ({ clause_type: 'Clause', original_text: '', risk_level: 'Low', ...over });

describe('contract review', () => {
  const clauses: ContractClause[] = [
    clause({ clause_type: 'Liability', original_text: "The Provider's total liability shall not exceed ₹25,00,000.", risk_level: 'Medium' }),
    clause({ clause_type: 'Governing Law', original_text: 'This Agreement is governed by the laws of India and the courts at Bengaluru.' }),
    clause({ clause_type: 'Late Payment Penalty', original_text: 'Late payments accrue interest at 1.5% per month.', risk_level: 'High', financial_impact: '1.5% per month' }),
    clause({ clause_type: 'Confidentiality', original_text: 'Keep information secret for five years.', is_red_flag: true }),
  ];
  it('scores risk from clause bands and labels it', () => {
    expect(bandCounts(clauses)).toEqual({ critical: 2, moderate: 1, standard: 1 });
    expect(contractRiskScore(clauses)).toBe(Math.round((5 / 8) * 100));
    expect(contractRiskScore([])).toBe(0);
    expect(riskLabel(63)).toBe('High');
    expect(riskLabel(10)).toBe('Low');
  });
  it('reads jurisdiction and liability cap only when the text states them', () => {
    expect(findJurisdiction(clauses)).toBe('India');
    expect(findLiabilityCap(clauses)).toContain('25,00,000');
    expect(findJurisdiction([clause({ original_text: 'Nothing relevant.' })])).toBeNull();
    expect(findLiabilityCap([clause({ clause_type: 'Liability', original_text: 'Liability is excluded.' })])).toBeNull();
  });
  it('classifies money and service obligations', () => {
    const kinds = extractObligations(clauses).map((o) => o.kind);
    expect(kinds).toContain('Penalty');
    expect(kinds).toContain('Confidentiality');
  });
  it('highlights search terms without raw HTML and escapes regex characters', () => {
    expect(splitForHighlight('Pay within 30 days (net)', '(net)')).toEqual([
      { text: 'Pay within 30 days ', hit: false },
      { text: '(net)', hit: true },
    ]);
    expect(splitForHighlight('abc', '')).toEqual([{ text: 'abc', hit: false }]);
    expect(splitForHighlight('Fee FEE fee', 'fee').filter((p) => p.hit)).toHaveLength(3);
  });
});
