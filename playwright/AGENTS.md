# playwright/

Visual verification tool for Rancher Saddle. Takes authenticated mobile-viewport screenshots of a live Rancher instance to confirm CSS/JS changes look correct.

## Usage

```bash
npm install                                          # first time only
node screenshot.mjs                                  # default path
node screenshot.mjs /dashboard/c/local/explorer      # specific path
```

Viewport: 390×844 (iPhone 14 Pro). Output: `playwright/screenshots/<slug>_*.png`.

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

## What it checks

`screenshot.mjs` captures screenshots and logs computed styles for key layout elements:
- Saddle CSS injected (`/_saddle/mobile.css` in `<link>` tags)
- `.main-layout`, `.side-nav`, `.dashboard-content` dimensions and overflow
- Title/header grid layout
- `.sortable-table` last column positioning

It is a diagnostic tool, not a test runner — it has no assertions. Use the computed-style output and screenshots to visually verify changes.

## Node version

Requires Node 20+. See `.nvmrc` in this directory.
