/* Rancher Saddle — service worker
 *
 * Deliberately minimal. Its job is to make the Rancher dashboard installable
 * as a PWA, not to cache the app. Rancher is a live SPA backed by
 * authenticated API calls and WebSockets — caching its assets or data leads
 * to stale, broken states — so this worker leaves all of that traffic
 * completely untouched (it never calls respondWith for it, which means the
 * browser handles those requests exactly as if no worker existed).
 *
 * The only thing it intercepts is top-level navigations: it tries the network
 * first and, only if that fails (offline / proxy unreachable), serves a small
 * offline page. Served from /_saddle/ but claims the whole origin as scope
 * because nginx sends `Service-Worker-Allowed: /` with this file.
 */
'use strict';

var CACHE = 'rs-saddle-v1';
var OFFLINE_URL = '/_saddle/offline.html';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.add(OFFLINE_URL);
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== CACHE;
            })
            .map(function (k) {
              return caches.delete(k);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Only handle full-page navigations. Everything else (API calls, JS/CSS
  // bundles, images, WebSocket upgrades) falls through to the browser's
  // default handling — we never want to serve those from a cache.
  if (req.mode !== 'navigate') {
    return;
  }

  event.respondWith(
    fetch(req).catch(function () {
      return caches.match(OFFLINE_URL);
    }),
  );
});
