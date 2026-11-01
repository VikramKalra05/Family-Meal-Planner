"use client";

import { useEffect } from "react";

/** Registers the PWA service worker (kept at /sw.js — SwCleanup protects it). */
export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
