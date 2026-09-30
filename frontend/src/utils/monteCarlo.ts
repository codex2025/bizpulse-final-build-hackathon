// Deterministic Monte Carlo projection of cumulative retained cash.
//
// This is a what-if model on the user's own averages, not a prediction of the future: each month's
// inflow and outflow is the observed monthly average times a random factor with the stated
// volatility. A fixed seed means the same inputs always give the same bands.

export interface MonteCarloInput {
  monthlyInflow: number;
  monthlyOutflow: number;
  /** Relative standard deviation of monthly inflow, e.g. 0.12 = 12%. */
  inflowVolatility: number;
  /** Relative standard deviation of monthly outflow. */
  outflowVolatility: number;
  months?: number;
  paths?: number;
  seed?: number;
}

export interface MonteCarloPoint {
  month: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface MonteCarloResult {
  points: MonteCarloPoint[];
  /** Share of simulated paths whose cumulative cash is negative at some point in the horizon. */
  probabilityOfShortfall: number;
  endP10: number;
  endP50: number;
  endP90: number;
}

/** Small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box-Muller. */
function normal(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const quantile = (sorted: number[], q: number): number => {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export function simulateRetainedCash(input: MonteCarloInput): MonteCarloResult {
  const months = Math.max(1, Math.min(36, Math.floor(input.months ?? 12)));
  const paths = Math.max(100, Math.min(5000, Math.floor(input.paths ?? 1000)));
  const rand = mulberry32(input.seed ?? 20260930);
  const sIn = Math.max(0, input.inflowVolatility);
  const sOut = Math.max(0, input.outflowVolatility);

  const byMonth: number[][] = Array.from({ length: months }, () => []);
  let shortfalls = 0;

  for (let p = 0; p < paths; p++) {
    let cash = 0;
    let dipped = false;
    for (let m = 0; m < months; m++) {
      const inflow = Math.max(0, input.monthlyInflow * (1 + sIn * normal(rand)));
      const outflow = Math.max(0, input.monthlyOutflow * (1 + sOut * normal(rand)));
      cash += inflow - outflow;
      if (cash < 0) dipped = true;
      byMonth[m].push(cash);
    }
    if (dipped) shortfalls++;
  }

  const points = byMonth.map((values, i) => {
    const sorted = [...values].sort((a, b) => a - b);
    return { month: i + 1, p10: quantile(sorted, 0.1), p50: quantile(sorted, 0.5), p90: quantile(sorted, 0.9) };
  });
  const last = points[points.length - 1];
  return {
    points,
    probabilityOfShortfall: shortfalls / paths,
    endP10: last.p10,
    endP50: last.p50,
    endP90: last.p90,
  };
}
