/**
 * Slows down password guessing: after MAX_FAILURES wrong passwords for one email address within
 * WINDOW_MS, further attempts for that address are refused until the window has passed.
 * Counts are kept in memory, so each server instance counts on its own; it is a brake, not a lockout service.
 */
export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED = 10_000;

export class LoginThrottle {
  private readonly failures = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  private recent(email: string): number[] {
    const cutoff = this.now() - WINDOW_MS;
    return (this.failures.get(email) || []).filter((t) => t > cutoff);
  }

  /** Seconds until this address may try again, or 0 when it may try now. */
  retryAfterSeconds(email: string): number {
    const recent = this.recent(email);
    if (recent.length < MAX_FAILURES) return 0;
    return Math.max(1, Math.ceil((recent[0] + WINDOW_MS - this.now()) / 1000));
  }

  recordFailure(email: string): void {
    if (this.failures.size >= MAX_TRACKED && !this.failures.has(email)) {
      this.failures.clear(); // bounded memory under a flood of made-up addresses
    }
    this.failures.set(email, [...this.recent(email), this.now()]);
  }

  recordSuccess(email: string): void {
    this.failures.delete(email);
  }
}
