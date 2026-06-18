// Rancher Saddle — PWA icon generator
//
// Rasterizes the app icon to the PNG sizes a PWA needs and writes them into
// `helm/rancher-saddle/files/icons/`, where `configmap-overlay.yaml` picks
// them up via a `binaryData:` glob (PNGs can't live in a ConfigMap's `data:`
// field, which is UTF-8 only). Re-run this whenever the icon design changes:
//
//   node playwright/generate-icons.mjs
//
// The icon is the Rancher steer mark (recolored white) centered on the brand
// blue. The mark lives in `rancher-mark.svg` next to this script — it was
// extracted from the logo the Rancher dashboard serves at
// `/dashboard/img/rancher-logo.*.svg` (cow cropped out of the wordmark and
// its #2453FF fill flipped to white). Uses the chromium that already ships
// with the repo's playwright dependency, so no extra tooling is required.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dir, '..', 'helm', 'rancher-saddle', 'files', 'icons');
const MARK = readFileSync(join(__dir, 'rancher-mark.svg'), 'utf8');

// One source design, rendered at a few sizes / masks.
//  - rounded: transparent corners (Android "any" / browser tab icons)
//  - full-bleed: edge-to-edge background so iOS / Android adaptive masks can
//    crop it without exposing transparent corners; mark kept in the safe zone.
function html(size, { rounded, markWidth }) {
  const radius = rounded ? Math.round(size * 0.22) : 0;
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    .icon{
      width:${size}px;height:${size}px;
      border-radius:${radius}px;
      background:linear-gradient(150deg,#3a73ff 0%,#1c39b8 100%);
      display:flex;align-items:center;justify-content:center;
      box-sizing:border-box;
    }
    .icon svg{width:${Math.round(size * markWidth)}px;height:auto;display:block}
  </style><div class="icon">${MARK}</div>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, rounded: true, markWidth: 0.66 },
  { file: 'icon-512.png', size: 512, rounded: true, markWidth: 0.66 },
  { file: 'icon-maskable-512.png', size: 512, rounded: false, markWidth: 0.56 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, markWidth: 0.62 },
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
try {
  for (const t of targets) {
    const page = await browser.newPage({
      viewport: { width: t.size, height: t.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(html(t.size, t), { waitUntil: 'load' });
    const el = await page.$('.icon');
    await el.screenshot({
      path: join(OUT_DIR, t.file),
      omitBackground: true, // keep corners transparent on the rounded variants
    });
    await page.close();
    console.log('wrote', t.file, `(${t.size}x${t.size})`);
  }
} finally {
  await browser.close();
}
