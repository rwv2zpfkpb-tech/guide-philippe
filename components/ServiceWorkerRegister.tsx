"use client";

import { useEffect } from "react";

// Registers public/sw.js so the installed PWA gets an offline fallback page
// (app/offline/) and a small same-origin static-asset cache instead of the
// browser's default network-error screen. Silent no-op on unsupported
// browsers/insecure contexts (navigator.serviceWorker is undefined there) —
// this is a progressive enhancement, not a requirement for the app to work.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
