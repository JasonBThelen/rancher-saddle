# helm/

Contains the Helm chart for deploying Rancher Saddle to Kubernetes.

## Chart

`helm/rancher-saddle/` — chart version `0.1.0`. Published to GHCR as an OCI artifact on tagged releases.

## Key Files

| File | Purpose |
|------|---------|
| `values.yaml` | Default values — well-commented, read it before changing defaults |
| `templates/configmap.yaml` | The nginx config — single source of truth, rendered with `upstream.url` baked in (no envsubst at runtime) |
| `templates/configmap-overlay.yaml` | Loads `files/mobile.css`/`mobile.js` into a ConfigMap via `.Files.Glob` |
| `files/` | The mobile CSS/JS overlay — see [`files/AGENTS.md`](files/AGENTS.md) |
| `templates/deployment.yaml` | Stock `nginx:alpine` Deployment with liveness/readiness probes on `/_saddle/mobile.css` |
| `templates/ingress.yaml` | Optional ingress (disabled by default) |

The Deployment runs the unmodified `nginx:alpine` image — nginx config and the mobile
overlay are mounted entirely from these two ConfigMaps. There is no custom Docker image.

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
