/**
 * Rancher Saddle visual verifier
 *
 * Reads credentials from ../.env (password=xxx) or env vars.
 * Uses the Rancher token API for authentication (avoids form-fill issues
 * with special characters in passwords).
 *
 * Usage:
 *   node screenshot.mjs [url-path]
 *
 * Default path: /dashboard/c/local/explorer/apps.deployment
 * Viewport: 390x844 (iPhone 14 Pro)
 * Output: screenshots/*.png
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';

const __dir = dirname(fileURLToPath(import.meta.url));

// Parse .env file (key=value lines, no quotes needed)
function readEnv(filePath) {
  if (!existsSync(filePath)) return {};
  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
}

const env = readEnv(join(__dir, '..', '.env'));

const BASE = process.env.RANCHER_BASE ?? env.RANCHER_BASE ?? 'https://rancher-mobile.int.thelenlab.com';
const USER = process.env.RANCHER_USER ?? env.RANCHER_USER ?? 'admin';
const PASS = process.env.RANCHER_PASS ?? env.password ?? env.RANCHER_PASS;
const TARGET = process.argv[2] ?? '/dashboard/c/local/explorer/apps.deployment';

if (!PASS) {
  console.error('No password found — set RANCHER_PASS or add password=xxx to .env');
  process.exit(1);
}

console.log(`Base: ${BASE}`);
console.log(`User: ${USER}`);
console.log(`Path: ${TARGET}`);

// Authenticate via Rancher API to get a token (avoids form-fill quirks)
async function getRancherToken(base, user, pass) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      username: user,
      password: pass,
      responseType: 'cookie',
    });
    const url = new URL(`${base}/v3-public/localProviders/local?action=login`);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      rejectUnauthorized: false,
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        console.log(`  API status: ${res.statusCode}, body length: ${data.length}`);
        if (res.statusCode >= 400) {
          reject(new Error(`Auth failed ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        let json = {};
        try { json = JSON.parse(data); } catch { /* non-JSON body */ }
        resolve({ token: json.token, cookies: res.headers['set-cookie'] ?? [] });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

mkdirSync(join(__dir, 'screenshots'), { recursive: true });
const slug = TARGET.replace(/^\//, '').replace(/\//g, '_') || 'dashboard';

console.log('\nAuthenticating via API …');
let authResult;
try {
  authResult = await getRancherToken(BASE, USER, PASS);
  console.log('Token obtained:', authResult.token ? authResult.token.slice(0, 20) + '…' : '(cookie only)');
} catch (e) {
  console.error('API auth failed:', e.message);
  console.log('Falling back to form login …');
  authResult = null;
}

const browser = await chromium.launch({ ignoreHTTPSErrors: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  ignoreHTTPSErrors: true,
});

// Inject cookies from API auth
if (authResult?.cookies?.length) {
  const domain = new URL(BASE).hostname;
  for (const raw of authResult.cookies) {
    const name = raw.split(';')[0].split('=')[0].trim();
    const value = raw.split(';')[0].split('=').slice(1).join('=').trim();
    await ctx.addCookies([{ name, value, domain, path: '/' }]);
  }
  console.log('Cookies injected:', authResult.cookies.length);
} else if (authResult?.token) {
  // Set as Authorization header via extra headers — won't work for SPA but set cookie instead
  await ctx.addCookies([{
    name: 'R_SESS',
    value: authResult.token,
    domain: new URL(BASE).hostname,
    path: '/',
  }]);
  console.log('R_SESS cookie set');
}

const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(err.message));

// If API auth didn't give us cookies, fall back to form login
if (!authResult?.cookies?.length && !authResult?.token) {
  console.log('\nForm login …');
  await page.goto(`${BASE}/dashboard/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.locator('input[type="text"]').first().fill(USER);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.screenshot({ path: `screenshots/${slug}_01_login_filled.png` });
  await page.locator('button[type="submit"], .btn-primary').first().click();
  await page.waitForURL('**/dashboard/**', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
}

// Navigate to target
console.log(`\nNavigating to ${BASE}${TARGET} …`);
await page.goto(`${BASE}${TARGET}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
// Wait for the content to settle — Rancher SPA needs time after auth redirect
await page.waitForTimeout(3000);
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(1000);

await page.screenshot({ path: `screenshots/${slug}_01_viewport.png`, fullPage: false });
await page.screenshot({ path: `screenshots/${slug}_02_full.png`, fullPage: true });

// Diagnostics
const cssLoaded = await page.evaluate(() =>
  [...document.querySelectorAll('link[rel="stylesheet"]')].some(l => l.href.includes('_saddle'))
);
console.log('\nSaddle CSS injected:', cssLoaded);

const info = await page.evaluate(() => {
  const q = s => {
    const el = document.querySelector(s);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      overflowX: cs.overflowX,
      overflowY: cs.overflowY,
      gridTemplateColumns: cs.gridTemplateColumns,
      position: cs.position,
      minWidth: cs.minWidth,
      width: cs.width,
      maxWidth: cs.maxWidth,
      offsetWidth: el.offsetWidth,
      classList: [...el.classList].join(' '),
    };
  };
  const lastTh = document.querySelector('.sortable-table thead tr th:last-child');
  const lastTd = document.querySelector('.sortable-table tbody tr td:last-child');

  // Walk up from .main-layout to find where width expands
  const chain = [];
  let el = document.querySelector('.main-layout');
  while (el && el !== document.body.parentElement) {
    const cs = getComputedStyle(el);
    chain.push({
      tag: el.tagName,
      id: el.id,
      classes: [...el.classList].slice(0, 4).join(' '),
      offsetWidth: el.offsetWidth,
      minWidth: cs.minWidth,
      overflowX: cs.overflowX,
    });
    el = el.parentElement;
  }

  // Find the left nav element(s)
  const navEls = [...document.querySelectorAll('[class*="nav"], [class*="sidebar"], [class*="side"]')]
    .map(e => ({ tag: e.tagName, classes: [...e.classList].join(' '), offsetWidth: e.offsetWidth, offsetLeft: e.offsetLeft }))
    .filter(e => e.offsetWidth > 0 && e.offsetWidth < 100);

  return {
    currentURL: location.href,
    viewportWidth: window.innerWidth,
    bodyOffsetWidth: document.body.offsetWidth,
    dashboardContent: q('.dashboard-content'),
    mainLayout: q('.main-layout'),
    sideNav: q('.side-nav'),
    sortableTable: q('.sortable-table'),
    lastThPosition: lastTh ? getComputedStyle(lastTh).position : null,
    lastTdPosition: lastTd ? getComputedStyle(lastTd).position : null,
    rowCount: document.querySelectorAll('.sortable-table tbody tr').length,
    widthChain: chain,
    narrowNavElements: navEls.slice(0, 5),
    titleInfo: (() => {
      const header = document.querySelector('header.with-subheader');
      if (!header) return 'no header.with-subheader';
      const hcs = getComputedStyle(header);
      const title = header.querySelector('.title');
      const tcs = title ? getComputedStyle(title) : null;
      return {
        headerGrid: hcs.gridTemplateColumns,
        headerGridAreas: hcs.gridTemplateAreas,
        headerGap: hcs.columnGap,
        headerPadding: `${hcs.paddingLeft} ${hcs.paddingRight}`,
        headerWidth: header.offsetWidth,
        title: tcs ? {
          offsetWidth: title.offsetWidth,
          justifySelf: tcs.justifySelf,
          alignSelf: tcs.alignSelf,
          padding: `${tcs.paddingTop} ${tcs.paddingRight} ${tcs.paddingBottom} ${tcs.paddingLeft}`,
          maxWidth: tcs.maxWidth,
          flex: tcs.flex,
          flexShrink: tcs.flexShrink,
          flexGrow: tcs.flexGrow,
          flexBasis: tcs.flexBasis,
          width: tcs.width,
        } : null,
      };
    })(),
  };
});

console.log('\nComputed styles:');
console.log(JSON.stringify(info, null, 2));

if (consoleErrors.length) {
  console.log('\nConsole errors (first 5):');
  consoleErrors.slice(0, 5).forEach(e => console.log(' ', e));
}

await browser.close();
console.log(`\nScreenshots: playwright/screenshots/${slug}_*.png`);
