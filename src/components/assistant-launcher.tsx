"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AiWorking } from "@/components/ai-working";

/**
 * Rasoi AI — the ✨ header button + right-side assistant panel. Fully
 * self-contained: the only integration point is the single
 * `<AssistantLauncher />` line in (app)/layout.tsx. Talks to
 * /api/ai/chat (ask) and /api/ai/chat/act (confirm a mutation proposal).
 */

interface Proposal {
  action: Record<string, unknown>;
  summary: string;
}

interface ProviderOption {
  id: string;
  label: string;
  model: string;
  is_default: boolean;
}

interface PanelMessage {
  key: string;
  role: "user" | "assistant" | "system";
  content: string;
  tools?: string[];
  proposal?: Proposal | null;
  /** For mutation proposals: where the confirm flow stands. */
  state?: "pending" | "confirmed" | "cancelled";
}

type Busy = { kind: "thinking" } | { kind: "confirming"; messageKey: string } | null;

const SUGGESTIONS = [
  "What's for dinner Thursday?",
  "Log 2 roti and dal for lunch",
  "What can I cook with my pantry?",
  "How's my protein this week?",
];

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Rasoi AI — your meal planner assistant"
        className="mr-2 rounded-none border-2 border-neutral-900 bg-white px-2.5 py-1.5 text-sm font-extrabold shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
      >
        ✨
      </button>
      {open && <AssistantPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function AssistantPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [provider, setProvider] = useState<{ label: string; model: string } | null | undefined>(undefined);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [, startSend] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Esc closes the panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  // Load (or reload) the persisted thread. Async state updates land in
  // promise callbacks — no synchronous setState inside the effect.
  function fetchThread() {
    setHistoryLoading(true);
    fetch("/api/ai/chat")
      .then((r) => r.json())
      .then(
        (data: {
          provider: { label: string; model: string } | null;
          providers?: ProviderOption[];
          messages?: StoredRow[];
          historyError?: string | null;
          error?: string;
        }) => {
          setProvider(data.provider);
          setHistoryError(data.historyError ?? null);
          if (data.providers) {
            setProviders(data.providers);
            // Preselect the member's default provider (★) for the conversation.
            setSelectedProviderId((cur) => cur || data.providers?.find((p) => p.is_default)?.id || data.providers?.[0]?.id || "");
          }
          if (data.messages) {
            setMessages(
              data.messages.map((m, i) => ({
                key: `h${i}`,
                role: m.role,
                content: m.content,
                tools: m.meta?.tools ?? undefined,
                proposal: m.meta?.proposal ?? null,
                state: m.meta?.proposal ? "confirmed" : undefined,
              })),
            );
          }
        },
      )
      .catch(() => setHistoryError("Could not reach the server — is it up?"))
      .finally(() => setHistoryLoading(false));
  }

  useEffect(() => {
    // Fire after mount (not synchronously in the effect body) so the loading
    // state doesn't cascade renders; ⟳ History re-runs the same loader.
    const id = setTimeout(fetchThread, 0);
    return () => clearTimeout(id);
  }, []);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { key: `u${Date.now()}`, role: "user", content: trimmed }]);
    setBusy({ kind: "thinking" });
    startSend(async () => {
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: trimmed, ...(selectedProviderId ? { provider_id: selectedProviderId } : {}) }),
        });
        const data = (await res.json()) as {
          reply?: string;
          toolTrace?: string[];
          proposal?: Proposal | null;
          error?: string;
        };
        if (!res.ok || data.error) {
          setError(data.error ?? "Something went wrong — try again.");
        } else {
          setMessages((prev) => [
            ...prev,
            {
              key: `a${Date.now()}`,
              role: "assistant",
              content: data.reply ?? "",
              tools: data.toolTrace?.length ? data.toolTrace : undefined,
              proposal: data.proposal ?? null,
              state: data.proposal ? "pending" : undefined,
            },
          ]);
        }
      } catch {
        setError("Network error — is the server up?");
      } finally {
        setBusy(null);
      }
    });
  }

  function confirm(messageKey: string, proposal: Proposal) {
    setBusy({ kind: "confirming", messageKey });
    setError(null);
    startSend(async () => {
      try {
        const res = await fetch("/api/ai/chat/act", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: proposal.action, ...(selectedProviderId ? { provider_id: selectedProviderId } : {}) }),
        });
        const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
        const message = data.message ?? data.error ?? "Done.";
        setMessages((prev) => [
          ...prev.map((m) => (m.key === messageKey ? { ...m, state: "confirmed" as const } : m)),
          { key: `r${Date.now()}`, role: "assistant" as const, content: `${data.ok ? "✅" : "⚠️"} ${message}` },
        ]);
      } catch {
        setError("Network error while confirming — check the app before retrying.");
      } finally {
        setBusy(null);
      }
    });
  }

  function cancel(messageKey: string) {
    setMessages((prev) => [
      ...prev.map((m) => (m.key === messageKey ? { ...m, state: "cancelled" as const } : m)),
      { key: `c${Date.now()}`, role: "system", content: "Cancelled — nothing was changed." },
    ]);
  }

  const threadEmpty = messages.filter((m) => m.role !== "system").length === 0;

  return (
    <>
      {/* Mobile backdrop — on desktop the panel behaves like Docs' Gemini pane */}
      <button
        type="button"
        aria-label="Close assistant"
        onClick={onClose}
        className="fixed inset-0 z-30 bg-neutral-900/20 md:hidden"
      />
      <style>{`@keyframes rasoi-slide-in { from { transform: translateX(28px); opacity: 0.4 } to { transform: translateX(0); opacity: 1 } }`}</style>
      <section
        role="dialog"
        aria-label="Rasoi AI assistant"
        style={{ animation: "rasoi-slide-in 0.22s cubic-bezier(0.2, 1.1, 0.4, 1) both" }}
        className="fixed right-0 top-0 bottom-16 z-40 flex w-full max-w-[92vw] flex-col border-l-2 border-neutral-900 bg-white shadow-[-6px_6px_0_#111] sm:w-[400px] md:bottom-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-neutral-900 bg-yellow-300 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-wide text-neutral-900">✨ Rasoi AI</p>
            {providers.length >= 2 ? (
              <select
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                aria-label="Model for this conversation"
                title="Model for this conversation — your app-wide default in Settings is untouched"
                className="mt-1 w-full max-w-[210px] truncate rounded-none border-2 border-neutral-900 bg-white px-1 py-0.5 text-[10px] font-bold text-neutral-900 focus:outline-none"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.is_default ? "★ " : ""}
                    {p.label} · {p.model}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[10px] text-neutral-700">
                {provider ? `via ${provider.label} · ${provider.model}` : "your kitchen copilot"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchThread()}
              disabled={historyLoading}
              title="Reload your previous chats"
              className="rounded-none border-2 border-neutral-900 bg-white px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
            >
              {historyLoading ? "◌ Loading…" : "⟳ History"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close assistant"
              className="rounded-none border-2 border-neutral-900 bg-white px-2 py-1 text-xs font-extrabold shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-[#FFFBEF] px-3 py-4">
          {historyError && (
            <div className="nb-shake border-2 border-neutral-900 bg-red-50 p-3 text-xs font-medium text-red-800 shadow-[2px_2px_0_#111]">
              <p className="font-extrabold uppercase tracking-wide">Chat history couldn&apos;t load</p>
              <p className="mt-1">
                {historyError} — if this mentions a missing table, run{" "}
                <code className="bg-white px-1">supabase/migrations/0010_ai_chat.sql</code> in the Supabase SQL editor.
              </p>
            </div>
          )}

          {threadEmpty && provider !== null && !historyError && (
            <div className="space-y-3 px-1">
              <div className="border-2 border-neutral-900 bg-lime-200 p-3 text-xs font-medium text-neutral-900 shadow-[2px_2px_0_#111]">
                Namaste! I can answer anything about your plans, meals, pantry, weight and family — and I can{" "}
                <strong>do</strong> things for you (log meals, add recipes, regenerate the week…) after you
                confirm each change.
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-none border-2 border-neutral-900 bg-white px-2.5 py-1.5 text-left text-[11px] font-semibold text-neutral-700 shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {provider === null && (
            <div className="border-2 border-neutral-900 bg-amber-100 p-4 text-xs font-medium text-neutral-900 shadow-[2px_2px_0_#111]">
              <p className="font-extrabold uppercase tracking-wide">No AI provider yet</p>
              <p className="mt-1">
                Rasoi AI runs on your own AI key. Add one in{" "}
                <Link href="/settings" onClick={onClose} className="font-bold underline">
                  Settings → AI Providers
                </Link>{" "}
                and come right back.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.key}>
              {m.role === "system" && (
                <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{m.content}</p>
              )}
              {m.role === "user" && (
                <div className="ml-6 border-2 border-neutral-900 bg-yellow-300 px-3 py-2 text-xs font-medium text-neutral-900 shadow-[2px_2px_0_#111]">
                  {m.content}
                </div>
              )}
              {m.role === "assistant" && (
                <div className="mr-2 space-y-2">
                  {m.tools && m.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.tools.map((t, i) => (
                        <span
                          key={i}
                          className="border border-neutral-900 bg-lime-200 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-neutral-800"
                        >
                          ✓ {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.content && (
                    <div className="nb-stamp border-2 border-neutral-900 bg-white px-3 py-2 text-xs leading-relaxed text-neutral-900 shadow-[2px_2px_0_#111]">
                      {m.content}
                    </div>
                  )}
                  {m.proposal && (
                    <div className="border-2 border-neutral-900 bg-amber-100 p-3 shadow-[3px_3px_0_#111]">
                      <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">Confirm to run</p>
                      <p className="mt-1 text-xs font-bold text-neutral-900">{m.proposal.summary}</p>
                      {m.state === "pending" ? (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => confirm(m.key, m.proposal!)}
                            className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
                          >
                            {busy?.kind === "confirming" && busy.messageKey === m.key ? "◌ Running…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => cancel(m.key)}
                            className="rounded-none border-2 border-neutral-900 bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[10px] font-extrabold uppercase tracking-wide text-neutral-500">
                          {m.state === "confirmed" ? "✓ handled" : "cancelled"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {busy?.kind === "thinking" && (
            <AiWorking compact label="Thinking through your kitchen…" hint="Reading your plan, pantry and progress as needed." />
          )}

          {error && (
            <p className="nb-shake rounded-none bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <form
          className="border-t-2 border-neutral-900 bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={2}
              placeholder="Ask anything, or say what to do…"
              disabled={busy !== null || provider === null}
              className="flex-1 resize-none rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-xs transition focus:shadow-[3px_3px_0_#111] focus:outline-none disabled:bg-neutral-100"
            />
            <button
              type="submit"
              disabled={busy !== null || !input.trim() || provider === null}
              aria-label="Send"
              className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-3 py-2.5 text-sm font-extrabold shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
            >
              ↑
            </button>
          </div>
          <p className="mt-1 text-[9px] text-neutral-400">
            Enter to send · Shift+Enter for a new line · every change asks first
          </p>
        </form>
      </section>
    </>
  );
}

/** Shape of rows returned by GET /api/ai/chat (server StoredMessage). */
interface StoredRow {
  role: "user" | "assistant" | "system";
  content: string;
  meta: {
    tools?: string[];
    proposal?: Proposal | null;
    kind?: string;
  } | null;
  created_at: string;
}
