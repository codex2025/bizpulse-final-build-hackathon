import { randomBytes } from 'crypto';
import { Logger } from '@nestjs/common';

/**
 * Values that appeared in this repository or are common placeholders. A session-signing key that is public
 * lets anyone mint a valid token for any user id, so none of these is ever accepted.
 */
const KNOWN_WEAK = new Set([
  'fallback_secret',
  'super_secret_jwt_key_bizpulse_2026',
  'changeme',
  'change_me',
  'secret',
  'jwt_secret',
  'your_jwt_secret',
  'your-secret-key',
  'your_super_secret_jwt_key_here', // the placeholder that shipped in backend/.env.example
]);

/** Anything that reads like a placeholder someone forgot to replace ("your_...", "change_me", "..._here"). */
const PLACEHOLDER_LIKE =
  /your[_-]|change[_-]?me|replace|placeholder|example|_here$/i;

export const MIN_SECRET_LENGTH = 32;

let developmentSecret: string | undefined;

export function isStrongSecret(value?: string): boolean {
  const secret = (value || '').trim();
  return (
    secret.length >= MIN_SECRET_LENGTH &&
    !KNOWN_WEAK.has(secret.toLowerCase()) &&
    !PLACEHOLDER_LIKE.test(secret)
  );
}

/**
 * The key that signs and verifies session tokens.
 *
 *  - A strong `JWT_SECRET` is used as given.
 *  - In production a missing or weak one is fatal: the process refuses to start rather than sign sessions with a
 *    guessable key (it used to fall back silently to a hard-coded string).
 *  - Otherwise (local development) a random secret is generated once per process, so no fixed key can ever sign a
 *    session. Sessions then end when the server restarts; set JWT_SECRET in backend/.env to keep them.
 *
 * The auth module and the JWT strategy both call this, and get the same value.
 */
export function resolveJwtSecret(
  raw: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  if (isStrongSecret(raw)) return (raw as string).trim();
  if (nodeEnv === 'production') {
    throw new Error(
      `JWT_SECRET must be set to a random value of at least ${MIN_SECRET_LENGTH} characters (not a placeholder) ` +
        "when NODE_ENV=production. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
    );
  }
  if (!developmentSecret) {
    developmentSecret = randomBytes(48).toString('hex');
    new Logger('JwtSecret').warn(
      'JWT_SECRET is not set to a strong value: using a random secret for this process only, so sign-ins end when the ' +
        'server restarts. Set JWT_SECRET in backend/.env to keep them.',
    );
  }
  return developmentSecret;
}

/** Test hook: forget the per-process development secret. */
export function resetDevelopmentSecret(): void {
  developmentSecret = undefined;
}
