import { execSync } from 'child_process';
import { afterAll, beforeAll, expect, test } from 'vitest';

const PROXY_URL = 'http://localhost:18080';
const COMPOSE = 'docker compose -f tests/docker-compose.test.yml';

beforeAll(() => {
  execSync(`${COMPOSE} up -d --wait`, { stdio: 'pipe', timeout: 120_000 });
}, 120_000);

afterAll(() => {
  execSync(`${COMPOSE} down --remove-orphans`, {
    stdio: 'pipe',
    timeout: 30_000,
  });
}, 30_000);

test('injects mobile.css link into HTML head', async () => {
  const res = await fetch(PROXY_URL);
  const html = await res.text();
  expect(html).toContain('<link rel="stylesheet" href="/_saddle/mobile.css">');
});

test('injects mobile.js script into HTML head', async () => {
  const res = await fetch(PROXY_URL);
  const html = await res.text();
  expect(html).toContain('<script src="/_saddle/mobile.js" defer></script>');
});

test('strips Content-Security-Policy header from proxied response', async () => {
  const res = await fetch(PROXY_URL);
  expect(res.headers.get('content-security-policy')).toBeNull();
});

test('serves mobile.css from /_saddle/ with cache headers', async () => {
  const res = await fetch(`${PROXY_URL}/_saddle/mobile.css`);
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toMatch(/public/);
});

test('serves mobile.js from /_saddle/', async () => {
  const res = await fetch(`${PROXY_URL}/_saddle/mobile.js`);
  expect(res.status).toBe(200);
});
