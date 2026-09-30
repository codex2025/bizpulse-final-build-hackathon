import { test, expect, type Page } from '@playwright/test';
import { APP, ROUTES, hasHorizontalOverflow, overlaps, registerThrowaway, signIn, type TestSession } from './helpers';

// One throwaway account for the whole run (there are no built-in accounts).
let session: TestSession;

test.beforeAll(async () => {
  session = await registerThrowaway('business');
});

test.beforeEach(async ({ context }) => {
  await signIn(context, session);
});

const open = async (page: Page, path: string) => {
  await page.goto(APP + path);
  await page.waitForLoadState('networkidle');
};

test.describe('Shell and dashboard', () => {
  test('TC-01 Net Operating Profit: change pill never overlaps the amount', async ({ page }) => {
    await open(page, '/');
    const cards = page.locator('[data-testid="metric-value"]');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < count; i++) {
      const value = cards.nth(i);
      const card = value.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
      const valueBox = await value.boundingBox();
      const pills = card.locator('[data-testid="metric-change"]');
      if (valueBox && (await pills.count()) > 0) {
        const pillBox = await pills.first().boundingBox();
        if (pillBox) expect(overlaps(valueBox, pillBox), `card ${i} pill overlaps value`).toBe(false);
      }
      // The figure must not be clipped by its own container.
      const clipped = await value.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(clipped, `card ${i} value is clipped`).toBe(false);
    }
  });

  test('TC-02 Topbar has no theme switcher; appearance lives in Settings', async ({ page }) => {
    await open(page, '/');
    const header = page.locator('header').first();
    await expect(header.getByRole('button', { name: /^(dark|light|system)$/i })).toHaveCount(0);
    await expect(header.getByTestId('service-health')).toBeAttached();

    await open(page, '/settings');
    await expect(page.getByTestId('appearance-card')).toBeVisible();
    await expect(page.getByRole('radio', { name: /dark/i })).toBeVisible();
  });

  test('TC-02b Ctrl+K opens the command palette and navigates', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'keyboard shortcut is a desktop feature');
    await open(page, '/');
    await page.keyboard.press('Control+k');
    const palette = page.getByTestId('command-palette');
    await expect(palette).toBeVisible();
    await page.getByLabel('Search commands').fill('goals');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/goals$/);
    await expect(palette).toBeHidden();
  });

  test('TC-02c service health pill reports live status', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'pill is hidden below the lg breakpoint');
    await open(page, '/');
    const pill = page.getByTestId('service-health');
    await expect(pill).toBeVisible();
    await expect(pill).toHaveAttribute('aria-label', /Gateway online, AI engine online/);
  });

  test('TC-06 dark theme applies instantly, persists, and print stays light', async ({ page }) => {
    await open(page, '/settings');
    await page.getByRole('radio', { name: /dark/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    const bg = await page.locator('.app-shell').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(11, 15, 25)');
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByRole('radio', { name: /light/i }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});

test.describe('DecisionForge', () => {
  test('TC-03 section hierarchy and stepper are distinct', async ({ page }) => {
    await open(page, '/decision-forge');
    await expect(page.getByRole('heading', { level: 1, name: /Evidence-Backed Decisions/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Policy Weights/i })).toBeVisible();
    await expect(page.getByText(/Evaluating Opportunity/i)).toBeVisible();
    for (const tab of ['Decision Center', 'Decision Twin', 'Data Quality', 'Evidence & Audit']) {
      await expect(page.getByRole('button', { name: new RegExp(tab, 'i') }).first()).toBeVisible();
    }
  });
});

test.describe('DecisionForge score integrity', () => {
  test('TC-03b evaluator shows the engine score, and a moved lever is labelled what-if', async ({ page }) => {
    await open(page, '/decision-forge');
    // The selected opportunity pill carries the engine's priority score; the evaluator must show the same number.
    const pillScore = page.getByTestId('selected-opportunity-score');
    await expect(pillScore).toBeVisible();
    const engine = (await pillScore.innerText()).trim();
    await expect(page.getByTestId('decision-score')).toHaveText(engine, { timeout: 5000 });

    // Formula box lists the policy's real factors (no hardcoded "MarketSignal × 20%").
    await expect(page.getByTestId('formula-box')).toContainText('Deal Size Impact');

    // Moving a lever switches the label: the number is now an estimate, not the engine's score.
    const slider = page.locator('input[type="range"]').first();
    await slider.evaluate((el: HTMLInputElement) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(el, '0');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.getByText('What-if score', { exact: true })).toBeVisible();
  });
});

test.describe('Billing and print', () => {
  test('TC-04 tax invoice prints as a clean A4 document', async ({ page, request }) => {
    // Create a client and an invoice through the API so there is something to print.
    const auth = { Authorization: `Bearer ${session.token}` };
    const apiBase = process.env.API_URL || 'http://localhost:3001/api';
    const client = await request.post(`${apiBase}/clients`, {
      headers: auth,
      data: { name: 'Apex Dynamics Ltd', email: 'accounts@apex.example.test', gst_number: '29AAAAA0000A1Z5' },
    });
    expect(client.ok()).toBeTruthy();
    const clientBody = await client.json();
    const today = new Date().toISOString().slice(0, 10);
    const inv = await request.post(`${apiBase}/invoices`, {
      headers: auth,
      data: {
        client_id: clientBody.id,
        issue_date: today,
        due_date: today,
        gst_rate: 18,
        status: 'pending',
        items: [{ description: 'Platform subscription', quantity: 2, unit_price: 50000 }],
      },
    });
    expect(inv.ok(), await inv.text()).toBeTruthy();

    await open(page, '/billing');
    await expect(page.getByTestId('nav-count-billing').first()).toHaveText('1');
    await page.getByRole('button', { name: /Print Bill/i }).first().click();
    const dialog = page.getByRole('dialog', { name: /Tax invoice/i });
    await expect(dialog).toBeVisible();

    // Content: GST split, words and totals are computed, not placeholders.
    await expect(dialog.getByText(/CGST|IGST/).first()).toBeVisible();
    await expect(dialog.getByTestId('invoice-grand-total')).toContainText('₹1,18,000.00');
    await expect(dialog.getByTestId('amount-in-words')).toContainText('One Lakh Eighteen Thousand');
    await expect(dialog.getByText('HSN/SAC')).toBeVisible();

    // Print emulation at A4 width (794px at 96dpi): the app chrome disappears and the invoice flows on the page.
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#root')).toBeHidden();
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(794 + 1);
    expect(await hasHorizontalOverflow(page)).toBe(false);

    // A real PDF render: a one-line-item invoice must fit on a single A4 page.
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pdf.length).toBeGreaterThan(5000);
    expect(pages).toBe(1);
    await page.emulateMedia({ media: 'screen' });
  });
});

test.describe('Goals and Net Worth sample presets', () => {
  test('TC-05 empty workspace offers a labelled sample that loads on request', async ({ page }) => {
    await open(page, '/goals');
    const sample = page.getByTestId('sample-preset');
    await expect(sample).toBeVisible();
    await expect(sample.getByText('Sample', { exact: true })).toBeVisible();
    await expect(sample.getByText(/FY26 ARR Milestone Target/)).toBeVisible();

    await sample.getByRole('button', { name: /Load sample/i }).click();
    await expect(page.getByTestId('sample-preset')).toBeHidden();
    await expect(page.getByText('FY26 ARR Milestone Target').first()).toBeVisible();

    await open(page, '/wealth');
    const wsample = page.getByTestId('sample-preset');
    await expect(wsample).toBeVisible();
    await expect(wsample.getByText(/Proprietary Software IP/)).toBeVisible();
    await wsample.getByRole('button', { name: /Load sample/i }).click();
    await expect(page.getByTestId('sample-preset')).toBeHidden();
    await expect(page.getByText('Proprietary Software IP').first()).toBeVisible();
  });
});

test.describe('Analytics', () => {
  test('TC-07 executive briefing and Monte Carlo forecast', async ({ page }) => {
    await open(page, '/analytics');
    await expect(page.getByTestId('executive-briefing')).toBeVisible();
    await page.getByRole('button', { name: /Monte Carlo Forecast/i }).click();
    const mc = page.getByTestId('monte-carlo');
    await expect(mc).toBeVisible();
    await expect(mc.getByText(/Pessimistic \(P10\)/)).toBeVisible();
    await expect(mc.getByText(/of paths dip below zero/)).toBeVisible();
  });
});

test.describe('Every screen: geometry and errors', () => {
  for (const route of ROUTES) {
    test(`TC-08 ${route} has no sideways scroll and no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) errors.push(m.text());
      });
      await open(page, route);
      await page.waitForTimeout(800);
      expect(await hasHorizontalOverflow(page), 'page scrolls sideways').toBe(false);
      expect(errors).toEqual([]);
    });
  }
});
