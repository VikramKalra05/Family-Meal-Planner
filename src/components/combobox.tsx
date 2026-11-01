"use client";

import { useEffect, useRef, useState } from "react";

export interface ComboboxOption {
  id: string;
  label: string;
  /** Secondary line, e.g. "dairy · 65 kcal/100g" */
  hint?: string;
}

/**
 * Searchable dropdown with keyboard navigation. When `onCreate` is given and
 * the query matches nothing exactly, a "Create" row appears at the bottom of
 * the list — used by the recipe form to add ingredients that aren't in the
 * master library yet.
 */
export function Combobox({
  options,
  value,
  onSelect,
  onCreate,
  onEstimate,
  createMacros = true,
  placeholder = "Search…",
  createLabel = "Add",
  emptyText = "No matches",
}: {
  options: ComboboxOption[];
  value: string | null;
  onSelect: (id: string) => void;
  onCreate?: (name: string, macros?: { kcal: number; protein: number; carbs: number; fat: number }) => Promise<void> | void;
  onEstimate?: (name: string) => Promise<{ kcal: number; protein: number; carbs: number; fat: number } | { error: string }>;
  /** When false, "Add <query>" fires onCreate directly — no nutrition form (pantry-style). */
  createMacros?: boolean;
  placeholder?: string;
  createLabel?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newMacros, setNewMacros] = useState({ kcal: "", protein: "", carbs: "", fat: "" });
  const [estimating, setEstimating] = useState(false);
  const [estimateNote, setEstimateNote] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  const matches = options.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const canCreate =
    !!onCreate &&
    query.trim().length >= 2 &&
    !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());
  const rowCount = matches.length + (canCreate ? 1 : 0);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function openDropdown() {
    setOpen(true);
    setQuery("");
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function choose(idx: number) {
    if (idx < matches.length) {
      onSelect(matches[idx].id);
      setOpen(false);
      setCreating(false);
      setQuery("");
    } else if (canCreate) {
      if (createMacros) {
        setCreating(true);
      } else if (onCreate) {
        // Pantry-style: no nutrition facts needed — create immediately.
        onCreate(query.trim());
        setOpen(false);
        setQuery("");
      }
    }
  }

  async function submitCreate() {
    if (!onCreate) return;
    await onCreate(query.trim(), {
      kcal: Number(newMacros.kcal) || 0,
      protein: Number(newMacros.protein) || 0,
      carbs: Number(newMacros.carbs) || 0,
      fat: Number(newMacros.fat) || 0,
    });
    setOpen(false);
    setCreating(false);
    setQuery("");
    setNewMacros({ kcal: "", protein: "", carbs: "", fat: "" });
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className={`flex w-full items-center justify-between gap-2 rounded-none border px-3 py-2.5 text-left text-sm transition ${
          open
            ? "shadow-[3px_3px_0_#111]"
            : "border-neutral-300 hover:border-neutral-400"
        } bg-white`}
      >
        <span className={selected ? "truncate font-medium" : "truncate text-neutral-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-none border-2 border-neutral-900 bg-white shadow-[4px_4px_0_#111]">
          {creating ? (
            <div className="p-3">
              <p className="mb-2 text-xs font-medium text-neutral-600">
                New ingredient: <span className="text-emerald-700">{query.trim()}</span> — nutrition per 100 g:
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    ["Kcal", "kcal"],
                    ["Protein g", "protein"],
                    ["Carbs g", "carbs"],
                    ["Fat g", "fat"],
                  ] as [string, keyof typeof newMacros][]
                ).map(([lbl, key]) => (
                  <label key={key} className="text-[10px] font-medium text-neutral-500">
                    {lbl}
                    <input
                      autoFocus={key === "kcal"}
                      type="number" min="0" step="0.1"
                      value={newMacros[key]}
                      onChange={(e) => setNewMacros((m) => ({ ...m, [key]: e.target.value }))}
                      className="mt-0.5 w-full rounded-none border-2 border-neutral-900 px-2 py-1.5 text-sm focus:shadow-[3px_3px_0_#111] focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitCreate();
                        }
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-2.5 flex gap-2">
                {onEstimate && (
                  <button
                    type="button"
                    disabled={estimating}
                    onClick={async () => {
                      setEstimating(true);
                      setEstimateNote(null);
                      const res = await onEstimate(query.trim());
                      setEstimating(false);
                      if ("error" in res) {
                        setEstimateNote(res.error);
                      } else {
                        setNewMacros({
                          kcal: String(res.kcal),
                          protein: String(res.protein),
                          carbs: String(res.carbs),
                          fat: String(res.fat),
                        });
                        setEstimateNote("✓ Estimated — review and adjust");
                      }
                    }}
                    className="rounded-none border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] disabled:opacity-50"
                  >
                    {estimating ? "◌ Estimating…" : "✨ Estimate with AI"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={submitCreate}
                  className="flex-1 rounded-none bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide"
                >
                  Create ingredient
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-none border-2 border-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-amber-50"
                >
                  Cancel
                </button>
              </div>
              {estimateNote && (
                <p className={`mt-2 text-[10px] font-extrabold uppercase tracking-wide ${estimateNote.startsWith("✓") ? "nb-stamp text-emerald-700" : "nb-shake text-red-600"}`}>
                  {estimateNote}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="border-b-2 border-neutral-900 p-2">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, rowCount - 1)); }
                    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                    if (e.key === "Enter") { e.preventDefault(); choose(active); }
                    if (e.key === "Escape") { setOpen(false); setCreating(false); }
                  }}
                  placeholder="Type to search…"
                  className="w-full rounded-none bg-amber-50 px-3 py-2 text-sm focus:shadow-[3px_3px_0_#111] focus:outline-none"
                />
              </div>
              <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
                {matches.map((o, idx) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={o.id === value}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => choose(idx)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                        idx === active ? "bg-emerald-50 text-emerald-800" : "hover:bg-amber-50"
                      }`}
                    >
                      <span className="truncate font-medium">{o.label}</span>
                      {o.hint && <span className="ml-2 shrink-0 text-[10px] text-neutral-400">{o.hint}</span>}
                    </button>
                  </li>
                ))}
                {canCreate && (
                  <li>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(matches.length)}
                      onClick={() => choose(matches.length)}
                      className={`w-full px-3 py-2 text-left text-sm ${
                        active === matches.length ? "bg-emerald-50" : ""
                      }`}
                    >
                      <span className="font-medium text-emerald-700">＋ {createLabel} “{query.trim()}”</span>
                      <span className="block text-[10px] text-neutral-400">
                        {createMacros
                          ? "Not in the library? Add it with its nutrition facts."
                          : "Not in the list? Use it as a custom item."}
                      </span>
                    </button>
                  </li>
                )}
                {matches.length === 0 && !canCreate && (
                  <li className="px-3 py-3 text-center text-xs text-neutral-400">{emptyText}</li>
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
