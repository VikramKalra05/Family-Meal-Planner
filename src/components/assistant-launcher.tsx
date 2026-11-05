"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { AiWorking } from "@/components/ai-working";

/** Gradient sparkle icon (icons8) — the assistant's mark. */
function AiSpark({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/icons/ai-spark.png"
      alt=""
      width={size}
      height={size}
      className={`select-none ${className}`}
      priority={size >= 20}
    />
  );
}

/**
 * Rasoi AI — the ✨ header button + the assistant panel. Fully
 * self-contained: the only integration points are the `<AssistantLauncher />`
 * line and the `#rasoi-dock` slot in (app)/layout.tsx.
 *
 * When open, the panel portals into the dock slot — a flex sibling of the
 * content column — so on desktop the page RESIZES around the chat instead of
 * being overlaid, and because the layout stays mounted across page switches
 * the conversation persists while you browse. On phones it overlays
 * full-width (the column has nothing to spare), above the bottom nav.
 * Talks to /api/ai/chat (ask) and /api/ai/chat/act (confirm a mutation).
 */

interface Proposal {
  action: Record<string, unknown>;
  summary: string;
}

interface ProviderOption {
  id: string;
  label: string;
  model: string;
  models?: string[] | null;
  favorite_models?: string[] | null;
  is_default: boolean;
}

/** One selectable (provider, model) pair for the chat header dropdown. */
interface ModelPair {
  key: string;
  providerId: string;
  model: string;
  label: string;
  is_default: boolean;
  isFavorite: boolean;
}

interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
}

interface PanelMessage {
  key: string;
  role: "user" | "assistant" | "system";
  content: string;
  tools?: string[];
  proposal?: Proposal | null;
  /** For mutation proposals: where the confirm flow stands. */
  state?: "pending" | "confirmed" | "cancelled";
  /** "label · model" caption — which brain answered this reply. */
  modelVia?: string;
}

type Busy = { kind: "thinking" } | { kind: "confirming"; messageKey: string } | null;

/** "providerId|model" → { provider_id, model } for the API payloads. */
function splitModelKey(key: string): { provider_id?: string; model?: string } {
  const sep = key.indexOf("|");
  if (sep <= 0) return {};
  const provider_id = key.slice(0, sep);
  const model = key.slice(sep + 1);
  return {
    ...(provider_id ? { provider_id } : {}),
    ...(model ? { model } : {}),
  };
}

const SUGGESTIONS = [
  "What's for dinner Thursday?",
  "Log 2 roti and dal for lunch",
  "What can I cook with my pantry?",
  "How's my protein this week?",
];

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const [dock, setDock] = useState<HTMLElement | null>(null);

  // Locate the layout's dock slot after mount (client-only — SSR has no DOM).
  useEffect(() => {
    const id = window.setTimeout(() => setDock(document.getElementById("rasoi-dock")), 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Rasoi AI — your meal planner assistant"
        className={`mr-2 flex items-center rounded-none border-2 border-neutral-900 px-2.5 py-1.5 shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none ${
          open ? "bg-yellow-300" : "bg-white"
        }`}
      >
        <AiSpark size={20} />
      </button>
      {open && dock && createPortal(<AssistantPanel onClose={() => setOpen(false)} />, dock)}
    </>
  );
}

function AssistantPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [provider, setProvider] = useState<{ label: string; model: string } | null | undefined>(undefined);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  /** Alias → real name, for display only. Never sent to the AI provider. */
  const [memberMap, setMemberMap] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [favBusy, setFavBusy] = useState<string | null>(null);
  /** "chat" = conversation; "models" = full-panel model picker. */
  const [view, setView] = useState<"chat" | "models">("chat");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [, startSend] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  /** Aborts the in-flight turn (Stop button). */
  const stopRef = useRef<AbortController | null>(null);
  const chatsBoxRef = useRef<HTMLDivElement>(null);
  // Ref mirrors so the single Esc/click-outside handlers know layer order
  // without re-subscribing on every state change.
  const historyOpenRef = useRef(false);
  const viewRef = useRef<"chat" | "models">("chat");
  function setHistoryOpenSafe(v: boolean) {
    historyOpenRef.current = v;
    setHistoryOpen(v);
  }
  function setViewSafe(v: "chat" | "models") {
    viewRef.current = v;
    setView(v);
  }

  // Esc closes popovers first, then the panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (viewRef.current === "models") {
          setViewSafe("chat");
          return;
        }
        if (historyOpenRef.current) {
          setHistoryOpenSafe(false);
          return;
        }
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Click outside a popover closes it.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (historyOpenRef.current && chatsBoxRef.current && !chatsBoxRef.current.contains(t)) setHistoryOpenSafe(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  // Load (or reload) the persisted thread. Async state updates land in
  // promise callbacks — no synchronous setState inside the effect.
  function fetchThread(conversation?: string | null) {
    setHistoryLoading(true);
    const qs = conversation ? `?conversation=${encodeURIComponent(conversation)}` : "";
    fetch(`/api/ai/chat${qs}`)
      .then((r) => r.json())
      .then(
        (data: {
          provider: { label: string; model: string } | null;
          providers?: ProviderOption[];
          conversations?: ConversationSummary[];
          activeConversationId?: string | null;
          memberMap?: Record<string, string>;
          messages?: StoredRow[];
          historyError?: string | null;
          error?: string;
        }) => {
          setProvider(data.provider);
          setHistoryError(data.historyError ?? null);
          if (data.memberMap) setMemberMap(data.memberMap);
          if (data.providers) {
            setProviders(data.providers);
            const pairs = (data.providers ?? []).flatMap((p: ProviderOption) =>
              (p.models?.length ? p.models : [p.model]).map((m: string) => `${p.id}|${m}`),
            );
            // Preselect the member's default provider (★) × its default model.
            const def = data.providers?.find((p: ProviderOption) => p.is_default) ?? data.providers?.[0];
            setSelectedModelKey((cur: string) => (cur && pairs.includes(cur) ? cur : def ? `${def.id}|${def.model}` : ""));
          }
          if (data.conversations) setConversations(data.conversations);
          if (data.activeConversationId !== undefined) setConversationId(data.activeConversationId);
          if (data.messages) {
            setMessages(
              data.messages.map((m, i) => ({
                key: `h${i}`,
                role: m.role,
                content: m.content,
                tools: m.meta?.tools ?? undefined,
                proposal: m.meta?.proposal ?? null,
                modelVia: m.meta?.model ?? undefined,
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
    const ac = new AbortController();
    stopRef.current = ac;
    startSend(async () => {
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            ...splitModelKey(selectedModelKey),
            ...(conversationId ? { conversation_id: conversationId } : {}),
          }),
          signal: ac.signal,
        });
        const data = (await res.json()) as {
          reply?: string;
          toolTrace?: string[];
          proposal?: Proposal | null;
          error?: string;
          stopped?: boolean;
          conversationId?: string | null;
          modelLabel?: string;
        };
        if (data.conversationId) {
          const newId = data.conversationId;
          setConversationId(newId);
          setConversations((prev) =>
            prev.some((c) => c.id === newId) ? prev : [{ id: newId, title: trimmed.slice(0, 48), created_at: new Date().toISOString() }, ...prev],
          );
        }
        if (data.stopped) {
          setMessages((prev) => [...prev, { key: `s${Date.now()}`, role: "system", content: "⏹ Stopped — the partial answer was discarded." }]);
        } else if (!res.ok || data.error) {
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
              modelVia: data.modelLabel ?? undefined,
              state: data.proposal ? "pending" : undefined,
            },
          ]);
        }
      } catch (e) {
        if (ac.signal.aborted || (e as Error).name === "AbortError") {
          setMessages((prev) => [...prev, { key: `s${Date.now()}`, role: "system", content: "⏹ Stopped — the partial answer was discarded." }]);
        } else {
          setError("Network error — is the server up?");
        }
      } finally {
        stopRef.current = null;
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
          body: JSON.stringify({
            action: proposal.action,
            ...splitModelKey(selectedModelKey),
            ...(conversationId ? { conversation_id: conversationId } : {}),
          }),
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

  // Every (provider, model) pair the member can switch to: the saved catalog
  // when one was fetched, otherwise the provider's default model.
  const modelPairs: ModelPair[] = providers
    .flatMap((p) => {
      const offered = p.models?.length ? p.models : [p.model];
      const favorites = new Set(p.favorite_models ?? []);
      // Favorites first (saved order), then the rest of the catalog.
      const ordered = [...offered].sort((a, b) => Number(favorites.has(b)) - Number(favorites.has(a)));
      return ordered.map((m) => ({
        key: `${p.id}|${m}`,
        providerId: p.id,
        model: m,
        label: p.label,
        is_default: p.is_default,
        isFavorite: favorites.has(m),
      }));
    })
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));

  const currentPair = modelPairs.find((o) => o.key === selectedModelKey) ?? null;

  /** Picks a model, notes the switch in the thread, and returns to the chat. */
  function switchPair(key: string) {
    const pair = modelPairs.find((o) => o.key === key);
    setSelectedModelKey(key);
    if (pair) {
      setMessages((prev) => [
        ...prev,
        {
          key: `sw${Date.now()}`,
          role: "system",
          content: `⇄ Model switched → ${pair.isFavorite ? "⭐ " : ""}${pair.label} · ${pair.model}`,
        },
      ]);
    }
    setViewSafe("chat");
  }

  /** Stars/unstars a (provider, model) pair straight from the chat dropdown. */
  function toggleFavoritePair(pair: ModelPair) {
    const nextFav = !pair.isFavorite;
    setFavBusy(pair.key);
    setProviders((prev) =>
      prev.map((p) =>
        p.id === pair.providerId
          ? {
              ...p,
              favorite_models: nextFav
                ? [...(p.favorite_models ?? []), pair.model]
                : (p.favorite_models ?? []).filter((m) => m !== pair.model),
            }
          : p,
      ),
    );
    fetch("/api/ai/chat/favorite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider_id: pair.providerId, model: pair.model, favorite: nextFav }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("failed");
      })
      .catch(() => {
        // Revert the optimistic flip.
        setProviders((prev) =>
          prev.map((p) =>
            p.id === pair.providerId
              ? {
                  ...p,
                  favorite_models: nextFav
                    ? (p.favorite_models ?? []).filter((m) => m !== pair.model)
                    : [...(p.favorite_models ?? []), pair.model],
                }
              : p,
          ),
        );
        setError("Could not save the favorite — try again.");
      })
      .finally(() => setFavBusy(null));
  }

  // The model only ever sees aliases ("Member-A"); the real names come back
  // from the server's memberMap for display in this browser alone.
  const deAlias = (text: string) => text.replace(/\bMember-[A-Z0-9]+\b/g, (m) => memberMap[m] ?? m);

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
        className="flex w-full flex-col border-l-2 border-neutral-900 bg-white max-md:fixed max-md:bottom-16 max-md:right-0 max-md:top-0 max-md:z-40 max-md:shadow-[-6px_6px_0_#111] md:relative md:h-full md:w-[340px] md:shrink-0 md:shadow-[-6px_0_0_#111] xl:w-[400px]"
      >
        {/* Header */}
        <div className="relative flex items-center justify-between border-b-2 border-neutral-900 bg-yellow-300 px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-neutral-900">
              <AiSpark size={16} /> Rasoi AI
            </p>
            {modelPairs.length >= 1 ? (
              <button
                type="button"
                onClick={() => setViewSafe("models")}
                aria-haspopup="dialog"
                aria-label="Model for this conversation"
                title="Choose a model — your app-wide default in Settings is untouched"
                className="mt-1 flex w-full max-w-[210px] items-center justify-between gap-1 rounded-none border-2 border-neutral-900 bg-white px-1.5 py-1 text-left text-[10px] font-bold text-neutral-900 shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
              >
                <span className="truncate">
                  {currentPair?.isFavorite ? "⭐ " : currentPair?.is_default ? "★ " : ""}
                  {currentPair ? currentPair.model : "Model"}
                </span>
                <span className="text-neutral-400" aria-hidden>
                  ▾
                </span>
              </button>
            ) : (
              <p className="text-[10px] text-neutral-700">
                {provider ? `via ${provider.label} · ${provider.model}` : "your kitchen copilot"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setConversationId(null);
                setMessages([]);
                setHistoryOpenSafe(false);
                setViewSafe("chat");
                setError(null);
              }}
              title="Start a fresh conversation"
              className="rounded-none border-2 border-neutral-900 bg-white px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              + New
            </button>
            <button
              type="button"
              onClick={() => setHistoryOpenSafe(!historyOpenRef.current)}
              aria-expanded={historyOpen}
              disabled={historyLoading}
              title="Previous chats"
              className="rounded-none border-2 border-neutral-900 bg-white px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
            >
              {historyLoading ? "◌…" : "☰ Chats"}
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
          {historyOpen && (
            <div className="absolute inset-x-3 top-full z-10 mt-1 border-2 border-neutral-900 bg-white shadow-[4px_4px_0_#111]">
              <p className="border-b border-neutral-200 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">
                Previous chats
              </p>
              {conversations.length === 0 ? (
                <p className="px-3 py-2 text-xs text-neutral-500">No previous chats yet.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto">
                  {conversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setHistoryOpenSafe(false);
                        setConversationId(c.id);
                        fetchThread(c.id);
                      }}
                      className={`block w-full truncate px-3 py-2 text-left text-xs font-semibold transition-colors ${
                        c.id === conversationId ? "bg-yellow-300 text-neutral-900" : "text-neutral-700 hover:bg-amber-50"
                      }`}
                    >
                      {c.title}
                      <span className="ml-1 text-[9px] font-normal text-neutral-400">
                        {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {view === "models" ? (
          <ModelsView
            pairs={modelPairs}
            selectedKey={selectedModelKey}
            onSelect={switchPair}
            onToggleStar={toggleFavoritePair}
            favBusy={favBusy}
            onBack={() => setViewSafe("chat")}
            onClose={onClose}
          />
        ) : (
        <>
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
              {Object.keys(memberMap).length > 0 && (
                <div className="border-2 border-neutral-900 bg-white p-2.5 text-[10px] text-neutral-600 shadow-[2px_2px_0_#111]">
                  <p className="font-extrabold uppercase tracking-wide text-neutral-500">Who&apos;s who in chats</p>
                  <p className="mt-0.5">
                    For privacy your real names are never sent to the AI — family members appear as aliases.{" "}
                    {Object.entries(memberMap).map(([alias, name], i) => (
                      <span key={alias}>
                        {i > 0 && ", "}
                        <strong className="text-neutral-900">{alias}</strong> = {name}
                      </span>
                    ))}
                    .
                  </p>
                </div>
              )}
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
                          ✓ {deAlias(t)}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.content && (
                    <div className="nb-stamp border-2 border-neutral-900 bg-white px-3 py-2 text-xs leading-relaxed text-neutral-900 shadow-[2px_2px_0_#111]">
                      {deAlias(m.content)}
                    </div>
                  )}
                  {m.modelVia && (
                    <p className="pl-1 text-[9px] font-medium text-neutral-400">via {m.modelVia}</p>
                  )}
                  {m.proposal && (
                    <div className="border-2 border-neutral-900 bg-amber-100 p-3 shadow-[3px_3px_0_#111]">
                      <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">Confirm to run</p>
                      <p className="mt-1 text-xs font-bold text-neutral-900">{deAlias(m.proposal.summary)}</p>
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
            <div className="space-y-2">
              <AiWorking compact label="Thinking through your kitchen…" hint="Reading your plan, pantry and progress as needed." />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => stopRef.current?.abort()}
                  className="rounded-none border-2 border-neutral-900 bg-red-200 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-neutral-900 shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                >
                  ■ Stop
                </button>
              </div>
            </div>
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
        </>
        )}
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
    model?: string;
  } | null;
  created_at: string;
}

/**
 * Full-panel model picker: search, favorites pinned in their own group, the
 * rest grouped by provider. Replaces the cramped header popover.
 */
function ModelsView({
  pairs,
  selectedKey,
  onSelect,
  onToggleStar,
  favBusy,
  onBack,
  onClose,
}: {
  pairs: ModelPair[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onToggleStar: (pair: ModelPair) => void;
  favBusy: string | null;
  onBack: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = pairs.filter(
    (o) => !q || o.model.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
  );
  const favorites = filtered.filter((o) => o.isFavorite);
  const groups: { label: string; isDefault: boolean; items: ModelPair[] }[] = [];
  for (const o of filtered.filter((x) => !x.isFavorite)) {
    const last = groups[groups.length - 1];
    if (last && last.label === o.label) last.items.push(o);
    else groups.push({ label: o.label, isDefault: o.is_default, items: [o] });
  }

  const row = (o: ModelPair) => (
    <div key={o.key} className={`flex items-stretch ${o.key === selectedKey ? "bg-yellow-300" : ""}`}>
      <button
        type="button"
        onClick={() => onSelect(o.key)}
        className="min-w-0 flex-1 px-3 py-2 text-left transition-colors hover:bg-amber-50"
      >
        <span className="block truncate text-xs font-bold text-neutral-900">
          {o.isFavorite ? "⭐ " : ""}
          {o.model}
        </span>
        <span className="block truncate text-[9px] text-neutral-400">
          {o.label}
          {o.is_default ? " · default provider" : ""}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onToggleStar(o)}
        disabled={favBusy === o.key}
        aria-label={o.isFavorite ? `Unstar ${o.model}` : `Star ${o.model} — pins to top`}
        title={o.isFavorite ? "Unstar" : "Star — pins to top"}
        className={`w-10 text-center text-base transition-colors hover:bg-amber-100 disabled:opacity-40 ${
          o.isFavorite ? "text-amber-500" : "text-neutral-300"
        }`}
      >
        {favBusy === o.key ? "◌" : o.isFavorite ? "⭐" : "☆"}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#FFFBEF]">
      <div className="flex items-center gap-2 border-b-2 border-neutral-900 bg-white px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-none border-2 border-neutral-900 bg-white px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          ← Back
        </button>
        <p className="text-xs font-extrabold uppercase tracking-wide text-neutral-900">Choose a model</p>
      </div>
      <div className="border-b-2 border-neutral-900 bg-white p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models…"
          aria-label="Search models"
          className="w-full rounded-none border-2 border-neutral-900 bg-white px-2.5 py-1.5 text-xs focus:shadow-[3px_3px_0_#111] focus:outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {pairs.length === 0 && (
          <p className="p-4 text-xs text-neutral-500">
            No models yet — add a provider in Settings and ⚡ Fetch its catalog.
          </p>
        )}
        {favorites.length > 0 && (
          <>
            <p className="border-y border-neutral-200 bg-neutral-50 px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">
              ⭐ Favorites
            </p>
            {favorites.map(row)}
          </>
        )}
        {groups.map((g) => (
          <div key={g.label}>
            <p className="border-y border-neutral-200 bg-neutral-50 px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">
              {g.label}
              {g.isDefault ? " · ★ default" : ""}
            </p>
            {g.items.map(row)}
          </div>
        ))}
        {pairs.length > 0 && favorites.length === 0 && groups.length === 0 && (
          <p className="p-4 text-xs text-neutral-500">No models match “{query}”.</p>
        )}
      </div>
      <Link
        href="/settings"
        onClick={onClose}
        className="border-t-2 border-neutral-900 bg-white px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 hover:bg-amber-50"
      >
        ⚙ Manage providers &amp; catalogs
      </Link>
    </div>
  );
}
