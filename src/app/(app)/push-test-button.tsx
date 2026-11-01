"use client";

import { useState } from "react";

/**
 * Sends a test push through the background scheduler path so the member can
 * confirm their device actually receives notifications with the app closed.
 */
export function PushTestButton() {
  const [state, setState] = useState<{ busy: boolean; message: string | null; ok: boolean }>({
    busy: false,
    message: null,
    ok: true,
  });

  async function send() {
    setState({ busy: true, message: null, ok: true });
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = (await res.json()) as { sent?: number; removed?: number; error?: string };
      if (!res.ok) {
        setState({ busy: false, message: data.error ?? "Test failed.", ok: false });
        return;
      }
      setState({
        busy: false,
        ok: (data.sent ?? 0) > 0,
        message:
          (data.sent ?? 0) > 0
            ? `Sent to ${data.sent} device${data.sent === 1 ? "" : "s"} — check your notifications.`
            : "No registered device found. Allow notifications on this device first (set a weigh-in time, then reload).",
      });
    } catch {
      setState({ busy: false, message: "Network error — is the dev server up?", ok: false });
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void send()}
        disabled={state.busy}
        className="rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
      >
        {state.busy ? "Sending…" : "🔔 Test push"}
      </button>
      {state.message && (
        <p className={`max-w-56 text-right text-[10px] leading-snug ${state.ok ? "text-neutral-700" : "text-red-700"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
