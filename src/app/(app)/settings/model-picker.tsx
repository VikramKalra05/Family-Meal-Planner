"use client";

import { useState, useTransition } from "react";

/**
 * Fetches the endpoint's /models catalog and lets the member tick the model
 * ids they want offered in the chat model-changer. Purely optional: the
 * primary "Model" field stays the default and manual typing always works
 * (some endpoints don't expose /models).
 */
export function ModelPicker({
  getCredentials,
  initialModels,
  onModelsChange,
}: {
  /** Reads the current form values (base URL, typed key, stored provider row). */
  getCredentials: () => { base_url: string; api_key: string; provider_id?: string };
  initialModels: string[];
  onModelsChange: (models: string[]) => void;
}) {
  const [fetched, setFetched] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialModels));
  const [error, setError] = useState<string | null>(null);
  const [loading, startFetch] = useTransition();

  function runFetch() {
    const creds = getCredentials();
    if (!creds.base_url.trim()) {
      setError("Fill the base URL first, then fetch.");
      return;
    }
    setError(null);
    startFetch(async () => {
      try {
        const res = await fetch("/api/ai/models", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(creds),
        });
        const data = (await res.json()) as { models?: string[]; error?: string };
        if (!res.ok || data.error) {
          setError(data.error ?? "Could not fetch models.");
          return;
        }
        const list = data.models ?? [];
        setFetched(list);
        // Keep only the stored picks that actually exist in this endpoint's catalog.
        setSelected((cur) => {
          const next = new Set<string>();
          for (const m of list) if (cur.has(m)) next.add(m);
          return next;
        });
      } catch {
        setError("Network error while fetching models.");
      }
    });
  }

  function toggle(m: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      onModelsChange([...next]);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Model catalog (optional)
        </span>
        <button
          type="button"
          onClick={runFetch}
          disabled={loading}
          className="rounded-none border-2 border-neutral-900 bg-white px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
        >
          {loading ? "◌ Fetching…" : "⚡ Fetch models"}
        </button>
      </div>
      {error && <p className="nb-shake text-[11px] font-medium text-red-700">{error}</p>}
      {fetched && (
        <>
          <p className="mb-1 text-[10px] text-neutral-400">
            {fetched.length} model{fetched.length === 1 ? "" : "s"} on this endpoint — tick the ones to offer in the chat
            model-changer. The Model field above stays the default.
          </p>
          <div className="max-h-44 space-y-0.5 overflow-y-auto border-2 border-neutral-900 bg-white p-1.5">
            {fetched.map((m) => (
              <label
                key={m}
                className="flex cursor-pointer items-center gap-2 px-1 py-0.5 text-xs font-medium text-neutral-700 hover:bg-amber-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(m)}
                  onChange={() => toggle(m)}
                  className="h-3.5 w-3.5 accent-emerald-600"
                />
                <span className="truncate font-mono">{m}</span>
              </label>
            ))}
          </div>
        </>
      )}
      {!fetched && !error && (
        <p className="text-[10px] text-neutral-400">
          Pulls the endpoint&apos;s /models list so you can pick model ids instead of typing them.
        </p>
      )}
    </div>
  );
}
