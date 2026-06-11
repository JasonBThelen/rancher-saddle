import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, expect, test } from 'vitest';

const __dir = dirname(fileURLToPath(import.meta.url));
const mobileJs = readFileSync(
  join(__dir, '../../helm/rancher-saddle/files/mobile.js'),
  'utf8',
);

beforeAll(() => {
  // mobile.js check() requires both <header> and .side-nav to exist
  document.body.appendChild(document.createElement('header'));
  const nav = document.createElement('div');
  nav.className = 'side-nav';
  document.body.appendChild(nav);

  const run = new Function('window', 'document', mobileJs);
  run(window, document);
});

function buildTabbedContainer(labels, activeIndex) {
  const container = document.createElement('div');
  container.className = 'tabbed-container';

  const tabs = document.createElement('ul');
  tabs.className = 'tabs clearfix horizontal';

  const links = labels.map((label, i) => {
    const li = document.createElement('li');
    li.className = i === activeIndex ? 'tab active' : 'tab';
    const a = document.createElement('a');
    a.textContent = label;
    li.appendChild(a);
    tabs.appendChild(li);
    return a;
  });

  container.appendChild(tabs);
  return { container, tabs, links };
}

function setWidths(el, scrollWidth, clientWidth) {
  Object.defineProperty(el, 'scrollWidth', {
    value: scrollWidth,
    configurable: true,
  });
  Object.defineProperty(el, 'clientWidth', {
    value: clientWidth,
    configurable: true,
  });
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('overflowing tab strip gets a dropdown mirroring the active tab', async () => {
  const { container, tabs } = buildTabbedContainer(
    ['Pods (1)', 'Metrics', 'Services (1)', 'Ingresses'],
    0,
  );
  setWidths(tabs, 800, 378);
  document.body.appendChild(container);
  await tick();

  expect(container.classList.contains('rs-tabs-enhanced')).toBe(true);
  const select = container.querySelector('select.rs-tab-select');
  expect(select).not.toBeNull();
  expect([...select.options].map((o) => o.textContent)).toEqual([
    'Pods (1)',
    'Metrics',
    'Services (1)',
    'Ingresses',
  ]);
  expect(select.selectedIndex).toBe(0);

  container.remove();
});

test('non-overflowing tab strip is left without a dropdown', async () => {
  const { container, tabs } = buildTabbedContainer(['Events', 'Alerts'], 0);
  setWidths(tabs, 200, 378);
  document.body.appendChild(container);
  await tick();

  expect(container.classList.contains('rs-tabs-enhanced')).toBe(false);
  expect(container.querySelector('select.rs-tab-select')).toBeNull();

  container.remove();
});

test('choosing a dropdown option activates the matching tab link', async () => {
  const { container, tabs, links } = buildTabbedContainer(
    ['Pods (1)', 'Metrics', 'Services (1)', 'Ingresses'],
    0,
  );
  setWidths(tabs, 800, 378);
  document.body.appendChild(container);
  await tick();

  const select = container.querySelector('select.rs-tab-select');
  const clicked = links.map(() => false);
  links.forEach((a, i) =>
    a.addEventListener('click', () => (clicked[i] = true)),
  );

  select.selectedIndex = 2;
  select.dispatchEvent(new Event('change'));

  expect(clicked).toEqual([false, false, true, false]);

  container.remove();
});

test('dropdown is removed once the tab strip no longer overflows', async () => {
  const { container, tabs } = buildTabbedContainer(
    ['Pods (1)', 'Metrics', 'Services (1)', 'Ingresses'],
    0,
  );
  setWidths(tabs, 800, 378);
  document.body.appendChild(container);
  await tick();
  expect(container.querySelector('select.rs-tab-select')).not.toBeNull();

  // Simulate a wider viewport where all tabs now fit
  setWidths(tabs, 800, 900);
  window.dispatchEvent(new Event('resize'));
  await tick();

  expect(container.classList.contains('rs-tabs-enhanced')).toBe(false);
  expect(container.querySelector('select.rs-tab-select')).toBeNull();

  container.remove();
});
