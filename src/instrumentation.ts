/**
 * Next.js instrumentation hook — runs once when the server process boots
 * (dev or production). Used to start the background push scheduler so
 * weigh-in reminders fire even with no browser tab open. The globalThis
 * guard prevents double-starts across HMR reloads.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const flag = globalThis as { __fmpPushScheduler?: boolean };
  if (flag.__fmpPushScheduler) return;
  flag.__fmpPushScheduler = true;

  const { startPushScheduler } = await import("@/lib/push-scheduler");
  startPushScheduler();
}
