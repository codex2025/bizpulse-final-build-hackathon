import { randomBytes } from 'crypto';
import {
  MIN_SECRET_LENGTH,
  isStrongSecret,
  resetDevelopmentSecret,
  resolveJwtSecret,
} from './jwt-secret';

const STRONG = 'k'.repeat(MIN_SECRET_LENGTH) + '-a-real-random-value';

beforeEach(() => resetDevelopmentSecret());

describe('isStrongSecret', () => {
  it('accepts a long random-looking value', () => {
    expect(isStrongSecret(STRONG)).toBe(true);
    // What a real one looks like (generated here, never a literal): 64 hex characters, and a base64url string.
    expect(isStrongSecret(randomBytes(32).toString('hex'))).toBe(true);
    expect(isStrongSecret(randomBytes(36).toString('base64url'))).toBe(true);
  });

  it.each([
    [undefined],
    [''],
    ['   '],
    ['short'],
    ['x'.repeat(MIN_SECRET_LENGTH - 1)],
    ['fallback_secret'], // the value that used to be hard-coded
    ['super_secret_jwt_key_bizpulse_2026'], // the value in .env.example: public, so useless as a key
    ['SUPER_SECRET_JWT_KEY_BIZPULSE_2026'],
    ['  super_secret_jwt_key_bizpulse_2026  '],
    ['your_super_secret_jwt_key_here'], // the placeholder in backend/.env.example, copied unchanged
    ['please_change_me_to_something_random_and_long'],
    ['a-very-long-value-that-still-says-example-secret-key'],
    ['replace-this-with-a-random-value-of-32-plus-chars'],
  ])('rejects %p', (value) => {
    expect(isStrongSecret(value as any)).toBe(false);
  });
});

describe('resolveJwtSecret', () => {
  it('uses a strong secret as given (trimmed), in any environment', () => {
    expect(resolveJwtSecret(`  ${STRONG}  `, 'production')).toBe(STRONG);
    expect(resolveJwtSecret(STRONG, 'development')).toBe(STRONG);
  });

  it.each([
    [undefined],
    [''],
    ['fallback_secret'],
    ['super_secret_jwt_key_bizpulse_2026'],
    ['too-short'],
  ])(
    'REFUSES to start in production with %p (it used to fall back silently to a public string)',
    (value) => {
      expect(() => resolveJwtSecret(value as any, 'production')).toThrow(
        /JWT_SECRET must be set/,
      );
    },
  );

  it('generates a random per-process secret in development instead of using a fixed one', () => {
    const secret = resolveJwtSecret(undefined, 'development');
    expect(secret.length).toBeGreaterThanOrEqual(MIN_SECRET_LENGTH);
    expect(secret).not.toBe('fallback_secret');
    expect(isStrongSecret(secret)).toBe(true);
  });

  it('gives the auth module and the JWT strategy the SAME development secret (tokens must verify)', () => {
    expect(resolveJwtSecret(undefined, 'development')).toBe(
      resolveJwtSecret('fallback_secret', 'test'),
    );
  });

  it('does not repeat across processes: a fresh start gets a different secret', () => {
    const first = resolveJwtSecret(undefined, 'development');
    resetDevelopmentSecret();
    expect(resolveJwtSecret(undefined, 'development')).not.toBe(first);
  });
});
