/**
 * List internal dashboard routes (hrefs) found on one or more pages.
 *
 * Rancher's left nav and resource-type slugs (e.g.
 * `apps.deployment`, `catalog.cattle.io.app`) can change between Rancher
 * versions. Run this against a new Rancher release to discover the
 * current routes before building an audit.mjs target list.
 *
 * Usage: node list-routes.mjs [<page-path> ...]
 *   Defaults to crawling the cluster explorer nav and the Apps &
 *   Marketplace landing page.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
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
const PAGES = process.argv.slice(2);
if (PAGES.length === 0) {
  PAGES.push('/dashboard/c/local/explorer', '/dashboard/c/local/apps/charts');
}

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

const browser = await chromium.launch({ ignoreHTTPSErrors: true });
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
const routes = new Map();

for (const target of PAGES) {
  console.log(`\n=== ${target} ===`);
  try {
    await page.goto(`${BASE}${target}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);

    const links = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="/dashboard"]')].map((a) => ({
        href: a.getAttribute('href'),
        text: a.textContent.trim().replace(/\s+/g, ' '),
      })),
    );

    for (const { href, text } of links) {
      if (!routes.has(href)) routes.set(href, text);
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

console.log(`\n${routes.size} unique routes:`);
[...routes.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([href, text]) =>
    console.log(`${href}${text ? `  —  ${text}` : ''}`),
  );

await browser.close();
