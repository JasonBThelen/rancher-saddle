/**
 * Verify LOCAL mobile.css/mobile.js against the live Rancher instance by
 * intercepting /_saddle/* and serving the working-tree files instead of
 * the deployed ConfigMap versions. Screenshots + overflow check per page.
 *
 * Usage: node verify.mjs <path> [<path> ...]
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';

const __dir = dirname(fileURLToPath(import.meta.url));
function readEnv(p) {
  if (!existsSync(p)) return {};
  return Object.fromEntries(
    readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}
const env = readEnv(join(__dir, '..', '.env'));
const BASE =
  process.env.RANCHER_BASE ??
  env.RANCHER_BASE ??
  'https://rancher-mobile.int.thelenlab.com';
const USER = process.env.RANCHER_USER ?? env.RANCHER_USER ?? 'admin';
const PASS = process.env.RANCHER_PASS ?? env.password ?? env.RANCHER_PASS;
const TARGETS = process.argv.slice(2);
if (!TARGETS.length) TARGETS.push('/dashboard/c/local/explorer/event');

const CSS = readFileSync(
  join(__dir, '..', 'helm', 'rancher-saddle', 'files', 'mobile.css'),
  'utf8',
);
const JS = readFileSync(
  join(__dir, '..', 'helm', 'rancher-saddle', 'files', 'mobile.js'),
  'utf8',
);

function token(base, user, pass) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      username: user,
      password: pass,
      responseType: 'cookie',
    });
    const url = new URL(`${base}/v3-public/localProviders/local?action=login`);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        rejectUnauthorized: false,
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () =>
          resolve({ cookies: res.headers['set-cookie'] ?? [] }),
        );
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

mkdirSync(join(__dir, 'screenshots'), { recursive: true });
const browser = await chromium.launch({ ignoreHTTPSErrors: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  ignoreHTTPSErrors: true,
});

// Serve local saddle assets instead of the deployed ones.
await ctx.route('**/_saddle/mobile.css', (route) =>
  route.fulfill({ contentType: 'text/css', body: CSS }),
);
await ctx.route('**/_saddle/mobile.js', (route) =>
  route.fulfill({ contentType: 'application/javascript', body: JS }),
);

const auth = await token(BASE, USER, PASS);
const domain = new URL(BASE).hostname;
for (const raw of auth.cookies) {
  const name = raw.split(';')[0].split('=')[0].trim();
  const value = raw.split(';')[0].split('=').slice(1).join('=').trim();
  await ctx.addCookies([{ name, value, domain, path: '/' }]);
}
const page = await ctx.newPage();

const OVERFLOW = () => {
  const VW = window.innerWidth;
  const offenders = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right > VW + 2 && r.left < VW) {
      // crude: only count if not inside an overflow-scroll container
      let n = el.parentElement,
        clipped = false;
      while (n) {
        const cs = getComputedStyle(n);
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') {
          clipped = true;
          break;
        }
        n = n.parentElement;
      }
      if (!clipped)
        offenders.push({
          tag: el.tagName,
          cls: [...el.classList].slice(0, 4).join(' '),
          right: Math.round(r.right),
        });
    }
  });
  return {
    docScrollWidth: document.documentElement.scrollWidth,
    viewport: VW,
    pageOverflow: document.documentElement.scrollWidth > VW + 2,
    offenders: offenders.slice(0, 8),
  };
};

for (const TARGET of TARGETS) {
  const slug =
    TARGET.replace(/^\//, '')
      .replace(/\//g, '_')
      .replace(/[^a-zA-Z0-9_.-]/g, '') || 'dashboard';
  console.log(`\n=== ${TARGET} ===`);
  try {
    await page.goto(`${BASE}${TARGET}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2800);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(700);

    const cssLoaded = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="stylesheet"]')].some((l) =>
        l.href.includes('_saddle'),
      ),
    );
    await page.screenshot({
      path: join(__dir, 'screenshots', `verify_${slug}_00.png`),
    });
    await page.evaluate(() => {
      const m =
        document.querySelector('.main-layout') || document.scrollingElement;
      m.scrollTo(0, (m.clientHeight || 700) * 1);
    });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: join(__dir, 'screenshots', `verify_${slug}_01.png`),
    });

    const info = await page.evaluate(OVERFLOW);
    console.log('saddleCss:', cssLoaded, JSON.stringify(info));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

await browser.close();
console.log('\nDone. playwright/screenshots/verify_*.png');
