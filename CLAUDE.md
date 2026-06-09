# Rancher Saddle

nginx reverse proxy that injects `mobile.css` + `mobile.js` into every Rancher HTML response, making the Rancher dashboard usable on phones. No backend code — pure nginx + static files + Helm chart.

## Quick Commands

```bash
# Build Docker image
docker build -t rancher-saddle .

# Run locally (Docker)
docker run -p 8080:80 -e RANCHER_URL=https://rancher.example.com rancher-saddle

# Deploy to Kubernetes
helm install rancher-saddle ./helm/rancher-saddle \
  --set upstream.url=https://rancher.example.com \
  --set ingress.enabled=true \
  --set ingress.host=rancher-mobile.example.com

# Validate nginx config (same check CI runs)
export RANCHER_URL=https://rancher.example.com
envsubst '${RANCHER_URL}' < nginx/default.conf.template > /tmp/default.conf
docker run --rm -v /tmp/default.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine nginx -t

# Visual verification (requires .env with credentials)
cd playwright && node screenshot.mjs [/optional/url/path]

# Lint JS files (after npm install at repo root)
npm run lint

# Format JS/CSS files
npm run format
```

## Key Files

| File | Purpose |
|------|---------|
| `overlay/mobile.css` | Mobile CSS overrides (~150 lines) |
| `overlay/mobile.js` | Hamburger toggle injection (~40 lines) |
| `nginx/default.conf.template` | nginx proxy config — `${RANCHER_URL}` substituted at startup |
| `Dockerfile` | nginx:alpine + overlay files |
| `docker-entrypoint.sh` | Runs envsubst on startup (Docker mode only) |
| `helm/rancher-saddle/templates/configmap.yaml` | nginx config for Kubernetes (no envsubst) |
| `playwright/screenshot.mjs` | Visual verifier — takes mobile screenshots of a live Rancher instance |

## Critical: Two Deployment Modes

The nginx config lives in two places that must stay in sync:

- **Docker**: `nginx/default.conf.template` — `${RANCHER_URL}` is substituted at container startup by `docker-entrypoint.sh` via `envsubst`
- **Helm/Kubernetes**: `helm/rancher-saddle/templates/configmap.yaml` — the full rendered nginx config is written directly into a ConfigMap; no envsubst at runtime

**When modifying nginx config: update both files.**

## CSS Conventions

Always use Rancher's CSS custom properties — never hardcode pixel values:

```css
/* correct */
width: var(--nav-width);
top: var(--header-height);

/* wrong — breaks when Rancher updates layout */
width: 220px;
top: 54px;
```

## Things to Avoid

- **No trailing slash** on `RANCHER_URL` / `upstream.url` — the nginx config and entrypoint both break with one
- **Do not remove** the `proxy_set_header Origin` and `proxy_set_header Referer` directives — they rewrite those headers to pass Rancher's CSRF check
- **Do not remove** the `proxy_hide_header Content-Security-Policy` directive — it strips CSP to allow the injected scripts to run
- **Do not set** `proxy_ssl_verify on` unless Rancher's TLS cert is trusted by the proxy container

## Environment Variables

| Variable | Where Used | Notes |
|----------|-----------|-------|
| `RANCHER_URL` | Docker container / envsubst | Required; no trailing slash |
| `RANCHER_BASE` | `playwright/screenshot.mjs` | Defaults to `https://rancher-mobile.int.thelenlab.com` |
| `RANCHER_USER` | `playwright/screenshot.mjs` | Defaults to `admin` |
| `RANCHER_PASS` | `playwright/screenshot.mjs` | Required; also readable as `password=` in `.env` |

## Visual Verification Workflow

After changing CSS or JS:
1. Copy `.env.example` to `.env` and fill in real credentials
2. `cd playwright && npm install`
3. `node screenshot.mjs` — screenshots saved to `playwright/screenshots/`
4. `node screenshot.mjs /dashboard/c/local/explorer` — test a specific path

The `.env` file is read from one level up (`../.env`). The password key can be either `RANCHER_PASS=` or `password=`.
