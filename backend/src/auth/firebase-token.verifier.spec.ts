import {
  SignJWT,
  UnsecuredJWT,
  createLocalJWKSet,
  errors as joseErrors,
  exportJWK,
  generateKeyPair,
  JWTPayload,
  KeyLike,
} from 'jose';
import {
  EmulatorFirebaseVerifier,
  FirebaseTokenError,
  JwksFirebaseVerifier,
  NotConfiguredFirebaseVerifier,
  createFirebaseVerifier,
} from './firebase-token.verifier';

/**
 * Real RS256 tokens signed with locally generated keys and verified through a local key set (the same code path as
 * Google's published keys, without the network), so signature and claim checks are genuinely exercised.
 */
const PROJECT = 'bizpulse-test';
const KID = 'test-key-1';

let privateKey: KeyLike;
let otherPrivateKey: KeyLike;
let verifier: JwksFirebaseVerifier;
let publicJwk: any;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  const other = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  otherPrivateKey = other.privateKey;
  publicJwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: KID,
    alg: 'RS256',
    use: 'sig',
  };
  verifier = new JwksFirebaseVerifier(
    PROJECT,
    createLocalJWKSet({ keys: [publicJwk] }),
  );
});

const now = () => Math.floor(Date.now() / 1000);

function claims(overrides: Record<string, any> = {}): JWTPayload {
  const base: Record<string, any> = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: 'firebase-uid-123',
    auth_time: now() - 30,
    iat: now() - 30,
    exp: now() + 3600,
    email: 'Ada.Lovelace@Example.com',
    email_verified: true,
    name: 'Ada Lovelace',
    picture: 'https://lh3.googleusercontent.com/a/photo',
    firebase: {
      sign_in_provider: 'google.com',
      identities: { 'google.com': ['1234'] },
    },
    ...overrides,
  };
  for (const key of Object.keys(base))
    if (base[key] === undefined) delete base[key]; // an override of undefined removes the claim
  return base;
}

async function mint(
  overrides: Record<string, any> = {},
  options: { key?: KeyLike; header?: Record<string, any> } = {},
) {
  return new SignJWT(claims(overrides))
    .setProtectedHeader({
      alg: 'RS256',
      kid: KID,
      typ: 'JWT',
      ...options.header,
    })
    .sign(options.key ?? privateKey);
}

async function failureOf(token: string) {
  try {
    await verifier.verify(token);
  } catch (err) {
    expect(err).toBeInstanceOf(FirebaseTokenError);
    return (err as FirebaseTokenError).failure;
  }
  throw new Error('expected the token to be rejected');
}

describe('a valid Firebase ID token', () => {
  it('yields the identity from the token: uid, lowercased email, name, picture and provider', async () => {
    expect(await verifier.verify(await mint())).toEqual({
      uid: 'firebase-uid-123',
      email: 'ada.lovelace@example.com',
      emailVerified: true,
      name: 'Ada Lovelace',
      picture: 'https://lh3.googleusercontent.com/a/photo',
      provider: 'google.com',
    });
  });

  it('drops a picture that is not an https URL and an over-long name instead of storing them', async () => {
    const identity = await verifier.verify(
      await mint({ picture: 'javascript:alert(1)', name: 'x'.repeat(101) }),
    );
    expect(identity.picture).toBeUndefined();
    expect(identity.name).toBeUndefined();
  });

  it('reports whatever provider the token was issued for; the caller decides which are allowed', async () => {
    const identity = await verifier.verify(
      await mint({ firebase: { sign_in_provider: 'password' } }),
    );
    expect(identity.provider).toBe('password');
  });
});

describe('a token that must be rejected', () => {
  it('is expired', async () => {
    expect(
      await failureOf(
        await mint({
          exp: now() - 3600,
          iat: now() - 7200,
          auth_time: now() - 7200,
        }),
      ),
    ).toBe('expired');
  });

  it.each([
    ['another project (audience)', { aud: 'someone-elses-project' }],
    [
      'another issuer',
      { iss: 'https://securetoken.google.com/someone-elses-project' },
    ],
    ['a look-alike issuer', { iss: `https://accounts.google.com/${PROJECT}` }],
    ['no subject', { sub: undefined }],
    ['an empty subject', { sub: '' }],
    ['a subject longer than 128 characters', { sub: 'u'.repeat(129) }],
    ['a numeric subject', { sub: 12345 }],
    ['a future auth_time', { auth_time: now() + 3600 }],
    ['no auth_time', { auth_time: undefined }],
    ['a not-before in the future', { nbf: now() + 3600 }],
    ['no email', { email: undefined }],
    ['an email with no @', { email: 'not-an-email' }],
  ])('has %s', async (_label, overrides) => {
    expect(await failureOf(await mint(overrides as any))).toBe('invalid');
  });

  it('has an unverified email (reported separately so the message can say why)', async () => {
    expect(await failureOf(await mint({ email_verified: false }))).toBe(
      'email_unverified',
    );
    expect(await failureOf(await mint({ email_verified: 'true' as any }))).toBe(
      'email_unverified',
    );
    expect(await failureOf(await mint({ email_verified: undefined }))).toBe(
      'email_unverified',
    );
  });

  it('was signed with a different key than the published one, even under the right key id', async () => {
    expect(await failureOf(await mint({}, { key: otherPrivateKey }))).toBe(
      'invalid',
    );
  });

  it('names a key id that is not published', async () => {
    expect(
      await failureOf(await mint({}, { header: { kid: 'unknown-kid' } })),
    ).toBe('invalid');
  });

  it('is unsigned (alg "none")', async () => {
    const unsigned = new UnsecuredJWT(claims()).encode();
    expect(await failureOf(unsigned)).toBe('invalid');
  });

  it('is HS256 signed with the public key as the secret (algorithm confusion)', async () => {
    const asSecret = new TextEncoder().encode(JSON.stringify(publicJwk));
    const forged = await new SignJWT(claims())
      .setProtectedHeader({ alg: 'HS256', kid: KID })
      .sign(asSecret);
    expect(await failureOf(forged)).toBe('invalid');
  });

  it('has been tampered with after signing', async () => {
    const [header, , signature] = (await mint()).split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify(claims({ email: 'victim@example.com' })),
    ).toString('base64url');
    expect(await failureOf(`${header}.${forgedPayload}.${signature}`)).toBe(
      'invalid',
    );
  });

  it.each([
    ['empty', ''],
    ['not a JWT', 'not-a-token-at-all-but-long-enough'],
    ['two parts', 'aaaaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
    ['too short', 'a.b.c'],
    ['oversized', 'a'.repeat(5000)],
  ])('is %s', async (_label, token) => {
    expect(await failureOf(token)).toBe('invalid');
  });

  it.each([[undefined], [null], [12345], [{}], [['a', 'b', 'c']]])(
    'is not even a string (%p)',
    async (value) => {
      expect(await failureOf(value as any)).toBe('invalid');
    },
  );
});

describe("when Google's key service cannot be reached", () => {
  it.each([
    ['a timeout', () => new joseErrors.JWKSTimeout()],
    ['a network failure', () => new TypeError('fetch failed')],
    ['a bad key-set response', () => new joseErrors.JWKSInvalid('no keys')],
    ['an unexpected error', () => new Error('boom')],
  ])(
    '%s is "unavailable", not "invalid", so people are not told their sign-in is bad',
    async (_label, make) => {
      const flaky = new JwksFirebaseVerifier(PROJECT, (async () => {
        throw make();
      }) as any);
      await expect(flaky.verify(await mint())).rejects.toMatchObject({
        failure: 'unavailable',
      });
    },
  );
});

describe('createFirebaseVerifier', () => {
  it('uses the key-based verifier when a project id is configured', () => {
    expect(
      createFirebaseVerifier({
        projectId: 'my-project',
        nodeEnv: 'production',
      }),
    ).toBeInstanceOf(JwksFirebaseVerifier);
  });

  it('is "not configured" (a clear 503 later, not a crash) without a project id', async () => {
    const v = createFirebaseVerifier({
      projectId: '  ',
      nodeEnv: 'development',
    });
    expect(v).toBeInstanceOf(NotConfiguredFirebaseVerifier);
    await expect(v.verify('whatever')).rejects.toMatchObject({
      failure: 'not_configured',
    });
  });

  it('REFUSES TO START with the emulator switch set in production (the emulator accepts unsigned tokens)', () => {
    expect(() =>
      createFirebaseVerifier({
        projectId: 'p',
        emulatorHost: '127.0.0.1:9099',
        nodeEnv: 'production',
      }),
    ).toThrow(/refusing to start/);
  });

  it('allows the emulator only outside production', () => {
    expect(
      createFirebaseVerifier({
        emulatorHost: '127.0.0.1:9099',
        nodeEnv: 'development',
      }),
    ).toBeInstanceOf(EmulatorFirebaseVerifier);
  });
});

describe('EmulatorFirebaseVerifier (local development only)', () => {
  const emulatorToken = () =>
    new UnsecuredJWT({
      aud: PROJECT,
      sub: 'emu-1',
      iss: `https://securetoken.google.com/${PROJECT}`,
    }).encode();
  const reply = (status: number, body: any) =>
    (async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })) as any;
  const goodUser = {
    localId: 'emu-1',
    email: 'Tester@Example.com',
    emailVerified: true,
    displayName: 'Emu Tester',
    photoUrl: 'https://example.com/p.png',
    providerUserInfo: [{ providerId: 'google.com' }],
  };

  it('asks the emulator to look the token up and maps the answer', async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({ users: [goodUser] }),
      };
    }) as any;
    const identity = await new EmulatorFirebaseVerifier(
      '127.0.0.1:9099',
      PROJECT,
      fetchImpl,
    ).verify(emulatorToken());
    expect(identity).toEqual({
      uid: 'emu-1',
      email: 'tester@example.com',
      emailVerified: true,
      name: 'Emu Tester',
      picture: 'https://example.com/p.png',
      provider: 'google.com',
    });
    expect(calls[0].url).toBe(
      'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=emulator',
    );
    expect(calls[0].body.idToken).toBeTruthy();
  });

  it('rejects a token minted for another project without asking the emulator', async () => {
    let asked = false;
    const fetchImpl = (async () => {
      asked = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({ users: [goodUser] }),
      };
    }) as any;
    const foreign = new UnsecuredJWT({
      aud: 'other-project',
      sub: 'x',
    }).encode();
    await expect(
      new EmulatorFirebaseVerifier('h:1', PROJECT, fetchImpl).verify(foreign),
    ).rejects.toMatchObject({ failure: 'invalid' });
    expect(asked).toBe(false);
  });

  it.each([
    ['the emulator rejects the token', reply(400, { error: {} }), 'invalid'],
    ['the emulator knows no such user', reply(200, { users: [] }), 'invalid'],
    [
      'the email is unverified',
      reply(200, { users: [{ ...goodUser, emailVerified: false }] }),
      'email_unverified',
    ],
    [
      'the emulator is not running',
      (async () => {
        throw new TypeError('fetch failed');
      }) as any,
      'unavailable',
    ],
  ])('when %s', async (_label, fetchImpl, failure) => {
    await expect(
      new EmulatorFirebaseVerifier('h:1', PROJECT, fetchImpl).verify(
        emulatorToken(),
      ),
    ).rejects.toMatchObject({ failure });
  });
});
