// Real-browser test of Google sign-up and sign-in through the Firebase Auth EMULATOR popup (no real Google account).
//
// App under test, all started for the emulator (see e2e/README.md):
//   frontend (APP_URL)  ->  gateway in emulator mode (GATEWAY_URL)  ->  ai-service, with the Auth emulator (EMULATOR_URL).
// Every run creates fresh accounts, so it can be repeated against the same emulator and database.
const { chromium } = require('playwright');

const APP = (process.env.APP_URL || 'http://localhost:5273').replace(/\/$/, '');
const EMULATOR = (process.env.EMULATOR_URL || 'http://127.0.0.1:9099').replace(/\/$/, '');
const GATEWAY = (process.env.GATEWAY_URL || 'http://localhost:3201/api').replace(/\/$/, '');
const HEADED = process.env.HEADED === '1';

const RUN = Date.now().toString(36);
const NEW_EMAIL = `pw.new.${RUN}@example.com`;
const NEW_NAME = `Playwright ${RUN}`;
const UNVERIFIED_EMAIL = `pw.unverified.${RUN}@example.com`;
const UNVERIFIED_NAME = `Unverified ${RUN}`;
const EMAIL_USER = `pw.email.${RUN}@example.com`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push([name, !!ok]);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? '  -- ' + detail : ''}`);
};

(async () => {
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: { width: 1360, height: 860 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|401|409|503|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200));
  });

  const token = () => page.evaluate(() => localStorage.getItem('access_token'));
  const onboarded = () => page.evaluate(() => localStorage.getItem('bizpulse_onboarded'));
  const profileOf = () =>
    page.evaluate(async (gateway) => {
      const r = await fetch(`${gateway}/users/profile`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('access_token') } });
      return r.json();
    }, GATEWAY);

  /** Clicks the Google button and returns the emulator popup that Firebase opens (it arrives as a new page in the context). */
  async function openPopup(path) {
    await page.goto(APP + path, { waitUntil: 'networkidle' });
    const [popup] = await Promise.all([context.waitForEvent('page', { timeout: 15000 }), page.click('[data-testid="google-sign-in"]')]);
    await popup.waitForLoadState('networkidle'); // the emulator page fetches its account list after it loads
    await popup.locator('#add-account-button').waitFor({ state: 'visible', timeout: 10000 });
    return popup;
  }
  /** Submits the emulator's form. It wires its buttons up a moment after they appear, so retry until the popup closes. */
  async function submitPopup(popup) {
    for (let attempt = 0; attempt < 3 && !popup.isClosed(); attempt++) {
      await popup.locator('#sign-in').click({ timeout: 5000 }).catch(() => {});
      await Promise.race([popup.waitForEvent('close').catch(() => {}), page.waitForTimeout(6000)]);
    }
  }
  async function newAccountInPopup(popup, email, name) {
    const emailInput = popup.locator('#email-input');
    for (let attempt = 0; attempt < 6 && !(await emailInput.isVisible()); attempt++) {
      await popup.locator('#add-account-button').click();
      await popup.waitForTimeout(500);
    }
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await emailInput.fill(email);
    await popup.locator('#display-name-input').fill(name);
    await submitPopup(popup);
  }
  async function chooseAccountInPopup(popup, name) {
    await popup.locator('#accounts-list').getByText(name).first().click();
    await Promise.race([popup.waitForEvent('close').catch(() => {}), page.waitForTimeout(8000)]);
  }

  console.log(`Google sign-in in a real browser (app ${APP}, gateway ${GATEWAY}, emulator ${EMULATOR})`);
  console.log('A. sign UP with Google (new account, from the register page)');
  let popup = await openPopup('/register');
  check("the popup is the emulator's Google account chooser", /Sign-in with Google\.com/.test(await popup.innerText('body')));
  await newAccountInPopup(popup, NEW_EMAIL, NEW_NAME);
  await page.waitForURL('**/onboarding', { timeout: 20000 });
  check('a new Google account lands on mode selection', page.url().endsWith('/onboarding'), page.url());
  check("the app holds the gateway's own session token", !!(await token()));
  // Firebase keeps its own signed-in user in IndexedDB; the app signs out of it right after exchanging the token.
  const firebaseUsersLeft = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open('firebaseLocalStorageDb');
        open.onerror = () => resolve(-1);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('firebaseLocalStorage')) return resolve(0);
          const count = db.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').count();
          count.onsuccess = () => resolve(count.result);
          count.onerror = () => resolve(-1);
        };
      }),
  );
  check('no Firebase session is left behind in the browser (the gateway session is the only one)', firebaseUsersLeft === 0, `records: ${firebaseUsersLeft}`);

  await page.click('text=Personal & Salaried Employee');
  await page.click('button:has-text("Complete Setup")');
  await page.waitForURL(APP + '/', { timeout: 20000 });
  check('mode selection leads to the dashboard', page.url() === APP + '/');
  check('onboarding is remembered for this account', (await onboarded()) === 'true');
  await page.waitForTimeout(1500);
  const dashboard = await page.innerText('body');
  check('the dashboard renders for a brand-new account (empty data, no crash)', dashboard.length > 200 && !/Application error|Something went wrong|Cannot read/i.test(dashboard));
  check('the greeting uses the person\'s own first name', dashboard.includes(`Good Day, ${NEW_NAME.split(' ')[0]}`));

  console.log('B. the new Google user can use DecisionForge');
  await page.goto(APP + '/decision-forge', { waitUntil: 'networkidle' });
  await page.waitForSelector('#decision-center-ask-input', { timeout: 20000 });
  await page.fill('#decision-center-ask-input', 'Which opportunities should we prioritize today?');
  await page.press('#decision-center-ask-input', 'Enter');
  await page.waitForSelector('text=to work first under policy', { timeout: 20000 });
  check('a Google user gets ranked recommendations', true);
  const profile = await profileOf();
  check(
    'the profile is the Google identity, without secrets',
    profile.email === NEW_EMAIL && profile.full_name === NEW_NAME && profile.auth_provider === 'google' && !('password' in profile) && !('firebase_uid' in profile),
    JSON.stringify({ email: profile.email, provider: profile.auth_provider }),
  );

  console.log('C. log out, then sign IN again with Google (login page)');
  await page.click('text=Logout');
  await page.waitForURL('**/login', { timeout: 15000 });
  check('logout clears the session', !(await token()));
  popup = await openPopup('/login');
  await chooseAccountInPopup(popup, NEW_NAME);
  await page.waitForURL(APP + '/', { timeout: 20000 });
  check('a returning Google user goes straight to the dashboard (no second mode selection)', page.url() === APP + '/' && (await onboarded()) === 'true');
  check('it is the SAME account as before', (await profileOf()).id === profile.id);

  console.log('D. what the person sees when it goes wrong');
  const fakeGoogleIdToken = JSON.stringify({ sub: 'unverified-' + RUN, email: UNVERIFIED_EMAIL, email_verified: false, name: UNVERIFIED_NAME });
  const created = await fetch(`${EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestUri: 'http://localhost', returnIdpCredential: true, returnSecureToken: true, postBody: `id_token=${fakeGoogleIdToken}&providerId=google.com` }),
  });
  check('(setup) an unverified-email Google account exists in the emulator', created.ok);
  await page.evaluate(() => localStorage.clear());
  popup = await openPopup('/login');
  await popup.close();
  await page.waitForSelector('text=Google sign-in was cancelled', { timeout: 30000 }); // Firebase notices a closed popup on a slow poll
  check('closing the popup shows "cancelled", not a crash', true);
  check('and the button works again afterwards', await page.$eval('[data-testid="google-sign-in"]', (b) => !b.disabled));

  popup = await openPopup('/login');
  await chooseAccountInPopup(popup, UNVERIFIED_NAME);
  await page.waitForFunction(() => /not verified/i.test(document.body.innerText), null, { timeout: 30000 });
  check('a Google account with an unverified email is refused with a clear message', !(await token()));

  console.log('E. the email + password path still works, and the seeded login is gone');
  await page.goto(APP + '/login', { waitUntil: 'networkidle' });
  check('no demo credentials are advertised on the login page', !/demo@bizpulse|demo123|Try demo/i.test(await page.innerText('body')));
  await page.fill('input[type=email]', 'demo@bizpulse.com');
  await page.fill('input[type=password]', 'demo123');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Invalid email or password', { timeout: 10000 });
  check('the old demo login is refused', !(await token()));

  await page.goto(APP + '/register', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="Full Name"]', 'Email Person');
  await page.fill('input[type=email]', EMAIL_USER);
  await page.fill('input[type=password]', 'a-decent-password');
  await page.click('button[type=submit]');
  await page.waitForURL('**/onboarding', { timeout: 20000 });
  check('email sign-up works and starts mode selection', !!(await token()));

  check('no unexpected errors in the browser console', errors.length === 0, errors.slice(0, 3).join(' | '));
  const failed = results.filter(([, ok]) => !ok).map(([n]) => n);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed` + (failed.length ? `; FAILED: ${JSON.stringify(failed)}` : ''));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('CRASHED', e.message);
  process.exit(1);
});
