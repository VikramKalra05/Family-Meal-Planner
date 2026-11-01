"use client";

import { useEffect } from "react";

/**
 * Dev machines reuse localhost:3000 across projects. A service worker
 * registered by an earlier project keeps serving its cached app shell on
 * normal reloads (hard refresh bypasses it), which looks like "the wrong app
 * is on my port". This component unregisters any service worker that isn't
 * ours and reloads once, so the origin self-heals without manual DevTools
 * work. Our own PWA worker (M6) will live at /sw.js and is left alone.
 */
export function SwCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        let removed = false;
        for (const reg of registrations) {
          const script =
            reg.active?.scriptURL ?? reg.waiting?.scriptURL ?? reg.installing?.scriptURL ?? "";
          if (new URL(script, window.location.href).pathname === "/sw.js") continue;
          await reg.unregister();
          removed = true;
        }
        if (removed && !sessionStorage.getItem("sw-cleanup-reloaded")) {
          sessionStorage.setItem("sw-cleanup-reloaded", "1");
          window.location.reload();
        }
      })
      .catch(() => {
        // SW API unavailable or blocked — nothing to clean.
      });
  }, []);

  return null;
}
