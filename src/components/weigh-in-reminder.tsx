"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasLoggedToday } from "@/app/(app)/progress/actions";
import { ensurePushSubscription } from "@/lib/push-client";

// One subscribe attempt per page load; the POST is an idempotent upsert.
let pushSubscribed = false;
async function registerPushOnce(): Promise<void> {
  if (pushSubscribed) return;
  pushSubscribed = true;
  await ensurePushSubscription();
}

/**
 * Weigh-in reminders, two layers:
 *  - In-app (this component): fires a browser notification while a tab is open.
 *  - Background: once permission is granted this device's push subscription is
 *    registered server-side and src/lib/push-scheduler.ts delivers the same
 *    reminder even with the app closed.
 * Cadence in both layers: only after the chosen time, max 2/day, 4h apart,
 * never on a day that's already logged.
 */
export function WeighInReminder({ weighInTime }: { weighInTime: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!weighInTime || typeof window === "undefined" || !("Notification" in window)) return;

    // Ask for permission once, only after the user opted in via a reminder time.
    if (Notification.permission === "default" && !localStorage.getItem("weigh-asked")) {
      localStorage.setItem("weigh-asked", "1");
      void Notification.requestPermission().then((permission) => {
        if (permission === "granted") registerPushOnce().catch(() => {});
      });
    }
    if (Notification.permission === "granted") registerPushOnce().catch(() => {});

    const tick = async () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (hhmm < weighInTime) return;

      // Cadence: at most 2 nudges per day, 4h apart, remembered across
      // restarts (localStorage), and never on a day that's already logged.
      const dayKey = `weigh-notify-${now.toISOString().slice(0, 10)}`;
      const count = Number(localStorage.getItem(dayKey) ?? 0);
      if (count >= 2) return;

      if (await hasLoggedToday()) return;

      const lastAt = Number(localStorage.getItem("weigh-notify-at") ?? 0);
      if (count > 0 && Date.now() - lastAt < 4 * 60 * 60 * 1000) return;

      localStorage.setItem(dayKey, String(count + 1));
      localStorage.setItem("weigh-notify-at", String(Date.now()));
      if (Notification.permission === "granted") {
        const n = new Notification("Time to weigh in ⚖️", {
          body: "Log today's weight — your targets follow your body.",
        });
        n.onclick = () => {
          window.focus();
          router.push("/progress");
        };
      }
    };

    void tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [weighInTime, router]);

  return null;
}
