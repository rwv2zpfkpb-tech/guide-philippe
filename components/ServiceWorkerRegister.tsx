"use client";

import { useEffect } from "react";

// Registers public/sw.js so the installed PWA gets an offline fallback page
// (app/offline/) and a small same-origin static-asset cache instead of the
// browser's default network-error screen. Silent no-op on unsupported
// browsers/insecure contexts (navigator.serviceWorker is undefined there) —
// this is a progressive enhancement, not a requirement for the app to work.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // A previously installed production worker can otherwise keep serving
      // stale Turbopack development chunks on localhost. Clean it up once and
      // keep development fully network-driven.
      void Promise.all([
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))),
        "caches" in window
          ? caches.keys().then((keys) => Promise.all(
              keys.filter((key) => key.startsWith("gp-")).map((key) => caches.delete(key))
            ))
          : Promise.resolve([]),
      ]);
      return;
    }

    // updateViaCache: "none" keeps browser-managed update checks from
    // accepting a stale HTTP-cache entry. register() already participates
    // in that lifecycle, so an additional update() request is unnecessary.
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {});
  }, []);

  return null;
}
