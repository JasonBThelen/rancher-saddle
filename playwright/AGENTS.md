# playwright/

Diagnostic tools for Rancher Saddle. Each takes authenticated
mobile-viewport screenshots and/or DOM measurements from a live Rancher
instance to confirm CSS/JS changes look correct. Used heavily by
[`../upgrade_workflow.md`](../upgrade_workflow.md).

## Tools

| Script | Purpose |
|--------|---------|
| `screenshot.mjs` | Single-page screenshot + computed-style dump for a layout element |
| `audit.mjs` | Batch overflow/overlap audit across multiple pages (`npm run audit`) |
| `list-routes.mjs` | Crawl the dashboard nav and print internal `/dashboard/...` routes — use when Rancher's nav/resource-type slugs change between versions |

## Usage

```bash
npm install                                          # first time only
node screenshot.mjs                                  # default path
node screenshot.mjs /dashboard/c/local/explorer      # specific path
node audit.mjs /dashboard/c/local/explorer /dashboard/c/local/explorer/apps.deployment
node list-routes.mjs                                 # crawl default nav pages
```

Viewport: 390×844 (iPhone 14 Pro). Output: `playwright/screenshots/<slug>_*.png` and (for `audit.mjs`) `playwright/audit-results.json`, both gitignored.

## Credentials

Reads from `../.env` (one directory up from `playwright/`) or environment variables. Priority order:

| Variable | Env var | .env key | Default |
|----------|---------|----------|---------|
| Base URL | `RANCHER_BASE` | `RANCHER_BASE` | `https://rancher-mobile.int.thelenlab.com` |
| Username | `RANCHER_USER` | `RANCHER_USER` | `admin` |
| Password | `RANCHER_PASS` | `RANCHER_PASS` or `password` | — (required) |

Copy `.env.example` (repo root) to `.env` and fill in real values. The `.env` file is gitignored.

## Authentication

Uses the Rancher token API (`/v3-public/localProviders/local?action=login`) to get a session cookie, then injects it into the browser context. Falls back to form login if the API call fails.

## What each tool checks

`screenshot.mjs` captures screenshots and logs computed styles for key layout elements:
- Saddle CSS injected (`/_saddle/mobile.css` in `<link>` tags)
- `.main-layout`, `.side-nav`, `.dashboard-content` dimensions and overflow
- Title/header grid layout
- `.sortable-table` last column positioning

`audit.mjs` navigates to each given path, captures viewport + scrolled
screenshots, and reports horizontal overflow, visual overlaps, and
console errors to `audit-results.json`.

`list-routes.mjs` visits the given pages (default: cluster explorer +
Apps & Marketplace) and prints every internal `/dashboard/...` link
found, with its visible nav text — a quick way to see what changed in
Rancher's nav between versions.

These are diagnostic tools, not test runners — they have no pass/fail
assertions. Use the output (computed styles, overflow/overlap reports,
screenshots) to visually verify changes.

## Node version

Requires Node 20+. See `.nvmrc` in this directory.
