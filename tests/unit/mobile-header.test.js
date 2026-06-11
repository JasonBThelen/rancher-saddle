import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, expect, test } from 'vitest';

const __dir = dirname(fileURLToPath(import.meta.url));
const mobileJs = readFileSync(
  join(__dir, '../../helm/rancher-saddle/files/mobile.js'),
  'utf8',
);

let header;
let content;

beforeAll(() => {
  // mobile.js check() requires both <header> and .side-nav to exist.
  // The toolbar <header> has no stable class in Rancher 2.14.x — it's
  // matched as the direct <header> child of .dashboard-content.
  const nav = document.createElement('div');
  nav.className = 'side-nav';
  document.body.appendChild(nav);

  content = document.createElement('div');
  content.className = 'dashboard-content';
  content.style.gridTemplateRows = '55px 789px 0px';
  document.body.appendChild(content);

  header = document.createElement('header');
  content.appendChild(header);

  const run = new Function('window', 'document', mobileJs);
  run(window, document);
});

function setHeaderHeight(px) {
  Object.defineProperty(header, 'offsetHeight', {
    value: px,
    configurable: true,
  });
}

test('grows the header grid row and shrinks the next row to compensate', () => {
  setHeaderHeight(140);
  window.dispatchEvent(new Event('resize'));

  expect(content.style.gridTemplateRows).toBe('140px 704px 0px');
  expect(document.body.style.getPropertyValue('--header-height')).toBe('140px');
});

test('further changes are reallocated relative to the original header row', () => {
  setHeaderHeight(168);
  window.dispatchEvent(new Event('resize'));

  expect(content.style.gridTemplateRows).toBe('168px 676px 0px');
  expect(document.body.style.getPropertyValue('--header-height')).toBe('168px');
});
