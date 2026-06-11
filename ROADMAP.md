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

`mobile.css` uses Rancher's CSS custom property architecture (`--nav-width`, `--header-height`) to collapse the sidebar at mobile breakpoints and position it as a slide-in overlay. `mobile.js` injects the hamburger toggle button after Vue mounts.

## Deployment

```sh
helm install rancher-saddle ./helm/rancher-saddle \
  --set upstream.url=https://rancher.example.com \
  --set ingress.enabled=true \
  --set ingress.host=rancher-mobile.example.com
```

Runs stock `nginx:alpine` — no custom image. nginx config and the mobile overlay are
mounted from ConfigMaps.

## Files

| File | Purpose |
|------|---------|
| `helm/rancher-saddle/files/mobile.css` | Mobile CSS overrides |
| `helm/rancher-saddle/files/mobile.js` | Hamburger toggle injection |
| `helm/rancher-saddle/templates/configmap.yaml` | nginx proxy config |
| `helm/rancher-saddle/` | Helm chart for Kubernetes deployment |
