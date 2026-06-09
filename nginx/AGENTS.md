# nginx/

Contains the nginx config template for Docker mode.

## File

`default.conf.template` — nginx config with `${RANCHER_URL}` placeholder substituted at container startup by `docker-entrypoint.sh` via `envsubst '${RANCHER_URL}'`. Only `${RANCHER_URL}` is substituted; all other nginx `$variables` pass through unchanged.

## Sync Requirement

**This file must stay in sync with `helm/rancher-saddle/templates/configmap.yaml`.**

The Helm chart writes the nginx config directly into a ConfigMap (no envsubst at runtime). When editing the nginx config logic, update both files.

## Load-Bearing Headers (Do Not Remove)

These directives exist for specific reasons and must be preserved:

| Directive | Why it must stay |
|-----------|-----------------|
| `proxy_set_header Origin $scheme://$host` | Rewrites Origin to match the proxy host so Rancher's CSRF check accepts the request |
| `proxy_set_header Referer $scheme://$host$request_uri` | Same reason — Rancher validates Referer on state-mutating requests |
| `proxy_hide_header Content-Security-Policy` | Strips CSP so the injected `mobile.css` and `mobile.js` are not blocked by the browser |

## RANCHER_URL

- Required; no trailing slash
- Used in `proxy_pass` and in the `proxy_set_header` rewrites
- Set via `-e RANCHER_URL=...` for Docker, via `upstream.url` for Helm
