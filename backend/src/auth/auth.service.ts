import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { pickProfileFields } from '../users/profile-fields';
import { LoginThrottle } from './login-throttle';
import {
  FIREBASE_TOKEN_VERIFIER,
  FirebaseTokenError,
} from './firebase-token.verifier';
import type {
  FirebaseIdentity,
  FirebaseTokenVerifier,
} from './firebase-token.verifier';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt only uses the first 72 bytes; refuse rather than silently truncate

function cleanEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

function isUniqueViolation(err: any): boolean {
  return (
    err?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    err?.code === '23505' ||
    /UNIQUE constraint failed|duplicate key/i.test(err?.message || '')
  );
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash?: Promise<string>;
  private readonly throttle = new LoginThrottle();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(FIREBASE_TOKEN_VERIFIER) private verifier: FirebaseTokenVerifier,
  ) {}

  // ---- email + password ------------------------------------------------------------------------------------------

  async login(email: string, pass: string) {
    const normalized = cleanEmail(email);
    const wait = normalized ? this.throttle.retryAfterSeconds(normalized) : 0;
    if (wait > 0) {
      throw new HttpException(
        `Too many wrong passwords for this address. Try again in ${Math.ceil(wait / 60)} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const user = normalized
      ? await this.usersService.findByEmail(normalized)
      : null;
    // Always run one bcrypt comparison, so an unknown address costs the same as a wrong password.
    const matches = await bcrypt.compare(
      typeof pass === 'string' ? pass : '',
      user?.password || (await this.dummy()),
    );
    if (!user || !matches) {
      if (normalized) this.throttle.recordFailure(normalized);
      throw new UnauthorizedException('Invalid credentials');
    }
    this.throttle.recordSuccess(user.email);
    return this.session(user);
  }

  async register(dto: any) {
    const email = cleanEmail(dto?.email);
    if (!email) throw new BadRequestException('Enter a valid email address.');
    const password = dto?.password;
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`,
      );
    }
    // Only profile fields are taken from the body: never id, firebase_uid, auth_provider or email_verified.
    const profile = pickProfileFields(dto, { requireName: true });

    if (await this.usersService.findByEmail(email))
      throw new ConflictException('Email already exists');
    let user: User;
    try {
      user = await this.usersService.create({
        ...profile,
        email,
        password: await bcrypt.hash(password, 10),
        persona_type: profile.persona_type || 'business',
        auth_provider: 'password',
        email_verified: false,
      });
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException('Email already exists');
      throw err;
    }
    return this.session(user, true);
  }

  // ---- Google, through Firebase ----------------------------------------------------------------------------------

  /**
   * Signs a person in with Google (and creates the account on first use, so this is both "sign up" and "sign in").
   *
   * Who the person is comes ONLY from the verified Firebase ID token, never from the request body: the body may carry
   * the token and optional profile choices for a NEW account (mode, business name...), nothing about identity.
   */
  async googleAuth(dto: any) {
    const idToken = typeof dto?.idToken === 'string' ? dto.idToken.trim() : '';
    if (!idToken)
      throw new BadRequestException('A Google sign-in token is required.');
    const identity = await this.verifyIdentity(idToken);
    const { user, isNew } = await this.resolveGoogleUser(identity, dto);
    return this.session(user, isNew);
  }

  private async verifyIdentity(idToken: string): Promise<FirebaseIdentity> {
    try {
      const identity = await this.verifier.verify(idToken);
      if (identity.provider !== 'google.com') {
        this.logger.warn(
          `Rejected a sign-in that used the "${identity.provider}" provider`,
        );
        throw new UnauthorizedException('Only Google sign-in is supported.');
      }
      return identity;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      if (err instanceof FirebaseTokenError) {
        switch (err.failure) {
          case 'not_configured':
            throw new ServiceUnavailableException(
              'Google sign-in is not configured on this server.',
            );
          case 'unavailable':
            throw new ServiceUnavailableException(
              'Google sign-in is temporarily unavailable. Please try again.',
            );
          case 'expired':
            throw new UnauthorizedException(
              'Your Google sign-in expired. Please try again.',
            );
          case 'email_unverified':
            throw new UnauthorizedException(
              'Your Google account email address is not verified.',
            );
          default:
            this.logger.warn(`Rejected a Firebase ID token: ${err.message}`);
            throw new UnauthorizedException(
              'Google sign-in could not be verified. Please try again.',
            );
        }
      }
      this.logger.error(
        `Unexpected error while verifying a sign-in token: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Google sign-in is temporarily unavailable. Please try again.',
      );
    }
  }

  private async resolveGoogleUser(
    identity: FirebaseIdentity,
    dto: any,
    attempt = 0,
  ): Promise<{ user: User; isNew: boolean }> {
    const byUid = await this.usersService.findByFirebaseUid(identity.uid);
    if (byUid)
      return {
        user: await this.refreshFromIdentity(byUid, identity),
        isNew: false,
      };

    const byEmail = await this.usersService.findByEmail(identity.email);
    if (byEmail) {
      if (byEmail.firebase_uid && byEmail.firebase_uid !== identity.uid) {
        throw new ConflictException(
          'This email address is already linked to a different Google account.',
        );
      }
      return {
        user: await this.linkGoogleIdentity(byEmail, identity),
        isNew: false,
      };
    }

    // The optional choices made during sign-up apply to a NEW account only; a returning person never has them rewritten.
    const choices = pickProfileFields(dto);
    try {
      const user = await this.usersService.create({
        email: identity.email,
        password: await this.unusablePasswordHash(),
        full_name: identity.name || identity.email.split('@')[0],
        business_name: choices.business_name ?? '',
        job_title: choices.job_title ?? '',
        persona_type: choices.persona_type || 'business',
        monthly_income: choices.monthly_income ?? 0,
        firebase_uid: identity.uid,
        auth_provider: 'google',
        email_verified: true,
        avatar_url: identity.picture ?? null,
      });
      this.logger.log(`Created a Google account (user ${user.id})`);
      return { user, isNew: true };
    } catch (err) {
      // Two first sign-ins racing (a double click): the loser finds the winner's row instead of failing.
      if (isUniqueViolation(err) && attempt === 0)
        return this.resolveGoogleUser(identity, dto, 1);
      throw err;
    }
  }

  /** An existing account whose email a Google account has just proven ownership of. */
  private async linkGoogleIdentity(
    existing: User,
    identity: FirebaseIdentity,
  ): Promise<User> {
    const patch: Partial<User> = {
      firebase_uid: identity.uid,
      auth_provider: 'google',
      email_verified: true,
    };
    if (!existing.avatar_url && identity.picture)
      patch.avatar_url = identity.picture;
    if (!existing.full_name?.trim() && identity.name)
      patch.full_name = identity.name;
    if (existing.auth_provider !== 'google') {
      // This account was created with a password and its email was never verified: someone could have registered a
      // stranger's address in advance. Now that the real owner has proven the address through Google, the old
      // password is retired so it cannot be used to get into the account afterwards.
      patch.password = await this.unusablePasswordHash();
    }
    this.logger.log(
      `Linked a Google identity to existing account ${existing.id}`,
    );
    return (await this.usersService.update(existing.id, patch)) ?? existing;
  }

  /** A returning Google user: fill in blanks from Google, never overwrite what the person set themselves. */
  private async refreshFromIdentity(
    user: User,
    identity: FirebaseIdentity,
  ): Promise<User> {
    const patch: Partial<User> = {};
    if (!user.avatar_url && identity.picture)
      patch.avatar_url = identity.picture;
    if (!user.email_verified) patch.email_verified = true;
    if (!Object.keys(patch).length) return user;
    return (await this.usersService.update(user.id, patch)) ?? user;
  }

  // ---- helpers ---------------------------------------------------------------------------------------------------

  /** A bcrypt hash of a random value nobody knows: the "password" of an account that signs in with Google. */
  private unusablePasswordHash(): Promise<string> {
    return bcrypt.hash(randomBytes(32).toString('hex'), 10);
  }

  private dummy(): Promise<string> {
    this.dummyHash ??= bcrypt.hash('not-a-real-password', 10);
    return this.dummyHash;
  }

  private session(user: User, isNew = false) {
    return {
      access_token: this.jwtService.sign({ email: user.email, sub: user.id }),
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        business_name: user.business_name,
        persona_type: user.persona_type || 'business',
        job_title: user.job_title,
        monthly_income: user.monthly_income,
        avatar_url: user.avatar_url ?? null,
        auth_provider: user.auth_provider || 'password',
      },
      is_new_user: isNew,
    };
  }
}
