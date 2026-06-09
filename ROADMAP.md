# Rancher Saddle

A mobile overlay for the Rancher dashboard.

## Approach

Rather than rebuilding Rancher's functionality in a separate app, Saddle sits in front of Rancher as a thin nginx reverse proxy. It injects a single CSS file and a small JS snippet into every HTML response, making the existing dashboard usable on phones.

This means:
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
helm install rancher-saddle ./helm/rancher-saddle \
  --set upstream.url=https://rancher.example.com \
  --set ingress.enabled=true \
  --set ingress.host=rancher-mobile.example.com
```

## Files

| File | Purpose |
|------|---------|
| `overlay/mobile.css` | Mobile CSS overrides (~150 lines) |
| `overlay/mobile.js` | Hamburger toggle injection (~40 lines) |
| `nginx/default.conf.template` | nginx proxy config (envsubst template) |
| `Dockerfile` | nginx:alpine + overlay files |
| `helm/rancher-saddle/` | Helm chart for Kubernetes deployment |
