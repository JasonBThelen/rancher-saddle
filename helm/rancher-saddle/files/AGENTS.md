# helm/rancher-saddle/files/

Contains the two files injected into every Rancher HTML response by nginx `sub_filter`. This is the **only** copy — `../templates/configmap-overlay.yaml` loads this directory (`.Files.Glob "files/*"`) into a ConfigMap that's mounted into the nginx pod and served at `/_saddle/`.

## Files

- `mobile.css` — mobile breakpoint overrides
- `mobile.js` — hamburger toggle, header-height sync, and tab→dropdown injection, run after Vue mounts

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

A `helm upgrade` is required to pick up changes — `../templates/deployment.yaml` has a
`checksum/overlay` annotation that triggers a rolling restart when this directory's
content changes:

```bash
helm upgrade rancher-saddle ./helm/rancher-saddle -n cattle-system --reuse-values
```

Then visually verify against a real Rancher instance before committing:

```bash
cd playwright
node screenshot.mjs                                  # default path
node screenshot.mjs /dashboard/c/local/explorer      # specific path
```

Screenshots saved to `playwright/screenshots/`. Requires `.env` at repo root — see [`playwright/AGENTS.md`](../../../playwright/AGENTS.md).
