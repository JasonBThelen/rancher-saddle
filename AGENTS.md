# Rancher Saddle

nginx reverse proxy that injects `mobile.css` + `mobile.js` into every Rancher HTML response, making the Rancher dashboard usable on phones. No backend code, no custom image — a Helm chart that runs stock `nginx:alpine` with the config and overlay mounted from ConfigMaps.

## Quick Commands

```bash
# Deploy to Kubernetes
helm install rancher-saddle ./helm/rancher-saddle --set upstream.url=https://rancher.example.com

# Validate the rendered nginx config (same check CI runs)
mkdir -p /tmp/conf.d
helm template test ./helm/rancher-saddle --set upstream.url=https://rancher.example.com \
  --show-only templates/configmap.yaml \
  | sed -n '/^  default.conf: |$/,$p' | tail -n +2 | sed 's/^    //' > /tmp/conf.d/default.conf
docker run --rm --add-host rancher.example.com:127.0.0.1 -v /tmp/conf.d:/etc/nginx/conf.d:ro nginx:alpine nginx -t

# Lint / format
npm run lint
npm run format

# Run tests
npm test            # Vitest/jsdom — helm/rancher-saddle/files/mobile.js
npm run test:helm   # Helm template assertions

# Visual verification after CSS/JS changes
cd playwright && node screenshot.mjs [/optional/url/path]

# Run automated mobile layout audit
npm run audit
```

## Key Files

| File | Purpose |
|------|---------|
| `helm/rancher-saddle/files/mobile.css` | Mobile CSS overrides — single source of truth |
| `helm/rancher-saddle/files/mobile.js` | Hamburger toggle, header sync, tab→dropdown injection — single source of truth |
| `helm/rancher-saddle/templates/configmap.yaml` | nginx config — single source of truth, rendered with `upstream.url` baked in |
| `helm/rancher-saddle/templates/configmap-overlay.yaml` | Loads `files/mobile.css`/`mobile.js` into a ConfigMap |
| `helm/rancher-saddle/templates/deployment.yaml` | Stock `nginx:alpine` Deployment, mounts both ConfigMaps |
| `playwright/screenshot.mjs` | Visual verifier against a live Rancher instance |

## Things to Avoid

- **No trailing slash** on `upstream.url` — the rendered nginx config breaks with one
- **Do not remove** the `proxy_set_header Origin ...` rewrite — it passes Rancher's CSRF/origin check. Do **not** add a Referer rewrite — browsers omit Referer on WebSocket upgrades and an artificial value confuses Rancher's routing
- **Do not remove** `proxy_hide_header Content-Security-Policy` — allows the injected `/_saddle/` scripts to run
- **Do not remove** `proxy_set_header X-Forwarded-Proto https` — Rancher's Steve API rejects WebSocket subscribe requests if this isn't `https`, regardless of the proxy's actual scheme

## Subdirectory Context

Work scoped to a subdirectory? Read the local `AGENTS.md`:

- [`helm/AGENTS.md`](helm/AGENTS.md) — chart structure, values, configmap relationship
- [`helm/rancher-saddle/files/AGENTS.md`](helm/rancher-saddle/files/AGENTS.md) — CSS conventions, JS injection notes, verification workflow
- [`playwright/AGENTS.md`](playwright/AGENTS.md) — screenshot tool usage, env vars, .env format

## Upgrades & Compatibility Workflow

To verify and maintain compatibility when the upstream Rancher cluster is upgraded, see the detailed instructions in [upgrade_workflow.md](upgrade_workflow.md).
