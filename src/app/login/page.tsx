"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      setError(error.message);
    } else {
      setOtpSent(true);
    }
    setBusy(false);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-amber-50 p-6">
      <div className="w-full max-w-sm space-y-6 rounded-none bg-white p-8 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Family Meal Planner</h1>
          <p className="text-sm text-neutral-500">
            Personalized nutrition for everyone at your table.
          </p>
        </div>

        <button
          onClick={signInWithGoogle}
          disabled={busy}
          className="w-full rounded-none border-2 border-neutral-900 bg-white px-4 py-2.5 text-sm font-medium hover:bg-amber-50 disabled:opacity-60"
        >
          {busy ? "◌ Connecting to Google…" : "Continue with Google"}
        </button>

        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <span className="h-px flex-1 bg-neutral-200" /> or via phone OTP{" "}
          <span className="h-px flex-1 bg-neutral-200" />
        </div>

        {!otpSent ? (
          <form onSubmit={sendOtp} aria-busy={busy} className="space-y-3">
            <input
              type="tel"
              required
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-none border-2 border-neutral-900 px-4 py-2.5 text-sm focus:shadow-[3px_3px_0_#111] focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-none bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide disabled:opacity-60"
            >
              {busy ? "◌ Sending OTP…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} aria-busy={busy} className="space-y-3">
            <input
              inputMode="numeric"
              required
              placeholder="6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded-none border-2 border-neutral-900 px-4 py-2.5 text-center text-lg tracking-widest focus:shadow-[3px_3px_0_#111] focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-none bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide disabled:opacity-60"
            >
              {busy ? "◌ Verifying…" : "Verify & continue"}
            </button>
          </form>
        )}

        {error && <p className="text-center text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
