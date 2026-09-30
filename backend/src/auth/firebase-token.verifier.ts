import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, decodeJwt, errors as joseErrors, jwtVerify, JWTVerifyGetKey } from 'jose';

/** Google's public keys for Firebase ID tokens (cached and refreshed by jose according to the response headers). */
export const GOOGLE_SECURETOKEN_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/** Injection token for the verifier, so tests can supply one built on locally generated keys. */
export const FIREBASE_TOKEN_VERIFIER = 'FIREBASE_TOKEN_VERIFIER';

const MAX_TOKEN_LENGTH = 4096;
const MAX_UID_LENGTH = 128;
const CLOCK_TOLERANCE_SECONDS = 5;

/** What the gateway learns from a verified Firebase ID token. Nothing here comes from the request body. */
export interface FirebaseIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  /** `firebase.sign_in_provider` of the token, for example `google.com`. */
  provider: string;
}

export type FirebaseTokenFailure = 'invalid' | 'expired' | 'email_unverified' | 'unavailable' | 'not_configured';

export class FirebaseTokenError extends Error {
  constructor(
    readonly failure: FirebaseTokenFailure,
    message: string,
  ) {
    super(message);
    this.name = 'FirebaseTokenError';
  }
}

export interface FirebaseTokenVerifier {
  verify(idToken: string): Promise<FirebaseIdentity>;
}

function shortText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text && text.length <= max ? text : undefined;
}

/** Only an https URL is kept as a picture; anything else is dropped rather than stored. */
function httpsUrl(value: unknown): string | undefined {
  const url = shortText(value, 500);
  return url && /^https:\/\//i.test(url) ? url : undefined;
}

/** A token problem (bad signature, wrong audience, expired...) versus the key service being unreachable. */
function classify(err: unknown): FirebaseTokenError {
  if (err instanceof joseErrors.JWTExpired) return new FirebaseTokenError('expired', 'token expired');
  const infrastructure =
    err instanceof joseErrors.JWKSTimeout ||
    err instanceof joseErrors.JWKSInvalid ||
    (err instanceof joseErrors.JOSEError && err.code === 'ERR_JOSE_GENERIC') ||
    !(err instanceof joseErrors.JOSEError);
  return infrastructure
    ? new FirebaseTokenError('unavailable', 'could not reach the Google key service')
    : new FirebaseTokenError('invalid', 'token rejected');
}

/**
 * Verifies a Firebase ID token the way Firebase documents for third-party libraries: RS256 only, signature checked
 * against Google's published keys (`kid` must match), and `iss`, `aud`, `exp`, `iat`/`nbf`, `sub` and `auth_time`
 * validated. Needs only the project id: there is no secret or service-account key on the gateway.
 */
export class JwksFirebaseVerifier implements FirebaseTokenVerifier {
  constructor(
    private readonly projectId: string,
    private readonly getKey: JWTVerifyGetKey = createRemoteJWKSet(new URL(GOOGLE_SECURETOKEN_JWKS_URL)),
  ) {}

  async verify(idToken: string): Promise<FirebaseIdentity> {
    if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > MAX_TOKEN_LENGTH) {
      throw new FirebaseTokenError('invalid', 'malformed token');
    }
    let payload;
    try {
      ({ payload } = await jwtVerify(idToken, this.getKey, {
        algorithms: ['RS256'],
        issuer: `https://securetoken.google.com/${this.projectId}`,
        audience: this.projectId,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      }));
    } catch (err) {
      throw classify(err);
    }

    const uid = payload.sub;
    if (typeof uid !== 'string' || !uid || uid.length > MAX_UID_LENGTH) {
      throw new FirebaseTokenError('invalid', 'missing subject');
    }
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.auth_time !== 'number' || payload.auth_time > now + CLOCK_TOLERANCE_SECONDS) {
      throw new FirebaseTokenError('invalid', 'bad auth_time');
    }
    const email = shortText(payload.email, 254);
    if (!email || !email.includes('@')) throw new FirebaseTokenError('invalid', 'no email');
    if (payload.email_verified !== true) throw new FirebaseTokenError('email_unverified', 'email not verified');

    const firebase = payload.firebase as { sign_in_provider?: unknown } | undefined;
    return {
      uid,
      email: email.toLowerCase(),
      emailVerified: true,
      name: shortText(payload.name, 100),
      picture: httpsUrl(payload.picture),
      provider: typeof firebase?.sign_in_provider === 'string' ? firebase.sign_in_provider : 'unknown',
    };
  }
}

/**
 * LOCAL DEVELOPMENT ONLY. The Firebase Auth emulator issues unsigned tokens, which cannot be verified with keys, so
 * the emulator itself is asked to look the token up. Never constructed in production (see createFirebaseVerifier).
 */
export class EmulatorFirebaseVerifier implements FirebaseTokenVerifier {
  constructor(
    private readonly host: string,
    private readonly projectId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async verify(idToken: string): Promise<FirebaseIdentity> {
    if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > MAX_TOKEN_LENGTH) {
      throw new FirebaseTokenError('invalid', 'malformed token');
    }
    let audience: unknown;
    try {
      audience = decodeJwt(idToken).aud; // read only to catch a token minted for another project; trust comes from the lookup
    } catch {
      throw new FirebaseTokenError('invalid', 'malformed token');
    }
    if (audience !== this.projectId) throw new FirebaseTokenError('invalid', 'token is for another project');

    let response: Response;
    try {
      response = await this.fetchImpl(`http://${this.host}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=emulator`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
    } catch {
      throw new FirebaseTokenError('unavailable', 'the Firebase Auth emulator is not reachable');
    }
    if (!response.ok) throw new FirebaseTokenError('invalid', 'token rejected by the emulator');
    const user = ((await response.json()) as { users?: any[] })?.users?.[0];
    if (!user?.localId) throw new FirebaseTokenError('invalid', 'unknown user');
    const email = shortText(user.email, 254);
    if (!email) throw new FirebaseTokenError('invalid', 'no email');
    if (user.emailVerified !== true) throw new FirebaseTokenError('email_unverified', 'email not verified');
    const providers: string[] = (user.providerUserInfo || []).map((p: any) => p?.providerId).filter(Boolean);
    return {
      uid: String(user.localId),
      email: email.toLowerCase(),
      emailVerified: true,
      name: shortText(user.displayName, 100),
      picture: httpsUrl(user.photoUrl),
      provider: providers.includes('google.com') ? 'google.com' : providers[0] || 'unknown',
    };
  }
}

/** Used when Google sign-in has not been configured: every attempt fails with a clear, non-401 reason. */
export class NotConfiguredFirebaseVerifier implements FirebaseTokenVerifier {
  async verify(): Promise<FirebaseIdentity> {
    throw new FirebaseTokenError('not_configured', 'FIREBASE_PROJECT_ID is not set');
  }
}

export interface FirebaseVerifierOptions {
  projectId?: string;
  emulatorHost?: string;
  nodeEnv?: string;
}

export function createFirebaseVerifier(options: FirebaseVerifierOptions): FirebaseTokenVerifier {
  const logger = new Logger('FirebaseAuth');
  const projectId = (options.projectId || '').trim();
  const emulatorHost = (options.emulatorHost || '').trim();

  if (emulatorHost) {
    if (options.nodeEnv === 'production') {
      // The emulator accepts unsigned tokens: if this variable leaked into a real deployment, anyone could sign in as anyone.
      throw new Error('FIREBASE_AUTH_EMULATOR_HOST is set while NODE_ENV=production; refusing to start.');
    }
    logger.warn(`Firebase Auth EMULATOR mode (${emulatorHost}): sign-in tokens are checked against the local emulator, not Google.`);
    return new EmulatorFirebaseVerifier(emulatorHost, projectId || 'demo-bizpulse');
  }
  if (!projectId) {
    logger.warn('FIREBASE_PROJECT_ID is not set: Google sign-in is disabled. Password sign-in still works.');
    return new NotConfiguredFirebaseVerifier();
  }
  return new JwksFirebaseVerifier(projectId);
}

export const firebaseVerifierProvider: Provider = {
  provide: FIREBASE_TOKEN_VERIFIER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): FirebaseTokenVerifier =>
    createFirebaseVerifier({
      projectId: config.get<string>('FIREBASE_PROJECT_ID'),
      emulatorHost: config.get<string>('FIREBASE_AUTH_EMULATOR_HOST'),
      nodeEnv: config.get<string>('NODE_ENV') ?? process.env.NODE_ENV,
    }),
};
