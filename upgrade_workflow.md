# Rancher Saddle Upgrade & Compatibility Workflow

Rancher Saddle injects `mobile.css`/`mobile.js` on top of Rancher's own
DOM and CSS. When the upstream Rancher cluster is upgraded to a new
version, Rancher's Vue/Vuetify dashboard can rename CSS classes,
restructure layouts, or add new pages — any of which can silently break
the overlay. **This workflow finds and fixes those breaks, then cuts a
new rancher-saddle release.**

It is written to be run end-to-end by an LLM agent: every step has a
copy-pasteable command, the fix loop is self-verifying (deploy → audit →
screenshot → fix → redeploy), and it ends with a tagged release.

## TL;DR for an LLM agent

1. Point `.env` at the upgraded Rancher instance and confirm the test
   deployment's Helm release/namespace.
2. Run baseline tests (Step 1) — if these fail, it's a proxy/infra issue,
   not a CSS issue. Fix that first.
3. Run `npm run audit` plus the full route list in Step 3. Use
   `list-routes.mjs` (Step 2) to catch any new top-level pages.
4. For every flagged page, screenshot it, diagnose against the [CSS
   pitfall reference](#reference-known-css-pitfalls), fix
   `overlay/mobile.css`/`mobile.js`, sync to
   `helm/rancher-saddle/files/`, redeploy, re-audit. Repeat until clean.
5. Run the full regression suite (Step 6).
6. Cut a release (Step 7): bump the chart version, tag, push.
7. Report the audited/fixed page list and the new release version back
   to the user.

Don't stop at the first clean `npm run audit` — iterate through **every**
route in the [reference list](#reference-route-list) plus at least one
detail page per resource type before declaring victory.

---

## Prerequisites

- `.env` at the repo root points at the **upgraded** Rancher instance:
  ```env
  RANCHER_BASE=https://rancher-mobile.int.thelenlab.com
  RANCHER_USER=admin
  RANCHER_PASS=your-password
  ```
  (`.env` is gitignored — never print or commit its contents.)
- `npm ci` has been run (root **and** `playwright/`).
- `kubectl`/`helm` context points at the cluster running the *test*
  deployment of rancher-saddle. The examples below assume release name
  `rancher-saddle` in namespace `cattle-system` — adjust if your test
  deployment differs:
  ```bash
  helm list -n cattle-system   # confirm release name/namespace
  ```

---

## Step 1: Baseline checks

Confirm the proxy itself is healthy *before* touching CSS — if these
fail, the issue is nginx/Helm/JS plumbing, not a Rancher UI change:

```bash
npm test            # unit + integration (integration needs Docker)
npm run test:helm   # Helm template assertions
npm run lint
```

All three must pass before continuing.

---

## Step 2: Discover routes for the new Rancher version

Resource-type slugs (`apps.deployment`, `catalog.cattle.io.app`, …) are
Kubernetes API names and rarely change, but **top-level products and
nav entries can** (Rancher adds/renames/removes whole sections between
minor versions — e.g. Extensions, Virtualization Management). Run:

```bash
cd playwright
node list-routes.mjs
```

This authenticates, visits the cluster explorer and Apps & Marketplace
landing pages, and prints every internal `/dashboard/...` link found —
including top-level products (Continuous Delivery, Cluster Management,
Extensions, etc.), Users & Authentication, Global Settings,
Projects/Namespaces, and Apps & Marketplace sub-pages.

Compare the output against the [reference route list](#reference-route-list)
below:
- **New routes** (a product that didn't exist before) → add them to the
  audit batch in Step 3.
- **Missing/renamed routes** (a route 404s with "Resource type X not
  found" or "Product X not found") → the slug changed; find the new one
  from this script's output and update the reference list at the bottom
  of this file.

> Note: `list-routes.mjs` only finds links rendered in the DOM of the
> pages it visits. Workload/storage/RBAC resource-type list pages
> (Deployments, Pods, Services, ConfigMaps, Ingresses, PVCs, Roles, …)
> live behind collapsible nav groups and won't appear here — they're
> already in the [reference route list](#reference-route-list) by their
> stable Kubernetes API names.

---

## Step 3: Run the mobile audit

`audit.mjs` navigates to each given path at 390×844 (iPhone 14 Pro),
screenshots it (including scrolled views), and reports overflow/overlap
issues to `playwright/audit-results.json`.

Run it across the full [reference route list](#reference-route-list) in
a few batches (one call per logical group keeps output manageable):

```bash
cd playwright
node audit.mjs /dashboard/c/local/explorer /dashboard/c/local/explorer/node /dashboard/c/local/explorer/projectsnamespaces /dashboard/c/local/settings /dashboard/c/local/auth

node audit.mjs /dashboard/c/local/explorer/apps.deployment /dashboard/c/local/explorer/pod /dashboard/c/local/explorer/service /dashboard/c/local/explorer/configmap /dashboard/c/local/explorer/secret

node audit.mjs /dashboard/c/local/explorer/persistentvolumeclaim /dashboard/c/local/explorer/persistentvolumeclaim/create /dashboard/c/local/explorer/networking.k8s.io.ingress /dashboard/c/local/explorer/rbac.authorization.k8s.io.role

node audit.mjs /dashboard/c/local/apps/charts /dashboard/c/local/apps/catalog.cattle.io.app /dashboard/c/local/apps/catalog.cattle.io.clusterrepo /dashboard/c/local/apps/catalog.cattle.io.operation
```

Then sample **detail and edit pages**, since their layouts differ from
list pages (sidebars, tab bars, form grids). Pick one real resource per
type:

```bash
kubectl get deployment,svc,configmap,secret,pvc,role -A | head -20
```

...and audit a detail route for each, e.g.
`/dashboard/c/local/explorer/service/<namespace>/<name>`, plus one chart
detail page from `/dashboard/c/local/apps/charts` (click into any chart
to get its `?repo-type=...&repo=...&chart=...&version=...` URL).

> **Windows/Git Bash gotcha**: if running these via the `Bash` tool on
> Windows, prefix with `MSYS_NO_PATHCONV=1` — otherwise Git Bash mangles
> leading-`/dashboard/...` arguments into Windows paths. PowerShell does
> not have this problem.

---

## Step 4: Triage `audit-results.json`

For each route, check:

1. **`overflowing`** — elements wider than the 390px viewport.
2. **`overlapsCount` / `overlaps`** — visually colliding elements.
3. **`consoleErrors`** — JS runtime errors (a renamed selector that
   `mobile.js` depends on will often throw here).
4. **`docScrollWidth` vs `docClientWidth`** — check this **even if
   `overflowing` is empty**. `audit.mjs`'s overflow check intersects
   element rects with ancestor clip boxes, so a genuinely overflowing
   element nested inside a non-overflowing ancestor can be missed. If
   `docScrollWidth > docClientWidth + 2`, something is overflowing —
   find it with a raw (non-clipped) scan:
   ```js
   await page.evaluate(() => {
     const VW = window.innerWidth;
     return [...document.querySelectorAll('body *')]
       .map(el => ({ el, r: el.getBoundingClientRect() }))
       .filter(({ r }) => r.width > 0 && r.right > VW + 2)
       .sort((a, b) => b.r.right - a.r.right)
       .slice(0, 10)
       .map(({ el, r }) => ({
         tag: el.tagName,
         classes: [...el.classList].slice(0, 6).join(' '),
         right: Math.round(r.right),
         w: Math.round(r.width),
       }));
   });
   ```

For any flagged route, open the screenshots in
`playwright/screenshots/audit_<slug>_*.png` to confirm visually before
fixing.

---

## Step 5: Fix loop

For each confirmed issue:

1. Identify the broken selector. If a class `mobile.css` targets no
   longer exists (check via `page.evaluate(() =>
   document.querySelector('.old-class'))` returning `null`), Rancher
   renamed it — find the new class name on the equivalent element in the
   live DOM and update the rule's selector. Otherwise it's usually a new
   layout that needs a new rule (see the
   [pitfall reference](#reference-known-css-pitfalls)).
2. Edit `overlay/mobile.css` (or `overlay/mobile.js`).
3. **Sync to the Helm copy**:
   ```bash
   cp overlay/mobile.css helm/rancher-saddle/files/mobile.css
   # if mobile.js changed too:
   cp overlay/mobile.js helm/rancher-saddle/files/mobile.js
   ```
4. Format, lint, and verify the sync:
   ```bash
   npx prettier --write 'overlay/**/*.{js,css}'
   npm run lint
   npm run test:helm
   ```
   `test:helm` includes a byte-for-byte diff check between
   `overlay/{mobile.css,mobile.js}` and
   `helm/rancher-saddle/files/{mobile.css,mobile.js}` — it fails loudly
   if you forget step 3 or if prettier rewrote one copy but not the
   other (re-run step 3 and this command again in that case).
5. Deploy to the test cluster:
   ```bash
   helm upgrade rancher-saddle ./helm/rancher-saddle -n cattle-system --reuse-values
   kubectl rollout status deployment/rancher-saddle -n cattle-system --timeout=60s
   ```
6. Re-run `audit.mjs` (and `screenshot.mjs` for a visual check) on the
   affected route(s) to confirm the fix and check for regressions on
   nearby pages.
7. Repeat until **all** routes in Step 3 are clean.

---

## Step 6: Final regression pass

```bash
npm run lint
npm test            # unit + integration
npm run test:helm
```

All must pass. Then re-run the full Step 3 audit batch one more time as
a final sanity check.

---

## Step 7: Cut a release

A `vX.Y.Z` git tag triggers CI to package the Helm chart at that version
and push it to `oci://ghcr.io/<owner>/charts/rancher-saddle`
(`.github/workflows/ci-cd.yml`).

1. Bump `version` (and `appVersion`) in
   [`helm/rancher-saddle/Chart.yaml`](helm/rancher-saddle/Chart.yaml).
   Use a **patch** bump for CSS-only fixes, **minor** if new
   functionality/config was added.
2. Commit the chart bump along with all `mobile.css`/`mobile.js`/test
   changes from this workflow.
3. Tag and push:
   ```bash
   git tag vX.Y.Z
   git push origin master vX.Y.Z
   ```

> Tagging and pushing publishes a release — confirm with the user before
> pushing the tag.

---

## Step 8: Report back

Summarize for the user:
- Which Rancher version was verified against (`/dashboard/about`).
- Every route audited, and which were already clean vs. fixed.
- The new chart version/tag.
- Any new CSS pitfalls discovered — add them to the reference table
  below for next time.

---

## Reference: known CSS pitfalls

These recur because Rancher's dashboard leans on CSS Grid/Flexbox
two-column layouts with hardcoded desktop pixel widths. Recognizing the
pattern is faster than re-deriving it:

| Symptom | Cause | Fix |
|---|---|---|
| A grid container is squeezed to ~0 width, content invisible | `grid-template-columns: 1fr ...` — `1fr` ≡ `minmax(auto, 1fr)`, so the track won't shrink below its content's min size | Add `grid-template-columns: 1fr` **and** `min-width: 0` on the container; give the spanning child `grid-column: 1 / -1` |
| A flex item stays at its content's min-width despite `flex: 1 1 0%` | A descendant has a hardcoded `min-width`/`width` in px (e.g. a child grid with `grid-template-columns: 400px ...`) — the item's automatic `min-width: auto` = content min-size wins | Cascade `min-width: 0 !important; max-width: 100% !important; width: 100% !important` down the chain, **and** override the offending fixed-px property on the descendant (e.g. `grid-template-columns: 1fr !important`) |
| A page-action button (e.g. "Install this version", "Show Configuration") is pushed off-screen | Title bar / chart header is `flex-nowrap` with a wide fixed-width action button | `flex-wrap: wrap !important` on the container; `width: 100% !important` on the action button's wrapper so it drops to its own row |
| A "main content + sidebar" page (chart detail, filter panel + cards) overflows ~300-400px | Two-column flex row where the sidebar has a fixed px width and/or the main column has `min-width: 400px` | `flex-direction: column !important` on the row; `width: 100%; min-width: 0; max-width: 100%` on both children; override any hardcoded `grid-template-columns`/`min-width`/`max-width` on descendants |
| Long values in Labels/Annotations/chips get clipped instead of wrapping | Chip/tag elements have `white-space: nowrap` or no `word-break` | Add `white-space: normal; word-break: break-all` (or similar) to the chip/value class |
| List/detail page header title truncates to a few characters, action buttons overflow | `header.with-subheader` is a CSS Grid with fixed-width title/action columns | Let the title column shrink (`min-width: 0`), wrap the action column (`flex-wrap: wrap`) |
| `audit.mjs` reports `overflowing: []` but `docScrollWidth > docClientWidth` | The overflowing element is nested inside a non-overflowing ancestor, so `visibleRect()`'s clip-intersection hides it | Use the raw scan in [Step 4](#step-4-triage-audit-resultsjson) to find the real culprit |
| Need to scope a fix to one page layout without affecting other generic elements elsewhere | A class like `.wrapper` or `.actions` is reused across many unrelated pages | Use the `:has()` relational selector to scope, e.g. `.wrapper:has(> .filter-panel) { flex-direction: column !important; }` (safe — mobile.css is plain CSS, no Autoprefixer, and `:has()` has broad modern mobile browser support) |

---

## Reference: route list

Stable Kubernetes-API-derived resource list/detail/create routes plus
Rancher product pages, as of Rancher v2.14. Update this list whenever
[Step 2](#step-2-discover-routes-for-the-new-rancher-version) finds a
renamed/new/removed route.

**Cluster & nav-level**
- `/dashboard/c/local/explorer` — Cluster Dashboard
- `/dashboard/c/local/explorer/node` — Nodes
- `/dashboard/c/local/explorer/projectsnamespaces` — Projects/Namespaces
- `/dashboard/c/local/settings` — Global Settings
- `/dashboard/c/local/auth` — Users & Authentication

**Workloads**
- `/dashboard/c/local/explorer/apps.deployment` — Deployments
- `/dashboard/c/local/explorer/pod` — Pods
- `/dashboard/c/local/explorer/apps.statefulset` — StatefulSets
- `/dashboard/c/local/explorer/batch.cronjob` — CronJobs

**Service discovery / config / storage**
- `/dashboard/c/local/explorer/service` — Services
- `/dashboard/c/local/explorer/configmap` — ConfigMaps
- `/dashboard/c/local/explorer/secret` — Secrets
- `/dashboard/c/local/explorer/persistentvolumeclaim` — PVCs
- `/dashboard/c/local/explorer/persistentvolumeclaim/create` — PVC create form
- `/dashboard/c/local/explorer/networking.k8s.io.ingress` — Ingresses

**RBAC**
- `/dashboard/c/local/explorer/rbac.authorization.k8s.io.role` — Roles

**Apps & Marketplace**
- `/dashboard/c/local/apps/charts` — Charts list
- `/dashboard/c/local/apps/catalog.cattle.io.app` — Installed Apps
- `/dashboard/c/local/apps/catalog.cattle.io.clusterrepo` — Repositories
- `/dashboard/c/local/apps/catalog.cattle.io.operation` — Recent Operations

**Other top-level products** (presence/relevance varies by cluster setup
— check via `list-routes.mjs`)
- `/dashboard/c/_/manager/provisioning.cattle.io.cluster` — Cluster Management
- `/dashboard/c/_/fleet` — Continuous Delivery
