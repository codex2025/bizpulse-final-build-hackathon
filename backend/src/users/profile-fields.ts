import { BadRequestException } from '@nestjs/common';
import { User } from './entities/user.entity';

export const PERSONAS = ['business', 'self_employed', 'personal', 'employee'] as const;

const MAX_MONEY = 1e12;

/** Fields a person may set on their own profile. Identity fields (id, email, password, firebase_uid...) are not among them. */
export type ProfileFields = Partial<
  Pick<User, 'full_name' | 'business_name' | 'gst_number' | 'persona_type' | 'job_title' | 'monthly_income' | 'monthly_expense'>
>;

function text(value: unknown, max: number, label: string, required = false): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw new BadRequestException(`${label} is required.`);
    return undefined;
  }
  if (typeof value !== 'string') throw new BadRequestException(`${label} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new BadRequestException(`${label} is required.`);
  if (trimmed.length > max) throw new BadRequestException(`${label} is too long (limit ${max} characters).`);
  return trimmed;
}

function money(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_MONEY) {
    throw new BadRequestException(`${label} must be a number between 0 and ${MAX_MONEY.toExponential(0)}.`);
  }
  return value;
}

/**
 * Validated copy of the profile fields found in `body`. Anything else in the body is ignored, so a request can never
 * write `email`, `password`, `firebase_uid` or `id` through a profile route (mass assignment).
 */
export function pickProfileFields(body: unknown, options: { requireName?: boolean } = {}): ProfileFields {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const out: ProfileFields = {};

  const fullName = text(source.full_name, 100, 'Full name', options.requireName);
  if (fullName !== undefined) {
    if (!fullName) throw new BadRequestException('Full name is required.');
    out.full_name = fullName;
  }
  const businessName = text(source.business_name, 150, 'Business name');
  if (businessName !== undefined) out.business_name = businessName;
  const gst = text(source.gst_number, 30, 'GST number');
  if (gst !== undefined) out.gst_number = gst;
  const jobTitle = text(source.job_title, 100, 'Job title');
  if (jobTitle !== undefined) out.job_title = jobTitle;

  if (source.persona_type !== undefined && source.persona_type !== null) {
    if (typeof source.persona_type !== 'string' || !(PERSONAS as readonly string[]).includes(source.persona_type)) {
      throw new BadRequestException(`Mode must be one of: ${PERSONAS.join(', ')}.`);
    }
    out.persona_type = source.persona_type;
  }
  const income = money(source.monthly_income, 'Monthly income');
  if (income !== undefined) out.monthly_income = income;
  const expense = money(source.monthly_expense, 'Monthly expense');
  if (expense !== undefined) out.monthly_expense = expense;
  return out;
}

/** The public view of a user: never the password hash or the Firebase uid. */
export function publicUser(user: User) {
  const { password, firebase_uid, ...rest } = user;
  return rest;
}
