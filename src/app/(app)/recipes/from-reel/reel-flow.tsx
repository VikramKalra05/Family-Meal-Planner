"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { draftRecipeFromUrl, importDraftRecipe, type DraftResult } from "./actions";
import type { DraftRecipe } from "@/lib/ai/recipes";

const input =
  "w-full rounded-none border-2 border-neutral-900 bg-white px-3.5 py-2.5 text-sm transition focus:shadow-[3px_3px_0_#111] focus:outline-none";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500";

export function ReelFlow({ initialUrl = "" }: { initialUrl?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [caption, setCaption] = useState("");
  const [showCaption, setShowCaption] = useState(false);
  const [draft, setDraft] = useState<DraftRecipe | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsCaption, setNeedsCaption] = useState(false);
  const [drafting, startDrafting] = useTransition();
  const [saving, startSaving] = useTransition();

  function runDraft() {
    setError(null);
    setNeedsCaption(false);
    startDrafting(async () => {
      const res: DraftResult = await draftRecipeFromUrl({ url, caption });
      if (res.ok) {
        setDraft(res.draft);
        setSourceUrl(url);
      } else {
        setError(res.error);
        if (res.needsCaption) {
          setNeedsCaption(true);
          setShowCaption(true);
        }
      }
    });
  }

  function saveDraft() {
    if (!draft) return;
    setError(null);
    startSaving(async () => {
      const res = await importDraftRecipe({ ...draft, source_url: sourceUrl || null });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push(`/recipes/${res.id}`);
    });
  }

  if (!draft) {
    return (
      <div className="space-y-4 rounded-none bg-white p-6 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
        <div>
          <label className={label} htmlFor="url">Recipe link</label>
          <input
            id="url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/reel/… or https://youtube.com/shorts/…"
            className={`${input} font-mono text-xs`}
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            Android tip: once installed as a PWA (M6), share the reel straight from Instagram into this app.
          </p>
        </div>

        {(showCaption || caption) && (
          <div>
            <label className={label} htmlFor="caption">Caption / recipe text (fallback when the link is private)</label>
            <textarea
              id="caption" rows={6} value={caption} onChange={(e) => setCaption(e.target.value)}
              placeholder="Paste the reel caption or the ingredients + steps here…"
              className={`${input} text-xs`}
            />
          </div>
        )}

        {!showCaption && (
          <button type="button" onClick={() => setShowCaption(true)} className="text-xs font-medium text-emerald-700 hover:text-emerald-800">
            Link blocked? Paste the caption instead →
          </button>
        )}

        {needsCaption && (
          <div className="border-2 border-neutral-900 bg-amber-100 px-4 py-3 text-xs font-medium text-neutral-900 shadow-[2px_2px_0_#111]">
            No usable recipe text came back from the link. Paste the reel&apos;s caption (or just the
            ingredients + steps) into the box below, then draft again — the AI builds from that instead.
          </div>
        )}

        {error && <p className="rounded-none bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

        <button
          type="button" onClick={runDraft} disabled={drafting || !url.trim()}
          className="w-full rounded-none bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide disabled:opacity-50"
        >
          {drafting ? (needsCaption ? "Drafting from your text…" : "Reading the recipe…") : "✨ Draft recipe with AI"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-none border-2 border-neutral-900 bg-lime-200 p-4 text-xs font-medium text-neutral-900 shadow-[3px_3px_0_#111]">
        Review the AI&apos;s draft — edit anything that looks wrong, then save. Unknown ingredients get their
        nutrition estimated automatically (marked on the recipe).
      </div>

      <div className="space-y-4 rounded-none bg-white p-6 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className={label}>Title</label>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={input} />
          </div>
          <div>
            <label className={label}>Servings</label>
            <input
              type="number" min="1" max="12" value={draft.servings}
              onChange={(e) => setDraft({ ...draft, servings: Number(e.target.value) || 1 })}
              className={input}
            />
          </div>
        </div>
        <div>
          <label className={label}>Description</label>
          <input value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={input} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft({ ...draft, is_veg: !draft.is_veg })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              draft.is_veg ? "bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide" : "bg-red-600 text-white"
            }`}
          >
            {draft.is_veg ? "VEG" : "NON-VEG"} — tap to flip
          </button>
          {draft.cuisine && <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs text-neutral-600">{draft.cuisine}</span>}
        </div>
      </div>

      <div className="rounded-none bg-white p-6 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Ingredients ({draft.ingredients.length})</h2>
        <div className="space-y-2">
          {draft.ingredients.map((ing, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_100px_1fr_36px] items-center gap-2">
              <input
                value={ing.name}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    ingredients: draft.ingredients.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                  })
                }
                className={input}
              />
              <input
                type="number" min="0.1" value={ing.grams}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    ingredients: draft.ingredients.map((x, i) => (i === idx ? { ...x, grams: Number(e.target.value) } : x)),
                  })
                }
                className={input}
              />
              <input
                value={ing.note ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    ingredients: draft.ingredients.map((x, i) => (i === idx ? { ...x, note: e.target.value || null } : x)),
                  })
                }
                placeholder="note"
                className={input}
              />
              <button
                type="button"
                onClick={() => setDraft({ ...draft, ingredients: draft.ingredients.filter((_, i) => i !== idx) })}
                className="rounded-none px-2 py-2 text-neutral-300 hover:bg-red-50 hover:text-red-500"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...draft, ingredients: [...draft.ingredients, { name: "", grams: 50, note: null }] })}
          className="mt-3 rounded-none border-2 border-neutral-900 bg-white px-3.5 py-2 text-xs font-semibold font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111]"
        >
          + Add ingredient
        </button>
      </div>

      <div className="rounded-none bg-white p-6 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
        <label className={label}>Steps (one per line)</label>
        <textarea
          rows={draft.steps.length + 2}
          value={draft.steps.join("\n")}
          onChange={(e) => setDraft({ ...draft, steps: e.target.value.split("\n").filter((s) => s.trim()) })}
          className={`${input} font-mono text-xs`}
        />
      </div>

      {error && <p className="rounded-none bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button" onClick={saveDraft} disabled={saving}
          className="flex-1 rounded-none bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide disabled:opacity-50"
        >
          {saving ? "Saving — matching ingredients…" : "Save as recipe"}
        </button>
        <button
          type="button" onClick={() => { setDraft(null); setError(null); }}
          className="rounded-none border-2 border-neutral-900 px-4 py-3 text-sm font-medium text-neutral-600 hover:bg-amber-50"
        >
          Discard draft
        </button>
      </div>
    </div>
  );
}
