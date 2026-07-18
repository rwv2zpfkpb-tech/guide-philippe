// Minimal service worker: offline fallback for navigations + a small
// same-origin static-asset cache. This is NOT a full offline-data cache —
// the app is Supabase/auth-cookie driven (restaurant lists, comments,
// admin data), and caching that HTML would risk serving stale or
// wrong-session content across users on a shared device. Scope is
// deliberately narrow: keep the installed PWA from hitting the browser's
// bare network-error screen, and skip a network round trip for the
// PWA's own icons/manifest.
const CACHE_NAME = "gp-static-v1";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [OFFLINE_URL, "/icons/192", "/icons/512", "/manifest.webmanifest"];

// Same-origin, non-personalized, rarely-changing — safe to cache-first.
const CACHEABLE_PATHS = /^\/(icons\/192|icons\/512|icon|apple-icon|manifest\.webmanifest)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations (page loads): always go to the network first — this app's
  // pages are auth-gated and per-request dynamic, never safe to serve
  // stale from cache. Only fall back to the offline page when the network
  // request itself fails outright (i.e. no connectivity).
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (CACHEABLE_PATHS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
  }
});
