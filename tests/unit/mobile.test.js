import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, beforeEach, expect, test } from 'vitest';

const __dir = dirname(fileURLToPath(import.meta.url));
const mobileJs = readFileSync(join(__dir, '../../overlay/mobile.js'), 'utf8');

// Run the mobile.js IIFE once in this jsdom environment.
// It attaches a MutationObserver to document.body and patches history.
beforeAll(() => {
  // mobile.js check() requires both <header> and .side-nav to exist
  const header = document.createElement('header');
  document.body.appendChild(header);
  const nav = document.createElement('div');
  nav.className = 'side-nav';
  document.body.appendChild(nav);

  eval(mobileJs);
});

beforeEach(() => {
  // Reset open state between tests without re-evaluating the IIFE
  document.body.classList.remove('rs-nav-open');
  document
    .getElementById('rs-hamburger')
    ?.setAttribute('aria-expanded', 'false');
});

test('creates hamburger button with correct ARIA attributes', () => {
  const btn = document.getElementById('rs-hamburger');
  expect(btn).not.toBeNull();
  expect(btn.getAttribute('aria-label')).toBe('Toggle navigation');
  expect(btn.getAttribute('aria-expanded')).toBe('false');
});

test('creates backdrop with aria-hidden', () => {
  const backdrop = document.getElementById('rs-backdrop');
  expect(backdrop).not.toBeNull();
  expect(backdrop.getAttribute('aria-hidden')).toBe('true');
});

test('hamburger click opens nav and sets aria-expanded true', () => {
  const btn = document.getElementById('rs-hamburger');
  btn.click();
  expect(document.body.classList.contains('rs-nav-open')).toBe(true);
  expect(btn.getAttribute('aria-expanded')).toBe('true');
});

test('second hamburger click closes nav', () => {
  const btn = document.getElementById('rs-hamburger');
  btn.click();
  btn.click();
  expect(document.body.classList.contains('rs-nav-open')).toBe(false);
  expect(btn.getAttribute('aria-expanded')).toBe('false');
});

test('backdrop click closes nav', () => {
  document.getElementById('rs-hamburger').click();
  document.getElementById('rs-backdrop').click();
  expect(document.body.classList.contains('rs-nav-open')).toBe(false);
});

test('history.pushState call closes nav', () => {
  document.getElementById('rs-hamburger').click();
  history.pushState({}, '', '/test-push');
  expect(document.body.classList.contains('rs-nav-open')).toBe(false);
});

test('popstate event closes nav', () => {
  document.getElementById('rs-hamburger').click();
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(document.body.classList.contains('rs-nav-open')).toBe(false);
});

test('removing side-nav from DOM removes hamburger', async () => {
  const nav = document.querySelector('.side-nav');
  nav.remove();
  // MutationObserver delivers callbacks as microtasks
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(document.getElementById('rs-hamburger')).toBeNull();

  // Restore nav so other tests are unaffected if run after this one
  const restored = document.createElement('div');
  restored.className = 'side-nav';
  document.body.appendChild(restored);
  await new Promise((resolve) => setTimeout(resolve, 0));
});
