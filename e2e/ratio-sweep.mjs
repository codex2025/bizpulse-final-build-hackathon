// Screen-ratio sweep: every main route at many viewports. Reports sideways scroll, elements poking out of the
// viewport, text clipped by its own box, and console errors; saves screenshots to ./ratio-shots.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const API = process.env.API_URL || 'http://localhost:3001/api';
const APP = process.env.APP_URL || 'http://localhost:5173';
const VIEWPORTS = {
  'phone-se-375x667': [375, 667],
  'phone-14-390x844': [390, 844],
  'phone-land-844x390': [844, 390],
  'tablet-768x1024': [768, 1024],
  'tablet-land-1024x768': [1024, 768],
  'laptop-1280x720': [1280, 720],
  'laptop-1366x768': [1366, 768],
  'fhd-1920x1080': [1920, 1080],
  'ultrawide-2560x1080': [2560, 1080],
};
const ROUTES = ['/login', '/', '/decision-forge', '/billing', '/expenses', '/contracts', '/analytics', '/goals', '/wealth', '/settings'];

const email = `ratio-${Date.now()}@example.test`;
const reg = await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'Pw-ratio-Sweep1', full_name: 'Ratio', business_name: 'Ratio Labs', persona_type: 'business' }),
}).then((r) => r.json());
const token = reg.access_token;
fs.mkdirSync('ratio-shots', { recursive: true });

const browser = await chromium.launch();
const findings = [];
for (const [name, [w, h]] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([t]) => {
    try {
      if (!location.pathname.startsWith('/login')) localStorage.setItem('access_token', t);
      localStorage.setItem('bizpulse_persona', 'business');
      localStorage.setItem('bizpulse_account_persona', 'business');
      localStorage.setItem('bizpulse_active_view', 'business');
      localStorage.setItem('bizpulse_onboarded', 'true');
      localStorage.setItem('bizpulse_tour_completed_v1', 'skipped');
    } catch {}
  }, [token]);
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 140)));
    page.on('pageerror', (e) => errs.push('pageerror ' + String(e).slice(0, 140)));
    await page.goto(APP + route, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const overflowX = document.documentElement.scrollWidth - vw;
      const out = [];
      const clipped = [];
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        // ignore anything inside a horizontally scrollable container
        let p = el.parentElement, inScroller = false;
        while (p) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll' || o === 'hidden') && p.scrollWidth > p.clientWidth) { inScroller = true; break; } p = p.parentElement; }
        if (!inScroller && (b.right > vw + 2 || b.left < -2) && out.length < 4) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} L${Math.round(b.left)} R${Math.round(b.right)}`);
        if (el.children.length === 0 && el.textContent.trim() && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2 && cs.display !== 'inline' && clipped.length < 3)
          clipped.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}"`);
      }
      const tinyEls = [...document.querySelectorAll('button,a,[role=button],input,select')].filter((e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && cs.visibility !== 'hidden' && (b.height < 24 || b.width < 24); }); const tiny = tinyEls.length; const tinyDesc = tinyEls.slice(0,4).map((e) => e.tagName.toLowerCase() + ':' + (e.getAttribute('aria-label') || e.textContent.trim().slice(0,20) || String(e.className).slice(0,30)) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
      return { overflowX, out, clipped, tiny, tinyDesc, title: document.body.innerText.slice(0, 0) };
    });
    const path = route === '/' ? 'home' : route.slice(1);
    await page.screenshot({ path: `ratio-shots/${name}__${path}.png` }).catch(() => {});
    if (r.overflowX > 1 || r.out.length || r.clipped.length || errs.length || r.tiny > 0 && !r.hideTiny)
      findings.push({ vp: name, route, overflowX: r.overflowX, outside: r.out, clipped: r.clipped, smallTargets: r.tinyDesc, errs: [...new Set(errs)].slice(0, 3) });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(findings, null, 1));
console.log('findings:', findings.length);
