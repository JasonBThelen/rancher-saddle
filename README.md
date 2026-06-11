# Rancher Saddle

A mobile overlay for the Rancher dashboard.

Rather than rebuilding Rancher's functionality in a separate app, Saddle sits in front of Rancher as a thin nginx reverse proxy. It injects a single CSS file and a small JS snippet into every HTML response, making the existing dashboard usable on phones.

- **100% of Rancher's features** remain available on mobile
- **Zero maintenance** when Rancher releases a new version — only update CSS selectors if Rancher redesigns a component (rare)
- **No separate auth** — users log into Rancher as normal

## How it works

```
Mobile browser → nginx (Rancher Saddle) → upstream Rancher instance
                      ↓
               injects mobile.css + mobile.js into HTML <head>
```

`mobile.css` uses Rancher's CSS custom property architecture (`--nav-width`, `--header-height`) to collapse the sidebar at mobile breakpoints and position it as a slide-in overlay. `mobile.js` injects the hamburger toggle, keeps the layout grid in sync with the (now-wrapping) header height, and converts overflowing tab strips into dropdowns.

## Deployment

A Helm chart that runs the unmodified `nginx:alpine` image — there's no custom image to build or maintain. The nginx config and the mobile overlay files are mounted from ConfigMaps.

```sh
# From GHCR (released version)
helm install rancher-saddle oci://ghcr.io/jasonbthelen/charts/rancher-saddle \
  --set upstream.url=https://rancher.example.com \
  --set ingress.enabled=true \
  --set ingress.host=rancher-mobile.example.com

# From a local checkout
helm install rancher-saddle ./helm/rancher-saddle \
  --set upstream.url=https://rancher.example.com
```

## Development

### Prerequisites

- Node.js 20+ (for tests and the visual verifier)
- Helm 3 (for chart templating/packaging)
- Docker (only used to run `nginx -t` against the rendered config — see below)

### Validate the rendered nginx config

```sh
mkdir -p /tmp/conf.d
helm template test ./helm/rancher-saddle --set upstream.url=https://rancher.example.com \
  --show-only templates/configmap.yaml \
  | sed -n '/^  default.conf: |$/,$p' | tail -n +2 | sed 's/^    //' > /tmp/conf.d/default.conf
docker run --rm --add-host rancher.example.com:127.0.0.1 -v /tmp/conf.d:/etc/nginx/conf.d:ro nginx:alpine nginx -t
```

### Run tests

```sh
npm install
npm test            # Vitest/jsdom — helm/rancher-saddle/files/mobile.js
npm run test:helm   # Helm template assertions
```

### Visual verification

After editing CSS or JS, verify visually against a real Rancher instance:

```sh
cp .env.example .env      # fill in RANCHER_BASE, RANCHER_USER, RANCHER_PASS
cd playwright
npm install
node screenshot.mjs       # screenshots saved to playwright/screenshots/
```

### Linting and formatting

```sh
npm install               # install ESLint, Prettier, Husky (repo root)
npm run lint
npm run format
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `upstream.url` | Yes | Upstream Rancher URL, no trailing slash — set via `helm install --set upstream.url=...` |
| `RANCHER_BASE` | No | Playwright verifier base URL (defaults to lab instance) |
| `RANCHER_USER` | No | Playwright verifier username (defaults to `admin`) |
| `RANCHER_PASS` | Yes (verifier) | Playwright verifier password |

## Files

| File | Purpose |
|------|---------|
| `helm/rancher-saddle/files/mobile.css` | Mobile CSS overrides |
| `helm/rancher-saddle/files/mobile.js` | Hamburger toggle, header sync, tab→dropdown injection |
| `helm/rancher-saddle/templates/configmap.yaml` | nginx proxy config, rendered with `upstream.url` baked in |
| `helm/rancher-saddle/templates/configmap-overlay.yaml` | Loads `files/` into a ConfigMap |
| `playwright/screenshot.mjs` | Visual verification tool |
