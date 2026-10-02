import { LoginThrottle, MAX_FAILURES, WINDOW_MS } from './login-throttle';

describe('LoginThrottle', () => {
  it('refuses an address after too many wrong passwords, and lets it back in when the window has passed', () => {
    let now = 1_000_000;
    const t = new LoginThrottle(() => now);
    for (let i = 0; i < MAX_FAILURES - 1; i++) t.recordFailure('a@x.com');
    expect(t.retryAfterSeconds('a@x.com')).toBe(0);
    t.recordFailure('a@x.com');
    expect(t.retryAfterSeconds('a@x.com')).toBe(WINDOW_MS / 1000);
    expect(t.retryAfterSeconds('b@x.com')).toBe(0); // another address is unaffected

    now += WINDOW_MS + 1;
    expect(t.retryAfterSeconds('a@x.com')).toBe(0);
  });

  it('a correct password clears the count', () => {
    const t = new LoginThrottle(() => 5);
    for (let i = 0; i < MAX_FAILURES - 1; i++) t.recordFailure('a@x.com');
    t.recordSuccess('a@x.com');
    t.recordFailure('a@x.com');
    expect(t.retryAfterSeconds('a@x.com')).toBe(0);
  });
});
