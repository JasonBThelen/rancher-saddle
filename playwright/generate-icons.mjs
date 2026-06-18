// Rancher Saddle — PWA icon generator
//
// Rasterizes the app icon to the PNG sizes a PWA needs and writes them into
// `helm/rancher-saddle/files/icons/`, where `configmap-overlay.yaml` picks
// them up via a `binaryData:` glob (PNGs can't live in a ConfigMap's `data:`
// field, which is UTF-8 only). Re-run this whenever the icon design changes:
//
//   node playwright/generate-icons.mjs
//
// Uses the chromium that already ships with the repo's playwright dependency,
// so no extra tooling is required.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'helm',
  'rancher-saddle',
  'files',
  'icons',
);

// One source design, rendered at a few sizes / masks.
//  - rounded: transparent corners (Android "any" / browser tab icons)
//  - full-bleed: edge-to-edge background so iOS / Android adaptive masks can
//    crop it without exposing transparent corners; glyph kept in the safe zone.
function html(size, { rounded, glyphScale }) {
  const radius = rounded ? Math.round(size * 0.22) : 0;
  const fontSize = Math.round(size * glyphScale);
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    .icon{
      width:${size}px;height:${size}px;
      border-radius:${radius}px;
      background:linear-gradient(150deg,#3a73ff 0%,#1c39b8 100%);
      display:flex;align-items:center;justify-content:center;
      font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
      font-weight:800;color:#fff;
      font-size:${fontSize}px;line-height:1;
      letter-spacing:-0.04em;
    }
  </style><div class="icon">R</div>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, rounded: true, glyphScale: 0.6 },
  { file: 'icon-512.png', size: 512, rounded: true, glyphScale: 0.6 },
  { file: 'icon-maskable-512.png', size: 512, rounded: false, glyphScale: 0.5 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, glyphScale: 0.56 },
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
