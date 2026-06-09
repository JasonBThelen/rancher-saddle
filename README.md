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

`mobile.css` uses Rancher's CSS custom property architecture (`--nav-width`, `--header-height`) to collapse the sidebar at mobile breakpoints and position it as a slide-in overlay. `mobile.js` (~40 lines) injects the hamburger toggle button after Vue mounts.

## Deployment

### Docker (quick test)

```sh
docker run -p 8080:80 \
  -e RANCHER_URL=https://rancher.example.com \
  ghcr.io/jasonbthelen/rancher-saddle:latest
```

### Helm (production)

```sh
helm install rancher-saddle oci://ghcr.io/jasonbthelen/charts/rancher-saddle \
  --set upstream.url=https://rancher.example.com \
  --set ingress.enabled=true \
  --set ingress.host=rancher-mobile.example.com
```

Or from a local checkout:

```sh
helm install rancher-saddle ./helm/rancher-saddle \
  --set upstream.url=https://rancher.example.com
```

## Development

### Prerequisites

- Docker (for building/testing the image)
- Node.js 20+ (for the visual verifier)
- Helm 3 (for chart packaging)

### Build image locally

```sh
docker build -t rancher-saddle .
docker run -p 8080:80 -e RANCHER_URL=https://your-rancher.example.com rancher-saddle
```

### Validate nginx config

```sh
export RANCHER_URL=https://rancher.example.com
envsubst '${RANCHER_URL}' < nginx/default.conf.template > /tmp/default.conf
docker run --rm --add-host rancher.example.com:127.0.0.1 -v /tmp/default.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine nginx -t
```

### Run tests

```sh
npm install
npm test            # everything (unit + integration; integration needs Docker)
npm run test:unit   # Vitest/jsdom — overlay/mobile.js
npm run test:int    # docker compose — nginx injection behavior
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
| `RANCHER_URL` | Yes (Docker) | Upstream Rancher URL, no trailing slash |
| `upstream.url` | Yes (Helm) | Same value, set via `--set` |
| `RANCHER_BASE` | No | Playwright verifier base URL (defaults to lab instance) |
| `RANCHER_USER` | No | Playwright verifier username (defaults to `admin`) |
| `RANCHER_PASS` | Yes (verifier) | Playwright verifier password |

## Files

| File | Purpose |
|------|---------|
| `overlay/mobile.css` | Mobile CSS overrides (~150 lines) |
| `overlay/mobile.js` | Hamburger toggle injection (~40 lines) |
| `nginx/default.conf.template` | nginx proxy config (Docker mode — envsubst template) |
| `helm/rancher-saddle/templates/configmap.yaml` | nginx config (Helm/K8s mode — rendered directly) |
| `Dockerfile` | nginx:alpine + overlay files |
| `docker-entrypoint.sh` | Substitutes RANCHER_URL at container startup |
| `playwright/screenshot.mjs` | Visual verification tool |
