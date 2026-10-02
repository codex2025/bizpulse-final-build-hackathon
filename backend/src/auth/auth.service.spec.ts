import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import {
  FirebaseIdentity,
  FirebaseTokenError,
  FirebaseTokenFailure,
} from './firebase-token.verifier';
import { User } from '../users/entities/user.entity';

const uniqueViolation = () =>
  Object.assign(new Error('UNIQUE constraint failed: users.email'), {
    code: 'SQLITE_CONSTRAINT_UNIQUE',
  });

/** In-memory stand-in for UsersService with the same uniqueness rules as the real table. */
class FakeUsers {
  rows: User[] = [];
  beforeCreate?: () => void;
  private seq = 0;

  private copy(row?: User) {
    return row ? ({ ...row } as User) : null;
  }
  async create(data: Partial<User>) {
    this.beforeCreate?.();
    if (
      this.rows.some(
        (r) => r.email.toLowerCase() === (data.email || '').toLowerCase(),
      )
    )
      throw uniqueViolation();
    if (
      data.firebase_uid &&
      this.rows.some((r) => r.firebase_uid === data.firebase_uid)
    )
      throw uniqueViolation();
    const row = {
      id: `user-${++this.seq}`,
      business_name: null,
      gst_number: null,
      job_title: null,
      monthly_income: 0,
      monthly_expense: 0,
      persona_type: 'business',
      firebase_uid: null,
      auth_provider: 'password',
      email_verified: false,
      avatar_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      ...data,
    } as unknown as User;
    this.rows.push(row);
    return this.copy(row) as User;
  }
  async findByEmail(email: string) {
    return this.copy(
      this.rows.find(
        (r) => r.email.toLowerCase() === (email || '').trim().toLowerCase(),
      ),
    );
  }
  async findByFirebaseUid(uid: string) {
    return this.copy(this.rows.find((r) => r.firebase_uid === uid));
  }
  async findById(id: string) {
    return this.copy(this.rows.find((r) => r.id === id));
  }
  async update(id: string, patch: Partial<User>) {
    const row = this.rows.find((r) => r.id === id);
    if (row) Object.assign(row, patch);
    return this.copy(row);
  }
}

/** A verifier whose answer the test scripts. Records the tokens it was asked about. */
class FakeVerifier {
  tokens: string[] = [];
  outcome: FirebaseIdentity | Error = ada();
  async verify(token: string) {
    this.tokens.push(token);
    if (this.outcome instanceof Error) throw this.outcome;
    return this.outcome;
  }
}

function ada(overrides: Partial<FirebaseIdentity> = {}): FirebaseIdentity {
  return {
    uid: 'firebase-ada',
    email: 'ada@example.com',
    emailVerified: true,
    name: 'Ada Lovelace',
    picture: 'https://lh3.googleusercontent.com/a/ada',
    provider: 'google.com',
    ...overrides,
  };
}

const jwt = new JwtService({
  secret: 'test-only-secret-that-is-long-enough-1234567890',
});

function setup() {
  const users = new FakeUsers();
  const verifier = new FakeVerifier();
  const service = new AuthService(users as any, jwt, verifier as any);
  return { users, verifier, service };
}

async function statusOf(promise: Promise<any>): Promise<number> {
  try {
    await promise;
    return 200;
  } catch (err) {
    if (err instanceof HttpException) return err.getStatus();
    throw err;
  }
}

describe('email + password accounts', () => {
  it('registers, lowercases the email, hashes the password and returns a working session', async () => {
    const { service, users } = setup();
    const res = await service.register({
      email: ' Grace@Example.COM ',
      password: 'correct horse',
      full_name: 'Grace Hopper',
    });
    expect(res.is_new_user).toBe(true);
    expect(res.user).toMatchObject({
      email: 'grace@example.com',
      full_name: 'Grace Hopper',
      persona_type: 'business',
      auth_provider: 'password',
    });
    expect(jwt.verify(res.access_token)).toMatchObject({
      sub: res.user.id,
      email: 'grace@example.com',
    });
    expect(users.rows[0].password).not.toContain('correct horse');
    expect(await bcrypt.compare('correct horse', users.rows[0].password)).toBe(
      true,
    );
    expect(users.rows[0].email_verified).toBe(false); // nobody has verified this address
  });

  it('takes only profile fields from the body, never identity fields (mass assignment)', async () => {
    const { service, users } = setup();
    await service.register({
      email: 'mallory@example.com',
      password: 'a-long-password',
      full_name: 'Mallory',
      id: 'chosen-id',
      firebase_uid: 'victims-google-uid',
      auth_provider: 'google',
      email_verified: true,
      avatar_url: 'https://evil.example/x.png',
      persona_type: 'self_employed',
      monthly_income: 4200,
    });
    expect(users.rows[0]).toMatchObject({
      persona_type: 'self_employed',
      monthly_income: 4200,
      auth_provider: 'password',
      email_verified: false,
    });
    expect(users.rows[0].id).not.toBe('chosen-id');
    expect(users.rows[0].firebase_uid).toBeNull();
    expect(users.rows[0].avatar_url).toBeNull();
  });

  it.each([
    ['no email', { password: 'a-long-password', full_name: 'X' }],
    [
      'a malformed email',
      { email: 'nope', password: 'a-long-password', full_name: 'X' },
    ],
    [
      'a short password',
      { email: 'a@b.co', password: 'short', full_name: 'X' },
    ],
    [
      "a password over bcrypt's 72-byte limit",
      { email: 'a@b.co', password: 'p'.repeat(73), full_name: 'X' },
    ],
    [
      'a non-string password',
      { email: 'a@b.co', password: 12345678, full_name: 'X' },
    ],
    ['no name', { email: 'a@b.co', password: 'a-long-password' }],
    [
      'an unknown mode',
      {
        email: 'a@b.co',
        password: 'a-long-password',
        full_name: 'X',
        persona_type: 'admin',
      },
    ],
    [
      'a negative income',
      {
        email: 'a@b.co',
        password: 'a-long-password',
        full_name: 'X',
        monthly_income: -5,
      },
    ],
  ])('rejects %s with 400', async (_label, body) => {
    const { service } = setup();
    expect(await statusOf(service.register(body))).toBe(400);
  });

  it('rejects a second registration of the same address, whatever its case, with 409', async () => {
    const { service } = setup();
    await service.register({
      email: 'ada@example.com',
      password: 'a-long-password',
      full_name: 'Ada',
    });
    expect(
      await statusOf(
        service.register({
          email: 'ADA@example.com',
          password: 'another-long-one',
          full_name: 'Imposter',
        }),
      ),
    ).toBe(409);
  });

  it('answers a simultaneous duplicate registration with 409, not a server error', async () => {
    const { service, users } = setup();
    users.beforeCreate = () => {
      users.beforeCreate = undefined;
      users.rows.push({
        id: 'winner',
        email: 'race@example.com',
        password: 'x',
        full_name: 'W',
      } as any);
    };
    expect(
      await statusOf(
        service.register({
          email: 'race@example.com',
          password: 'a-long-password',
          full_name: 'L',
        }),
      ),
    ).toBe(409);
  });

  it('logs in with the right password (any email case) and refuses a wrong one, an unknown address and junk', async () => {
    const { service } = setup();
    await service.register({
      email: 'ada@example.com',
      password: 'a-long-password',
      full_name: 'Ada',
    });
    expect(
      (await service.login('ADA@Example.com', 'a-long-password')).user.email,
    ).toBe('ada@example.com');
    expect(
      await statusOf(service.login('ada@example.com', 'wrong-password')),
    ).toBe(401);
    expect(
      await statusOf(service.login('nobody@example.com', 'a-long-password')),
    ).toBe(401);
    expect(
      await statusOf(service.login(undefined as any, undefined as any)),
    ).toBe(401);
    expect(
      await statusOf(service.login({ $ne: 1 } as any, { $ne: 1 } as any)),
    ).toBe(401);
  });

  it('has no built-in accounts: the well-known demo logins do not exist', async () => {
    const { service } = setup();
    for (const email of [
      'demo@bizpulse.com',
      'admin@bizpulse.com',
      'user@bizpulse.com',
    ]) {
      expect(await statusOf(service.login(email, 'demo123'))).toBe(401);
    }
  });
});

describe('Google sign-in and sign-up', () => {
  it('creates the account on first use and returns a session for it', async () => {
    const { service, users } = setup();
    const res = await service.googleAuth({ idToken: 'token-1' });
    expect(res.is_new_user).toBe(true);
    expect(res.user).toMatchObject({
      email: 'ada@example.com',
      full_name: 'Ada Lovelace',
      auth_provider: 'google',
      avatar_url: 'https://lh3.googleusercontent.com/a/ada',
    });
    expect(jwt.verify(res.access_token)).toMatchObject({ sub: res.user.id });
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0]).toMatchObject({
      firebase_uid: 'firebase-ada',
      email_verified: true,
      auth_provider: 'google',
    });
  });

  it('signs the same person in again to the same account, without creating another', async () => {
    const { service, users } = setup();
    const first = await service.googleAuth({ idToken: 't1' });
    const second = await service.googleAuth({ idToken: 't2' });
    expect(second.user.id).toBe(first.user.id);
    expect(second.is_new_user).toBe(false);
    expect(users.rows).toHaveLength(1);
  });

  it('gives a Google-only account no password anyone can use', async () => {
    const { service } = setup();
    await service.googleAuth({ idToken: 't' });
    for (const guess of [
      '',
      'password',
      'demo123',
      'a-long-password',
      'ada@example.com',
    ]) {
      expect(await statusOf(service.login('ada@example.com', guess))).toBe(401);
    }
  });

  it('takes identity from the verified token only: a body claiming another email, uid or name changes nothing', async () => {
    const { service, users } = setup();
    const res = await service.googleAuth({
      idToken: 't',
      email: 'victim@example.com',
      firebase_uid: 'victim-uid',
      full_name: 'Mallory',
      id: 'chosen',
      password: 'hunter2hunter2',
      auth_provider: 'password',
      email_verified: false,
    });
    expect(res.user.email).toBe('ada@example.com');
    expect(users.rows[0]).toMatchObject({
      email: 'ada@example.com',
      firebase_uid: 'firebase-ada',
      full_name: 'Ada Lovelace',
      auth_provider: 'google',
    });
    expect(users.rows[0].id).not.toBe('chosen');
    expect(
      await statusOf(service.login('victim@example.com', 'hunter2hunter2')),
    ).toBe(401);
  });

  it('applies the optional sign-up choices to a NEW account only, and never rewrites a returning person', async () => {
    const { service, users } = setup();
    await service.googleAuth({
      idToken: 't',
      persona_type: 'personal',
      business_name: 'Analytical Engines',
      monthly_income: 5000,
    });
    expect(users.rows[0]).toMatchObject({
      persona_type: 'personal',
      business_name: 'Analytical Engines',
      monthly_income: 5000,
    });
    await service.googleAuth({
      idToken: 't',
      persona_type: 'business',
      business_name: 'Changed',
      monthly_income: 1,
    });
    expect(users.rows[0]).toMatchObject({
      persona_type: 'personal',
      business_name: 'Analytical Engines',
      monthly_income: 5000,
    });
  });

  it('rejects invalid sign-up choices instead of storing them', async () => {
    const { service, users } = setup();
    expect(
      await statusOf(
        service.googleAuth({ idToken: 't', persona_type: 'admin' }),
      ),
    ).toBe(400);
    expect(
      await statusOf(
        service.googleAuth({ idToken: 't', monthly_income: 'lots' }),
      ),
    ).toBe(400);
    expect(users.rows).toHaveLength(0);
  });

  it('links an existing password account by verified email, keeps its data, and RETIRES the old password', async () => {
    const { service, users } = setup();
    await service.register({
      email: 'ada@example.com',
      password: 'registered-earlier',
      full_name: 'Ada (typed)',
      monthly_income: 900,
    });
    const before = users.rows[0].id;

    const res = await service.googleAuth({ idToken: 't' });
    expect(res.user.id).toBe(before); // same account: the data is still there
    expect(res.is_new_user).toBe(false);
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0]).toMatchObject({
      firebase_uid: 'firebase-ada',
      auth_provider: 'google',
      email_verified: true,
      monthly_income: 900,
      full_name: 'Ada (typed)',
    });
    // Whoever chose that password may have been someone who pre-registered a stranger's address: it must stop working.
    expect(
      await statusOf(service.login('ada@example.com', 'registered-earlier')),
    ).toBe(401);
  });

  it('matches the email case-insensitively when linking (older rows may have capitals)', async () => {
    const { service, users } = setup();
    users.rows.push({
      id: 'legacy',
      email: 'Ada@Example.com',
      password: await bcrypt.hash('legacy-password', 4),
      full_name: 'Ada',
      auth_provider: 'password',
    } as any);
    const res = await service.googleAuth({ idToken: 't' });
    expect(res.user.id).toBe('legacy');
    expect(users.rows).toHaveLength(1);
  });

  it('refuses to link an address that already belongs to a DIFFERENT Google account (409)', async () => {
    const { service, verifier, users } = setup();
    await service.googleAuth({ idToken: 't' });
    verifier.outcome = ada({ uid: 'another-firebase-uid' });
    expect(await statusOf(service.googleAuth({ idToken: 't' }))).toBe(409);
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0].firebase_uid).toBe('firebase-ada');
  });

  it("survives two first sign-ins racing (a double click): the loser gets the winner's account", async () => {
    const { service, users } = setup();
    users.beforeCreate = () => {
      users.beforeCreate = undefined;
      users.rows.push({
        id: 'winner',
        email: 'ada@example.com',
        password: 'x',
        full_name: 'Ada',
        firebase_uid: 'firebase-ada',
        auth_provider: 'google',
        email_verified: true,
      } as any);
    };
    const res = await service.googleAuth({ idToken: 't' });
    expect(res.user.id).toBe('winner');
    expect(res.is_new_user).toBe(false);
    expect(users.rows).toHaveLength(1);
  });

  it('fills a missing avatar for a returning person but never overwrites what is there', async () => {
    const { service, users, verifier } = setup();
    await service.googleAuth({ idToken: 't' });
    users.rows[0].avatar_url = 'https://example.com/mine.png';
    verifier.outcome = ada({
      picture: 'https://lh3.googleusercontent.com/a/new',
    });
    await service.googleAuth({ idToken: 't' });
    expect(users.rows[0].avatar_url).toBe('https://example.com/mine.png');
  });

  describe('when the token cannot be accepted', () => {
    it.each<[string, FirebaseTokenFailure, number, RegExp]>([
      ['is invalid', 'invalid', 401, /could not be verified/],
      ['has expired', 'expired', 401, /expired/],
      ['has an unverified email', 'email_unverified', 401, /not verified/],
      [
        'cannot be checked because Google is unreachable',
        'unavailable',
        503,
        /temporarily unavailable/,
      ],
      [
        'cannot be checked because Google sign-in is not configured',
        'not_configured',
        503,
        /not configured/,
      ],
    ])(
      'a token that %s gets %i and creates nothing',
      async (_label, failure, status, message) => {
        const { service, verifier, users } = setup();
        verifier.outcome = new FirebaseTokenError(
          failure,
          'detail that must not leak',
        );
        const err: any = await service
          .googleAuth({ idToken: 't' })
          .catch((e) => e);
        expect(err.getStatus()).toBe(status);
        expect(err.message).toMatch(message);
        expect(err.message).not.toContain('detail that must not leak');
        expect(users.rows).toHaveLength(0);
      },
    );

    it('an unexpected verifier crash is a 503, never a 500 with internals', async () => {
      const { service, verifier } = setup();
      verifier.outcome = new Error('socket hang up at 10.0.0.5');
      const err: any = await service
        .googleAuth({ idToken: 't' })
        .catch((e) => e);
      expect(err.getStatus()).toBe(503);
      expect(err.message).not.toContain('10.0.0.5');
    });

    it.each(['password', 'anonymous', 'github.com', 'unknown'])(
      'a valid token for the "%s" provider is refused: only Google is accepted',
      async (provider) => {
        const { service, verifier, users } = setup();
        verifier.outcome = ada({ provider });
        expect(await statusOf(service.googleAuth({ idToken: 't' }))).toBe(401);
        expect(users.rows).toHaveLength(0);
      },
    );

    it.each([[undefined], [null], [''], ['   '], [42], [{}], [['t']], [true]])(
      'a missing or non-string token (%p) is a 400 and never reaches the verifier',
      async (idToken) => {
        const { service, verifier } = setup();
        expect(await statusOf(service.googleAuth({ idToken }))).toBe(400);
        expect(await statusOf(service.googleAuth(undefined))).toBe(400);
        expect(verifier.tokens).toHaveLength(0);
      },
    );
  });
});
