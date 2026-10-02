import { HttpException } from '@nestjs/common';
import { PERSONAS, pickProfileFields, publicUser } from './profile-fields';
import { User } from './entities/user.entity';

const status = (fn: () => unknown) => {
  try {
    fn();
    return 200;
  } catch (err) {
    return err instanceof HttpException ? err.getStatus() : 500;
  }
};

describe('pickProfileFields', () => {
  it('keeps the profile fields and drops everything else (email, password, ids, the Google link...)', () => {
    const picked = pickProfileFields({
      full_name: ' Ada Lovelace ',
      business_name: 'Analytical Engines',
      gst_number: '27AAACG1234F1Z5',
      job_title: 'Founder',
      persona_type: 'self_employed',
      monthly_income: 5000,
      monthly_expense: 1200,
      email: 'someone.else@example.com',
      password: 'plain-text',
      id: 'other-user',
      firebase_uid: 'victims-uid',
      auth_provider: 'password',
      email_verified: true,
      avatar_url: 'https://evil.example/x.png',
      created_at: '1970-01-01',
    });
    expect(picked).toEqual({
      full_name: 'Ada Lovelace',
      business_name: 'Analytical Engines',
      gst_number: '27AAACG1234F1Z5',
      job_title: 'Founder',
      persona_type: 'self_employed',
      monthly_income: 5000,
      monthly_expense: 1200,
    });
  });

  it('returns nothing for a body that is not an object', () => {
    for (const body of [undefined, null, 'x', 42, [], true])
      expect(pickProfileFields(body)).toEqual({});
  });

  it.each(PERSONAS.map((p) => [p]))('accepts the mode "%s"', (persona) => {
    expect(pickProfileFields({ persona_type: persona })).toEqual({
      persona_type: persona,
    });
  });

  it.each([
    ['an unknown mode', { persona_type: 'admin' }],
    ['a non-text mode', { persona_type: 7 }],
    ['an empty name', { full_name: '   ' }],
    ['a name that is not text', { full_name: { $ne: 1 } }],
    ['an over-long name', { full_name: 'n'.repeat(101) }],
    ['an over-long business name', { business_name: 'b'.repeat(151) }],
    ['a negative income', { monthly_income: -1 }],
    ['an income that is text', { monthly_income: '5000' }],
    ['an infinite income', { monthly_expense: Infinity }],
    ['an absurd income', { monthly_income: 1e15 }],
    ['NaN', { monthly_income: NaN }],
  ])('rejects %s with 400', (_label, body) => {
    expect(status(() => pickProfileFields(body))).toBe(400);
  });

  it('can require a name (registration)', () => {
    expect(status(() => pickProfileFields({}, { requireName: true }))).toBe(
      400,
    );
    expect(
      pickProfileFields({ full_name: 'Ada' }, { requireName: true }),
    ).toEqual({ full_name: 'Ada' });
  });

  it('lets an empty business name through (a person may clear it) but not a null-prototype trick', () => {
    expect(pickProfileFields({ business_name: '' })).toEqual({
      business_name: '',
    });
    const hostile = JSON.parse(
      '{"__proto__": {"email": "x@y.z"}, "constructor": {"prototype": {}}, "full_name": "A"}',
    );
    const picked = pickProfileFields(hostile);
    expect(picked).toEqual({ full_name: 'A' });
    expect(({} as any).email).toBeUndefined();
  });
});

describe('publicUser', () => {
  it('never exposes the password hash or the Firebase uid', () => {
    const user = {
      id: '1',
      email: 'a@b.co',
      password: '$2a$10$hash',
      firebase_uid: 'uid-1',
      full_name: 'A',
      auth_provider: 'google',
    } as unknown as User;
    const view: any = publicUser(user);
    expect(view.password).toBeUndefined();
    expect(view.firebase_uid).toBeUndefined();
    expect(view).toMatchObject({
      id: '1',
      email: 'a@b.co',
      full_name: 'A',
      auth_provider: 'google',
    });
  });
});
