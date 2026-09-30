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

test.describe('Contracts', () => {
  test('TC-09 a loan with an EMI never shows a zero principal', async ({ page }) => {
    await open(page, '/contracts');
    await page.getByRole('button', { name: /Load Sample MSE Agreement/i }).click();
    await page.getByRole('button', { name: /Extracted Information/i }).click({ timeout: 30_000 });
    const principal = page.getByText('Sanctioned Principal').locator('xpath=following-sibling::p[1]');
    await expect(principal).toBeVisible({ timeout: 30_000 });
    await expect(principal).not.toHaveText(/^₹0$/);
  });
});

test.describe('Contracts master-detail review', () => {
  test('TC-10 split view: document left, three isolated panels right', async ({ page }) => {
    await open(page, '/contracts');
    await page.getByRole('button', { name: /Try Sample/i }).first().click();
    const split = page.getByTestId('contract-split');
    await expect(split).toBeVisible({ timeout: 30_000 });
    for (const id of ['panel-scorecard', 'panel-radar', 'panel-obligations']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    // The score is a number 0-100 computed from the clause bands shown in the radar.
    const score = Number(await page.getByTestId('contract-risk-score').innerText());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    const counts = await Promise.all(
      ['critical', 'moderate', 'standard'].map(async (b) => Number(await page.getByTestId(`band-count-${b}`).innerText())),
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);

    // Search highlights matches in the document viewer.
    await page.getByLabel('Search the document').fill('interest');
    await expect(page.locator('[aria-label="Document viewer"] mark').first()).toBeVisible();

    // Desktop: two columns of (roughly) equal width. Mobile: stacked.
    const viewer = await page.locator('[aria-label="Document viewer"]').boundingBox();
    const scorecard = await page.getByTestId('panel-scorecard').boundingBox();
    expect(viewer && scorecard).toBeTruthy();
    if (page.viewportSize()!.width >= 1024) {
      expect(Math.abs(viewer!.width - scorecard!.width)).toBeLessThan(40);
      expect(scorecard!.x).toBeGreaterThan(viewer!.x + viewer!.width - 1);
    } else {
      expect(scorecard!.y).toBeGreaterThan(viewer!.y + viewer!.height - 1);
    }
  });
});

test.describe('DecisionForge stages and terms sandbox', () => {
  test('TC-11 four-stage stepper is derived from the run; terms sandbox recomputes exactly', async ({ page }) => {
    await open(page, '/decision-forge');
    const stepper = page.getByTestId('stage-stepper');
    await expect(stepper).toBeVisible();
    await expect(stepper.locator('li')).toHaveCount(4);
    await expect(stepper.locator('[data-stage="ingestion"]')).toHaveAttribute('data-state', 'done');
    await expect(stepper.locator('[data-stage="policy"]')).toHaveAttribute('data-state', 'done');

    await page.getByRole('button', { name: /Decision Twin/i }).first().click();
    const box = page.getByTestId('terms-sandbox');
    await expect(box).toBeVisible();
    const baseline = await box.getByTestId('terms-baseline').innerText();
    await expect(box.getByTestId('terms-scenario')).toHaveText(baseline); // unchanged = identical

    const setRange = (id: string, value: string) =>
      page.locator(`#${id}`).evaluate((el: HTMLInputElement, v: string) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
    await setRange('terms-discount', '10');
    await expect(box.getByTestId('terms-delta')).toHaveText(/^-\$/);
    await setRange('terms-discount', '0');
    await expect(box.getByTestId('terms-delta')).toHaveText(/^\+\$0$/);
  });

  test('TC-11b dashboard Review and Approve opens the approval dialog for that opportunity', async ({ page }) => {
    await open(page, '/');
    const stream = page.getByTestId('decision-stream');
    await expect(stream).toBeVisible();
    const first = stream.getByRole('button', { name: /Review & Approve/i }).first();
    await expect(first).toBeVisible({ timeout: 20_000 });
    await first.click();
    await expect(page).toHaveURL(/\/decision-forge$/);
    await expect(page.getByText(/Review Action for/i)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Analytics tabs', () => {
  test('TC-12 unit economics needs real inputs; expense allocation aggregates the ledger', async ({ page, request }) => {
    const auth = { Authorization: `Bearer ${session.token}` };
    const apiBase = process.env.API_URL || 'http://localhost:3001/api';
    const today = new Date().toISOString().slice(0, 10);
    for (const [category, description, amount] of [
      ['Cloud', 'AWS', 100000],
      ['Cloud', 'AWS', 50000],
      ['Ads', 'Google Ads', 50000],
    ] as const) {
      const r = await request.post(`${apiBase}/expenses`, { headers: auth, data: { category, description, amount, expense_date: today } });
      expect(r.ok()).toBeTruthy();
    }
    await open(page, '/analytics');

    await page.getByRole('button', { name: /^Unit Economics$/ }).click();
    const ue = page.getByTestId('unit-economics');
    await expect(ue).toBeVisible();
    // Nothing is invented: with no margin / churn entered the lifetime value is blank.
    await expect(ue.getByTestId('ue-ltv')).toHaveText('—');
    await ue.getByLabel('Gross margin').fill('80');
    await ue.getByLabel('Monthly customer churn').fill('2');
    await ue.getByLabel('Revenue per customer / month').fill('5000');
    await expect(ue.getByTestId('ue-ltv')).toHaveText('₹2,00,000');
    await ue.getByLabel('Acquisition spend').fill('100000');
    await ue.getByLabel('New customers in period').fill('10');
    await expect(ue.getByTestId('ue-cac')).toHaveText('₹10,000');
    await expect(ue.getByTestId('ue-ratio')).toHaveText('20.0 : 1');

    await page.getByRole('button', { name: /^Expense Allocation$/ }).click();
    const ea = page.getByTestId('expense-allocation');
    await expect(ea.getByTestId('expense-total')).toHaveText('₹2,00,000');
    await expect(ea.getByText('Cloud', { exact: true })).toBeVisible();
    await expect(ea.getByTestId('top3-share')).toHaveText('100%');
  });
});

test.describe('Expense CSV export', () => {
  test('TC-13 export is RFC 4180 and neutralises formulas', async ({ page, request }) => {
    const auth = { Authorization: `Bearer ${session.token}` };
    const apiBase = process.env.API_URL || 'http://localhost:3001/api';
    const r = await request.post(`${apiBase}/expenses`, {
      headers: auth,
      data: { category: 'Misc', description: '=HYPERLINK("http://x"),"quoted"', amount: 12.5, expense_date: new Date().toISOString().slice(0, 10) },
    });
    expect(r.ok()).toBeTruthy();
    await open(page, '/expenses');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export/i }).first().click()]);
    const { readFile } = await import('node:fs/promises');
    const text = (await readFile(await download.path(), 'utf8')).replace(/^﻿/, '');
    expect(text.split('\r\n')[0]).toBe('ID,Category,Description,Amount (INR),Date');
    expect(text).toContain(`"'=HYPERLINK(""http://x""),""quoted"""`);
    expect(text.endsWith('\r\n')).toBe(true);
  });
});

test.describe('Sample enterprise workspace (opt-in)', () => {
  test('TC-14 an empty dashboard offers it; loading creates ordinary records', async ({ browser }) => {
    const fresh = await registerThrowaway('business');
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 730 } });
    await signIn(ctx, fresh);
    const page = await ctx.newPage();
    await open(page, '/');
    const card = page.getByTestId('sample-workspace');
    await expect(card).toBeVisible();
    await expect(card.getByText('Sample', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: /Load sample workspace/i }).click();
    await expect(card).toBeHidden({ timeout: 120_000 });

    await open(page, '/billing');
    await expect(page.getByText('Apex Dynamics Ltd').first()).toBeVisible();
    await expect(page.getByText('Zenith Global Logistics').first()).toBeVisible();
    await expect(page.getByTestId('nav-count-billing').first()).toHaveText('4');

    // The three sample contracts are not loans: they are read clause by clause, with no invented loan figures.
    await expect(page.getByTestId('nav-count-contracts').first()).toHaveText('3');
    await open(page, '/contracts');
    await expect(page.getByTestId('contract-split')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Extracted Information/i })).toHaveCount(0);
    await expect(page.getByText('Sanctioned Principal')).toHaveCount(0);
    await expect(page.getByTestId('contract-jurisdiction')).toHaveText('India');
    await expect(page.getByTestId('panel-obligations')).toBeVisible();
    await ctx.close();
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
