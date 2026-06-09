# overlay/

Contains the two files injected into every Rancher HTML response by nginx `sub_filter`.

## Files

- `mobile.css` — ~150 lines of mobile breakpoint overrides
- `mobile.js` — ~40 lines injecting the hamburger toggle after Vue mounts

## CSS Conventions

Always use Rancher's CSS custom properties — never hardcode pixel values:

```css
/* correct */
width: var(--nav-width);
top: var(--header-height);

/* wrong — breaks when Rancher updates its layout */
width: 220px;
top: 54px;
```

Rancher exposes `--nav-width`, `--header-height`, and other layout tokens. Use them.
Target Rancher's own class names (`.side-nav`, `.main-layout`, etc.) — these are stable across minor releases.

## JS Injection

`mobile.js` runs as a `sub_filter`-injected `<script>` in a Rancher SPA context.

- Uses a `MutationObserver` to wait for Vue to mount `.side-nav` before injecting the hamburger
- Intercepts `history.pushState` / `replaceState` to close the nav on SPA navigation
- No build step — plain ES5-compatible IIFE; do not use import/export

## After Editing

Visually verify changes against a real Rancher instance before committing:

```bash
cd playwright
node screenshot.mjs                                  # default path
node screenshot.mjs /dashboard/c/local/explorer      # specific path
```

Screenshots saved to `playwright/screenshots/`. Requires `.env` at repo root — see [`playwright/AGENTS.md`](../playwright/AGENTS.md).
