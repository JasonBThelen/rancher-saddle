# helm/

Contains the Helm chart for deploying Rancher Saddle to Kubernetes.

## Chart

`helm/rancher-saddle/` — chart version `0.1.0`. Published to GHCR as an OCI artifact on tagged releases.

## Key Files

| File | Purpose |
|------|---------|
| `values.yaml` | Default values — well-commented, read it before changing defaults |
| `templates/configmap.yaml` | nginx config written directly (no envsubst at runtime) |
| `templates/deployment.yaml` | Deployment with liveness/readiness probes on `/_saddle/mobile.css` |
| `templates/ingress.yaml` | Optional ingress (disabled by default) |

## nginx Config Sync

**`templates/configmap.yaml` must stay in sync with `nginx/default.conf.template`** (the Docker-mode config). They are the same nginx config in two forms — the template version uses `${RANCHER_URL}` as a placeholder; the ConfigMap version has the full URL rendered at deploy time via `--set upstream.url=...`.

## Install

```bash
# From local checkout
helm install rancher-saddle ./helm/rancher-saddle \
  --set upstream.url=https://rancher.example.com \
  --set ingress.enabled=true \
  --set ingress.host=rancher-mobile.example.com

# From GHCR (released version)
helm install rancher-saddle oci://ghcr.io/jasonbthelen/charts/rancher-saddle \
  --set upstream.url=https://rancher.example.com

# Lint before push
helm lint helm/rancher-saddle
```

## Versioning

Chart version is set at CI time: git tag `v1.2.3` → chart version `1.2.3`; branch builds get `<base>-dev.<short-sha>`.
