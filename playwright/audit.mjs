/**
 * Mobile audit: navigate to one or more paths, capture viewport +
 * scrolled screenshots, and report horizontal overflow / overlap issues.
 * Used by `npm run audit` and the upgrade/compatibility workflow — see
 * ../upgrade_workflow.md.
 *
 * Usage: node audit.mjs <path> [<path> ...]
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';

const __dir = dirname(fileURLToPath(import.meta.url));

function readEnv(filePath) {
  if (!existsSync(filePath)) return {};
  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
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
if (TARGETS.length === 0)
  TARGETS.push('/dashboard/c/local/explorer/apps.deployment');

if (!PASS) {
  console.error(
    'No password found — set RANCHER_PASS or add password=xxx to .env',
  );
  process.exit(1);
}

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
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = {};
        try {
          json = JSON.parse(data);
        } catch {
          /* non-JSON body */
        }
        resolve({
          token: json.token,
          cookies: res.headers['set-cookie'] ?? [],
        });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

mkdirSync(join(__dir, 'screenshots'), { recursive: true });

const browser = await chromium.launch({
  ignoreHTTPSErrors: true,
  args: ['--disable-web-security'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  ignoreHTTPSErrors: true,
});

const auth = await getRancherToken(BASE, USER, PASS);
if (auth?.cookies?.length) {
  const domain = new URL(BASE).hostname;
  for (const raw of auth.cookies) {
    const name = raw.split(';')[0].split('=')[0].trim();
    const value = raw.split(';')[0].split('=').slice(1).join('=').trim();
    await ctx.addCookies([{ name, value, domain, path: '/' }]);
  }
}

const page = await ctx.newPage();
const results = {};

const OVERFLOW_CHECK = () => {
  const VW = window.innerWidth;
  const VH = window.innerHeight;

  // Intersect el's rect with all ancestor overflow:hidden/auto/scroll clip
  // boxes (and the viewport) to get the actually-visible rect. Returns null
  // if fully clipped/hidden.
  function visibleRect(el) {
    const cs0 = getComputedStyle(el);
    if (cs0.display === 'none' || cs0.visibility === 'hidden') return null;
    let rect = el.getBoundingClientRect();
    let r = {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
    let node = el.parentElement;
    while (node && node !== document.documentElement.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden') return null;
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const nr = node.getBoundingClientRect();
        if (cs.overflowX !== 'visible') {
          r.left = Math.max(r.left, nr.left);
          r.right = Math.min(r.right, nr.right);
        }
        if (cs.overflowY !== 'visible') {
          r.top = Math.max(r.top, nr.top);
          r.bottom = Math.min(r.bottom, nr.bottom);
        }
        if (r.right <= r.left || r.bottom <= r.top) return null;
      }
      node = node.parentElement;
    }
    r.left = Math.max(r.left, 0);
    r.top = Math.max(r.top, 0);
    if (r.right <= r.left || r.bottom <= r.top) return null;
    r.width = r.right - r.left;
    r.height = r.bottom - r.top;
    return r;
  }

  const overflowing = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right <= VW + 2) return;
    const vr = visibleRect(el);
    if (!vr) return; // fully clipped — not actually visible
    if (vr.right > VW + 2) {
      overflowing.push({
        tag: el.tagName,
        classes: [...el.classList].slice(0, 6).join(' '),
        x: Math.round(r.x),
        right: Math.round(r.right),
        w: Math.round(r.width),
        y: Math.round(r.y),
      });
    }
  });
  overflowing.sort((a, b) => b.right - a.right);

  // Overlap check: visible text leaf elements whose visible boxes
  // substantially overlap each other (real visual collisions).
  const overlaps = [];
  const candidates = [...document.querySelectorAll('body *')]
    .filter((el) => {
      if (el.children.length > 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 10 && r.height > 8 && el.textContent.trim().length > 0;
    })
    .map((el) => ({ el, vr: visibleRect(el) }))
    .filter(({ vr }) => vr && vr.width > 4 && vr.height > 4);

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i].vr;
      const b = candidates[j].vr;
      // Skip pairs on the same text line (inline wrapping causes
      // touching/overlapping bounding boxes that aren't real bugs)
      const sameLine =
        Math.abs(a.top - b.top) < 4 && Math.abs(a.bottom - b.bottom) < 4;
      if (sameLine) continue;
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 8 && iy > 8) {
        const overlapArea = ix * iy;
        const minArea = Math.min(a.width * a.height, b.width * b.height);
        if (overlapArea / minArea > 0.3) {
          const ea = candidates[i].el;
          const eb = candidates[j].el;
          overlaps.push({
            a: {
              tag: ea.tagName,
              text: ea.textContent.trim().slice(0, 30),
              classes: [...ea.classList].slice(0, 3).join(' '),
              rect: a,
            },
            b: {
              tag: eb.tagName,
              text: eb.textContent.trim().slice(0, 30),
              classes: [...eb.classList].slice(0, 3).join(' '),
              rect: b,
            },
          });
        }
      }
    }
  }

  return {
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    viewport: { w: VW, h: VH },
    overflowing: overflowing.slice(0, 10),
    overlapsCount: overlaps.length,
    overlaps: overlaps.slice(0, 10),
  };
};

for (const TARGET of TARGETS) {
  const slug =
    TARGET.replace(/^\//, '')
      .replace(/\//g, '_')
      .replace(/[^a-zA-Z0-9_.-]/g, '') || 'dashboard';
  console.log(`\n=== ${TARGET} ===`);
  const consoleErrors = [];
  const errHandler = (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  };
  page.on('console', errHandler);

  try {
    await page.goto(`${BASE}${TARGET}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2500);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(800);

    await page.screenshot({
      path: join(__dir, 'screenshots', `audit_${slug}_00.png`),
    });

    const overflowInfo = await page.evaluate(OVERFLOW_CHECK);

    // Scroll the main content area to capture below-the-fold
    const scrollMeta = await page.evaluate(() => {
      const main =
        document.querySelector('.main-layout') || document.scrollingElement;
      return {
        scrollHeight: main.scrollHeight,
        clientHeight: main.clientHeight,
      };
    });

    const shots = [`audit_${slug}_00.png`];
    const steps = Math.min(
      4,
      Math.ceil(scrollMeta.scrollHeight / scrollMeta.clientHeight) - 1,
    );
    for (let i = 1; i <= steps; i++) {
      await page.evaluate(
        ({ y, sel }) => {
          const main = document.querySelector(sel) || document.scrollingElement;
          main.scrollTo(0, y);
        },
        { y: scrollMeta.clientHeight * i, sel: '.main-layout' },
      );
      await page.waitForTimeout(400);
      const fname = `audit_${slug}_0${i}.png`;
      await page.screenshot({ path: join(__dir, 'screenshots', fname) });
      shots.push(fname);
    }

    results[TARGET] = {
      ...overflowInfo,
      scrollMeta,
      screenshots: shots,
      consoleErrors: [...new Set(consoleErrors)].slice(0, 5),
    };
    console.log(JSON.stringify(results[TARGET], null, 2));
  } catch (e) {
    results[TARGET] = { error: e.message };
    console.log('ERROR:', e.message);
  }
  page.off('console', errHandler);
}

writeFileSync(
  join(__dir, 'audit-results.json'),
  JSON.stringify(results, null, 2),
);
await browser.close();
console.log(
  '\nDone. See playwright/audit-results.json and playwright/screenshots/audit_*.png',
);
