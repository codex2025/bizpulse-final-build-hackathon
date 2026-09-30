import type { Page, BrowserContext } from '@playwright/test';

export const APP = process.env.APP_URL || 'http://localhost:5173';
export const API = process.env.API_URL || 'http://localhost:3001/api';

export const DESKTOP = { width: 1536, height: 730 };
export const MOBILE = { width: 375, height: 667 };

export const ROUTES = [
  '/',
  '/decision-forge',
  '/billing',
  '/expenses',
  '/contracts',
  '/analytics',
  '/goals',
  '/wealth',
  '/settings',
] as const;

export interface TestSession {
  token: string;
  email: string;
  persona: string;
}

/** Registers a throwaway account through the public API (there are no built-in accounts). */
export async function registerThrowaway(persona = 'business'): Promise<TestSession> {
  const email = `ui-audit-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: `Pw-${Math.random().toString(36).slice(2)}-A1`,
      full_name: 'UI Audit',
      business_name: 'Audit Labs',
      persona_type: persona,
    }),
  });
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; user: { persona_type?: string } };
  return { token: data.access_token, email, persona: data.user.persona_type || persona };
}

/** Signs the browser in the same way the app does, and marks onboarding as done. */
export async function signIn(context: BrowserContext, session: TestSession): Promise<void> {
  await context.addInitScript(
    ([token, persona]) => {
      try {
        localStorage.setItem('access_token', token);
        localStorage.setItem('bizpulse_persona', persona);
        localStorage.setItem('bizpulse_account_persona', persona);
        localStorage.setItem('bizpulse_active_view', persona);
        localStorage.setItem('bizpulse_onboarded', 'true');
        localStorage.setItem('bizpulse_tour_completed_v1', 'skipped');
      } catch {
        /* storage blocked */
      }
    },
    [session.token, session.persona],
  );
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const overlaps = (a: Box, b: Box): boolean =>
  !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);

/** True when the page scrolls sideways (something is wider than the viewport). */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}
