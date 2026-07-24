// App-shell service worker. Personalized HTML and React Server Component
// responses are deliberately never cached: both depend on the current
// Supabase auth cookie and could otherwise leak one user's view to another
// user on a shared device. Only versioned Next.js assets and safe,
// same-origin presentation assets are persisted.
const CACHE_PREFIX = "gp-";
const PRECACHE_NAME = `${CACHE_PREFIX}precache-v2`;
const IMMUTABLE_NAME = `${CACHE_PREFIX}immutable-v2`;
const PRESENTATION_NAME = `${CACHE_PREFIX}presentation-v2`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/icons/192", "/icons/512", "/manifest.webmanifest"];
const MAX_PRESENTATION_ENTRIES = 80;

// Same-origin, non-personalized assets which may change without a hashed URL.
const PRESENTATION_PATHS =
  /^\/(?:icons\/(?:192|512)|icon|apple-icon|manifest\.webmanifest|favicon\.ico|map-style(?:-cloud)?(?:-dark|-light)?\.json)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const currentCaches = new Set([PRECACHE_NAME, IMMUTABLE_NAME, PRESENTATION_NAME]);
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && !currentCaches.has(key))
          .map((key) => caches.delete(key))
      );

      // Navigation preload starts the document request while the service
      // worker boots, avoiding extra startup latency on supported browsers.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

async function putSuccessfulResponse(cacheName, request, response) {
  if (!response || !response.ok || response.type === "opaque") return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { cacheName });
  if (cached) return cached;

  const response = await fetch(request);
  await putSuccessfulResponse(cacheName, request, response);
  return response;
}

async function staleWhileRevalidate(event, request) {
  const cachedResponse = caches.match(request, { cacheName: PRESENTATION_NAME });
  const networkResponse = fetch(request).then(async (response) => {
    await putSuccessfulResponse(PRESENTATION_NAME, request, response);
    await trimCache(PRESENTATION_NAME, MAX_PRESENTATION_ENTRIES);
    return response;
  });
  // Register background work before yielding from the fetch event. Safari is
  // strict about waitUntil() being called while the event is still active.
  event.waitUntil(networkResponse.catch(() => undefined));

  const cached = await cachedResponse;
  if (cached) {
    return cached;
  }
  return networkResponse;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Documents remain network-only because they are auth/session-specific.
  // Navigation preload makes this faster without storing personalized HTML.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return (await event.preloadResponse) || (await fetch(request));
        } catch {
          return (await caches.match(OFFLINE_URL, { cacheName: PRECACHE_NAME })) || Response.error();
        }
      })()
    );
    return;
  }

  // Next's build assets contain a content hash in their URL and are safe to
  // keep indefinitely. This covers JS, CSS and locally emitted font files.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, IMMUTABLE_NAME));
    return;
  }

  // Reuse presentation assets immediately, then refresh them in the
  // background for the next app launch.
  const isPresentationAsset = ["image", "style", "font"].includes(request.destination);
  if (PRESENTATION_PATHS.test(url.pathname) || isPresentationAsset) {
    event.respondWith(staleWhileRevalidate(event, request));
  }
});
