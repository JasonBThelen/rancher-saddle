# Rancher Saddle

nginx reverse proxy that injects `mobile.css` + `mobile.js` into every Rancher HTML response, making the Rancher dashboard usable on phones. No backend code — pure nginx + static files + Helm chart.

## Quick Commands

```bash
# Build and run locally
docker build -t rancher-saddle .
docker run -p 8080:80 -e RANCHER_URL=https://rancher.example.com rancher-saddle

# Deploy to Kubernetes
helm install rancher-saddle ./helm/rancher-saddle --set upstream.url=https://rancher.example.com

# Validate nginx config (same check CI runs)
export RANCHER_URL=https://rancher.example.com
envsubst '${RANCHER_URL}' < nginx/default.conf.template > /tmp/default.conf
docker run --rm -v /tmp/default.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine nginx -t

# Lint / format
npm run lint
npm run format

# Visual verification after CSS/JS changes
cd playwright && node screenshot.mjs [/optional/url/path]
```

## Key Files

| File | Purpose |
|------|---------|
| `overlay/mobile.css` | Mobile CSS overrides |
| `overlay/mobile.js` | Hamburger toggle injection |
| `nginx/default.conf.template` | nginx proxy config (Docker — envsubst template) |
| `helm/rancher-saddle/templates/configmap.yaml` | nginx config (Kubernetes — rendered directly) |
| `Dockerfile` | nginx:alpine + overlay files |
| `docker-entrypoint.sh` | Substitutes RANCHER_URL at container startup |
| `playwright/screenshot.mjs` | Visual verifier against a live Rancher instance |

## Critical: Two Deployment Modes

The nginx config lives in **two places that must stay in sync**:

- **Docker**: `nginx/default.conf.template` — `${RANCHER_URL}` substituted at startup via `envsubst`
- **Helm/K8s**: `helm/rancher-saddle/templates/configmap.yaml` — full rendered config in a ConfigMap; no envsubst at runtime

**When modifying nginx config: update both files.**

See [`nginx/AGENTS.md`](nginx/AGENTS.md) for the load-bearing header rules.

## Things to Avoid

- **No trailing slash** on `RANCHER_URL` / `upstream.url` — nginx and entrypoint both break with one
- **Do not remove** the Origin/Referer rewrite headers — they pass Rancher's CSRF check
- **Do not remove** `proxy_hide_header Content-Security-Policy` — allows the injected scripts to run

## Subdirectory Context

Work scoped to a subdirectory? Read the local `AGENTS.md`:

- [`overlay/AGENTS.md`](overlay/AGENTS.md) — CSS conventions, JS injection notes, verification workflow
- [`nginx/AGENTS.md`](nginx/AGENTS.md) — template syntax, critical headers, sync requirement
- [`playwright/AGENTS.md`](playwright/AGENTS.md) — screenshot tool usage, env vars, .env format
- [`helm/AGENTS.md`](helm/AGENTS.md) — chart structure, values, configmap relationship
