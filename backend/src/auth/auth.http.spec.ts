import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, KeyLike } from 'jose';

/**
 * The whole gateway (every module, an in-memory SQLite database) driven over HTTP. Only the source of Google's public
 * keys is replaced, by a local key set, so tokens are really signed and really verified.
 *
 * The environment is fixed BEFORE the app module is loaded (it reads DATABASE_PATH at import time) and the Firebase
 * variables are set to empty strings so that a developer's own backend/.env cannot change what these tests exercise.
 */
process.env.DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'http-test-secret-'.padEnd(64, 'z');
process.env.NODE_ENV = 'test';
process.env.FIREBASE_PROJECT_ID = '';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '';

jest.setTimeout(60000);

const PROJECT = 'bizpulse-http-test';
const KID = 'http-test-key';

let configured: INestApplication; // Google sign-in verifies against the local key set
let unconfigured: INestApplication; // no FIREBASE_PROJECT_ID: Google sign-in is off
let privateKey: KeyLike;
let db: DataSource;

async function boot(overrideVerifier?: unknown): Promise<INestApplication> {
  // require, not import(): Jest runs CommonJS, and the app module must load only after the environment is set above.
  const { AppModule } = require('../app.module');
  const { FIREBASE_TOKEN_VERIFIER } = require('./firebase-token.verifier');
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (overrideVerifier) builder = builder.overrideProvider(FIREBASE_TOKEN_VERIFIER).useValue(overrideVerifier);
  const app = (await builder.compile()).createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: 'RS256', use: 'sig' };
  const { JwksFirebaseVerifier } = require('./firebase-token.verifier');
  configured = await boot(new JwksFirebaseVerifier(PROJECT, createLocalJWKSet({ keys: [jwk] })));
  unconfigured = await boot();
  db = configured.get(DataSource);
});

afterAll(async () => {
  await configured?.close();
  await unconfigured?.close();
});

const now = () => Math.floor(Date.now() / 1000);

async function googleToken(overrides: Record<string, any> = {}, key: KeyLike = privateKey) {
  const claims: Record<string, any> = {
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: 'google-uid-1', auth_time: now() - 5, iat: now() - 5,
    exp: now() + 3600, email: 'Ada@Example.com', email_verified: true, name: 'Ada Lovelace',
    picture: 'https://lh3.googleusercontent.com/a/ada', firebase: { sign_in_provider: 'google.com' }, ...overrides,
  };
  for (const k of Object.keys(claims)) if (claims[k] === undefined) delete claims[k];
  return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: KID }).sign(key);
}

const api = (app: INestApplication) => request(app.getHttpServer());
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('a fresh gateway', () => {
  it('has no accounts at all: nothing is seeded', async () => {
    const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM users');
    expect(n).toBe(0);
  });

  it.each(['demo@bizpulse.com', 'admin@bizpulse.com', 'user@bizpulse.com'])('does not let %s sign in with the old public password', async (email) => {
    await api(configured).post('/api/auth/login').send({ email, password: 'demo123' }).expect(401);
  });

  it('no longer has the old firebase-login route that trusted a client-supplied email', async () => {
    await api(configured).post('/api/auth/firebase-login').send({ email: 'victim@example.com' }).expect(404);
  });

  it('refuses a session token signed with the old hard-coded fallback secret', async () => {
    const forged = new JwtService({ secret: 'fallback_secret' }).sign({ sub: 'anyone', email: 'anyone@example.com' });
    await api(configured).get('/api/users/profile').set(bearer(forged)).expect(401);
  });

  it('protects the business-data routes: no token, no data', async () => {
    await api(configured).get('/api/decision-forge/dataset').expect(401);
    await api(configured).get('/api/users/profile').expect(401);
  });
});

describe('Google sign-up and sign-in over HTTP', () => {
  it('needs a token, and rejects a garbage or foreign one', async () => {
    await api(configured).post('/api/auth/google').send({}).expect(400);
    await api(configured).post('/api/auth/google').send({ idToken: 'x'.repeat(40) }).expect(401);
    const foreign = await googleToken({ aud: 'another-project' });
    await api(configured).post('/api/auth/google').send({ idToken: foreign }).expect(401);
    const otherKey = (await generateKeyPair('RS256')).privateKey;
    await api(configured).post('/api/auth/google').send({ idToken: await googleToken({}, otherKey) }).expect(401);
    const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM users');
    expect(n).toBe(0); // none of the rejected attempts created an account
  });

  it('creates an account from a valid token, signs in again to the same one, and the session works', async () => {
    const first = await api(configured).post('/api/auth/google').send({ idToken: await googleToken(), persona_type: 'personal' }).expect(200);
    expect(first.body.is_new_user).toBe(true);
    expect(first.body.user).toMatchObject({ email: 'ada@example.com', full_name: 'Ada Lovelace', auth_provider: 'google', persona_type: 'personal' });
    expect(JSON.stringify(first.body)).not.toMatch(/password|firebase_uid|google-uid-1/);

    const second = await api(configured).post('/api/auth/google').send({ idToken: await googleToken(), persona_type: 'business' }).expect(200);
    expect(second.body.is_new_user).toBe(false);
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(second.body.user.persona_type).toBe('personal'); // sign-up choices are not re-applied to a returning person

    const profile = await api(configured).get('/api/users/profile').set(bearer(second.body.access_token)).expect(200);
    expect(profile.body).toMatchObject({ email: 'ada@example.com', auth_provider: 'google', email_verified: true });
    expect(profile.body.password).toBeUndefined();
    expect(profile.body.firebase_uid).toBeUndefined();
  });

  it('cannot be used to sign in as someone else by putting their email in the body', async () => {
    const res = await api(configured)
      .post('/api/auth/google')
      .send({ idToken: await googleToken({ sub: 'google-uid-2', email: 'grace@example.com', name: 'Grace' }), email: 'ada@example.com', firebase_uid: 'google-uid-1' })
      .expect(200);
    expect(res.body.user.email).toBe('grace@example.com');
    const ada = await db.query('SELECT firebase_uid FROM users WHERE email = ?', ['ada@example.com']);
    expect(ada[0].firebase_uid).toBe('google-uid-1'); // Ada's link was not touched
  });

  it('accepts only Google: a valid token for another provider is refused', async () => {
    const token = await googleToken({ sub: 'pw-uid', email: 'pw@example.com', firebase: { sign_in_provider: 'password' } });
    await api(configured).post('/api/auth/google').send({ idToken: token }).expect(401);
  });

  it('refuses a Google account whose email is not verified', async () => {
    await api(configured).post('/api/auth/google').send({ idToken: await googleToken({ sub: 'u3', email: 'un@example.com', email_verified: false }) }).expect(401);
  });

  it('answers 503 with a clear message, not a crash or a 401, when Google sign-in is not configured', async () => {
    const res = await api(unconfigured).post('/api/auth/google').send({ idToken: await googleToken() }).expect(503);
    expect(res.body.message).toMatch(/not configured/);
    await api(unconfigured).post('/api/auth/login').send({ email: 'x@example.com', password: 'whatever-password' }).expect(401); // password sign-in still works
  });
});

describe('linking Google to an account that already exists', () => {
  it('keeps the account and retires its old password', async () => {
    const signup = await api(configured).post('/api/auth/register').send({ email: 'linus@example.com', password: 'registered-first', full_name: 'Linus' }).expect(201);
    await api(configured).post('/api/auth/login').send({ email: 'linus@example.com', password: 'registered-first' }).expect(200);

    const google = await api(configured).post('/api/auth/google').send({ idToken: await googleToken({ sub: 'google-uid-linus', email: 'LINUS@example.com', name: 'Linus T' }) }).expect(200);
    expect(google.body.user.id).toBe(signup.body.user.id);
    expect(google.body.is_new_user).toBe(false);
    await api(configured).post('/api/auth/login').send({ email: 'linus@example.com', password: 'registered-first' }).expect(401);
  });
});

describe('email and password accounts', () => {
  it('register, sign in, read and update the profile', async () => {
    const reg = await api(configured).post('/api/auth/register').send({ email: 'Kay@Example.com', password: 'a-decent-password', full_name: 'Kay' }).expect(201);
    expect(reg.body.user.email).toBe('kay@example.com');
    const login = await api(configured).post('/api/auth/login').send({ email: 'KAY@example.com', password: 'a-decent-password' }).expect(200);
    const auth = bearer(login.body.access_token);
    const updated = await api(configured).patch('/api/users/profile').set(auth).send({ business_name: 'Kay & Co', monthly_income: 12345 }).expect(200);
    expect(updated.body).toMatchObject({ business_name: 'Kay & Co', monthly_income: 12345 });
  });

  it('rejects weak or malformed sign-ups and a duplicate email', async () => {
    await api(configured).post('/api/auth/register').send({ email: 'weak@example.com', password: 'short', full_name: 'W' }).expect(400);
    await api(configured).post('/api/auth/register').send({ email: 'not-an-email', password: 'a-decent-password', full_name: 'W' }).expect(400);
    await api(configured).post('/api/auth/register').send({ email: 'kay@example.com', password: 'a-decent-password', full_name: 'Again' }).expect(409);
  });

  it('cannot change identity fields through the profile route', async () => {
    const login = await api(configured).post('/api/auth/login').send({ email: 'kay@example.com', password: 'a-decent-password' }).expect(200);
    const auth = bearer(login.body.access_token);
    const res = await api(configured)
      .patch('/api/users/profile')
      .set(auth)
      .send({ full_name: 'Kay Renamed', email: 'grace@example.com', password: 'overwritten', firebase_uid: 'google-uid-1', id: 'hijack', auth_provider: 'google' })
      .expect(200);
    expect(res.body).toMatchObject({ full_name: 'Kay Renamed', email: 'kay@example.com', auth_provider: 'password' });
    expect(res.body.id).not.toBe('hijack');
    // the password did not change, and no one else's Google link moved
    await api(configured).post('/api/auth/login').send({ email: 'kay@example.com', password: 'a-decent-password' }).expect(200);
    const ada = await db.query('SELECT firebase_uid FROM users WHERE email = ?', ['ada@example.com']);
    expect(ada[0].firebase_uid).toBe('google-uid-1');
  });

  it('rejects a profile update with an invalid value instead of storing it', async () => {
    const login = await api(configured).post('/api/auth/login').send({ email: 'kay@example.com', password: 'a-decent-password' }).expect(200);
    await api(configured).patch('/api/users/profile').set(bearer(login.body.access_token)).send({ persona_type: 'admin' }).expect(400);
    await api(configured).patch('/api/users/profile').set(bearer(login.body.access_token)).send({ monthly_income: -1 }).expect(400);
  });
});

describe('startup guards', () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const key of ['JWT_SECRET', 'NODE_ENV', 'FIREBASE_AUTH_EMULATOR_HOST']) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('with no JWT_SECRET (development) signs sessions with a random key: the old "fallback_secret" opens nothing', async () => {
    process.env.JWT_SECRET = '';
    process.env.NODE_ENV = 'development';
    const app = await boot();
    try {
      const forged = new JwtService({ secret: 'fallback_secret' }).sign({ sub: 'anyone', email: 'anyone@example.com' });
      await api(app).get('/api/users/profile').set(bearer(forged)).expect(401);
      // and the key it does use is consistent between signing and checking, so real sessions work
      const reg = await api(app).post('/api/auth/register').send({ email: 'dev@example.com', password: 'a-decent-password', full_name: 'Dev' }).expect(201);
      await api(app).get('/api/users/profile').set(bearer(reg.body.access_token)).expect(200);
    } finally {
      await app.close();
    }
  });

  it('REFUSES TO START in production without a strong JWT_SECRET', async () => {
    process.env.JWT_SECRET = 'fallback_secret';
    process.env.NODE_ENV = 'production';
    await expect(boot()).rejects.toThrow(/JWT_SECRET must be set/);
  });

  it('REFUSES TO START in production with the Firebase emulator switch set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    await expect(boot()).rejects.toThrow(/refusing to start/);
  });
});
