"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import { computeRecipeNutrition } from "@/lib/nutrition/recipe";
import { healthTags } from "@/lib/nutrition/health";
import type {
  IngredientItemRow,
  IngredientOption,
  MediaRow,
  RecipeFormValues,
} from "./types";
import type { RecipeActionState } from "./actions";

const input =
  "w-full rounded-none border-2 border-neutral-900 bg-white px-3.5 py-2.5 text-sm transition focus:shadow-[3px_3px_0_#111] focus:outline-none";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500";

function Section({
  step,
  title,
  subtitle,
  children,
  aside,
}: {
  step: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-none bg-white border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
      <header className="flex items-start justify-between gap-3 border-b-2 border-neutral-900 bg-yellow-300 px-6 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide">
            {step}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
            <p className="text-xs text-neutral-500">{subtitle}</p>
          </div>
        </div>
        {aside}
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function RecipeForm({
  action,
  ingredients,
  onCreateIngredient,
  onEstimateIngredient,
  initial,
  recipeId,
}: {
  action: (prev: RecipeActionState, formData: FormData) => Promise<RecipeActionState>;
  ingredients: IngredientOption[];
  onCreateIngredient: (
    name: string,
    macros: { kcal: number; protein: number; carbs: number; fat: number },
  ) => Promise<IngredientOption | null>;
  onEstimateIngredient?: (
    name: string,
  ) => Promise<{ kcal: number; protein: number; carbs: number; fat: number } | { error: string }>;
  initial?: RecipeFormValues;
  recipeId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [items, setItems] = useState<IngredientItemRow[]>(
    initial?.items ?? [{ id: "", grams: 100, unit: "g", note: null }],
  );
  const [media, setMedia] = useState<MediaRow[]>(initial?.media ?? []);
  const [options, setOptions] = useState<IngredientOption[]>(ingredients);
  const [servings, setServings] = useState(initial?.servings ?? 2);
  const [isVeg, setIsVeg] = useState(initial?.is_veg ?? true);

  const byId = useMemo(
    () => new Map(options.map((o) => [o.id, o])),
    [options],
  );

  const updateItem = (idx: number, patch: Partial<IngredientItemRow>) =>
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  // Live nutrition preview — same deterministic module the server uses.
  const preview = useMemo(() => {
    const rows = items
      .filter((i) => i.id && i.grams > 0 && byId.has(i.id))
      .map((i) => {
        const ing = byId.get(i.id)!;
        return { ingredient: ing, grams: i.grams };
      });
    if (rows.length === 0) return null;
    const n = computeRecipeNutrition(rows, servings);
    return { n, tags: healthTags({ kcal: n.kcal, proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG, fiberG: n.fiberG }) };
  }, [items, byId, servings]);

  async function handleCreateIngredient(
    name: string,
    macros: { kcal: number; protein: number; carbs: number; fat: number },
  ) {
    const created = await onCreateIngredient(name, macros);
    if (!created) return;
    setOptions((opts) => (opts.some((o) => o.id === created.id) ? opts : [created, ...opts]));
    setItems((rows) =>
      rows.map((r, idx) =>
        idx === pendingCreateRow ? { ...r, id: created.id, unit: created.unit } : r,
      ),
    );
    setPendingCreateRow(null);
  }

  const [pendingCreateRow, setPendingCreateRow] = useState<number | null>(null);

  const prepare = (formData: FormData): FormData => {
    const steps = String(formData.get("steps") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    formData.set(
      "payload",
      JSON.stringify({
        title: formData.get("title"),
        description: formData.get("description") || null,
        cuisine: formData.get("cuisine") || null,
        servings: formData.get("servings"),
        prep_minutes: formData.get("prep_minutes") || null,
        is_veg: formData.get("is_veg") === "on",
        image_url: formData.get("image_url") || null,
        notes: formData.get("notes") || null,
        steps,
        items: items.filter((i) => i.id && i.grams > 0),
        media: media.filter((m) => m.url.trim()),
      }),
    );
    return formData;
  };

  const comboOptions: ComboboxOption[] = options.map((o) => ({
    id: o.id,
    label: o.name,
    hint: `${o.kcalPer100g} kcal/100${o.unit}`,
  }));

  return (
    <form action={(fd) => formAction(prepare(fd))} className="space-y-5 pb-24">
      {recipeId && <input type="hidden" name="recipe_id" value={recipeId} />}

      <Section step="1" title="The basics" subtitle="Name it, size it, set the mood">
        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="title">Recipe title</label>
            <input id="title" name="title" required defaultValue={initial?.title} className={input} placeholder="e.g. Methi Thepla" />
          </div>
          <div>
            <label className={label} htmlFor="description">One-line description</label>
            <input id="description" name="description" defaultValue={initial?.description ?? ""} className={input} placeholder="Gujarati fenugreek flatbreads with curd" />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className={label} htmlFor="servings">Servings</label>
              <input
                id="servings" name="servings" type="number" min="1" max="20" required
                value={servings}
                onChange={(e) => setServings(Number(e.target.value) || 1)}
                className={input}
              />
            </div>
            <div>
              <label className={label} htmlFor="prep_minutes">Prep time (min)</label>
              <input id="prep_minutes" name="prep_minutes" type="number" min="0" max="600" defaultValue={initial?.prep_minutes ?? ""} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="cuisine">Cuisine</label>
              <select id="cuisine" name="cuisine" defaultValue={initial?.cuisine ?? "north-indian"} className={input}>
                {["north-indian", "south-indian", "punjabi", "gujarati", "maharashtrian", "hyderabadi", "bengali", "street-food", "all-india", "continental"].map((c) => (
                  <option key={c} value={c}>{c.replace("-", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <span className={label}>Diet</span>
              <input type="hidden" name="is_veg" value={isVeg ? "on" : "off"} />
              <div className="flex rounded-none border-2 border-neutral-900 bg-amber-50 p-1">
                {[
                  { on: true, label: "Veg", active: "bg-white text-neutral-900" },
                  { on: false, label: "Non-veg", active: "bg-white text-neutral-900" },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setIsVeg(opt.on)}
                    className={`flex-1 rounded-none px-2 py-1.5 text-xs font-medium transition ${
                      isVeg === opt.on ? "bg-white text-neutral-900" : "text-neutral-500"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className={label} htmlFor="image_url">Photo URL — becomes the card image</label>
            <input
              id="image_url" name="image_url" type="url"
              defaultValue={initial?.image_url ?? ""}
              className={input}
              placeholder="https://…/dish.jpg"
            />
          </div>
        </div>
      </Section>

      <Section
        step="2"
        title="Ingredients"
        subtitle="Search the library, or add your own with its nutrition facts"
        aside={
          <button
            type="button"
            onClick={() => setItems((rows) => [...rows, { id: "", grams: 50, unit: "g", note: null }])}
            className="rounded-none bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide"
          >
            + Add row
          </button>
        }
      >
        <div className="mb-2 grid grid-cols-[1fr_110px_64px_1fr_36px] gap-2 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
          <span>Ingredient</span>
          <span>Amount</span>
          <span>Unit</span>
          <span>Note</span>
          <span />
        </div>
        <div className="space-y-2.5">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_110px_64px_1fr_36px] items-center gap-2">
              <Combobox
                options={comboOptions}
                value={item.id || null}
                onSelect={(id) => {
                  const ing = byId.get(id);
                  updateItem(idx, { id, unit: ing ? ing.unit : item.unit });
                }}
                onCreate={async (name, macros) => {
                  if (!macros) return;
                  setPendingCreateRow(idx);
                  await handleCreateIngredient(name, macros);
                }}
                onEstimate={onEstimateIngredient}
                placeholder="Search 119 ingredients…"
                createLabel="Create"
              />
              <input
                type="number" min="0.1" max="5000" step="0.1"
                value={item.grams}
                onChange={(e) => updateItem(idx, { grams: Number(e.target.value) })}
                className={input}
                aria-label="Amount"
              />
              <div className="flex rounded-none border-2 border-neutral-900 bg-amber-50 p-0.5">
                {(["g", "ml"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => updateItem(idx, { unit: u })}
                    className={`flex-1 rounded-none py-1.5 text-xs font-medium transition ${
                      item.unit === u ? "bg-white text-neutral-900" : "text-neutral-400"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <input
                value={item.note ?? ""}
                onChange={(e) => updateItem(idx, { note: e.target.value || null })}
                placeholder="e.g. frying oil, absorbed"
                className={input}
              />
              <button
                type="button"
                onClick={() => setItems((rows) => rows.filter((_, i) => i !== idx))}
                className="rounded-none px-2 py-2 text-neutral-300 transition hover:bg-red-50 hover:text-red-500"
                aria-label="Remove ingredient"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {preview && (
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-2 border-neutral-900 bg-yellow-300 p-5 text-neutral-900 shadow-[4px_4px_0_#111]">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-700">Per serving</p>
              <p className="text-3xl font-bold leading-tight">{Math.round(preview.n.kcal)}<span className="text-base font-medium text-neutral-600"> kcal</span></p>
              <p className="text-[10px] font-semibold text-neutral-600">
                ÷ {servings} servings · {Math.round(preview.n.totalGrams)}g total
              </p>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Protein", `${preview.n.proteinG}g`],
                ["Carbs", `${preview.n.carbsG}g`],
                ["Fat", `${preview.n.fatG}g`],
                ["Fiber", `${preview.n.fiberG}g`],
              ].map(([l, v]) => (
                <div key={l} className="rounded-none border-2 border-neutral-900 bg-white px-3 py-2 shadow-[2px_2px_0_#111]">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{l}</p>
                  <p className="text-sm font-bold">{v}</p>
                </div>
              ))}
            </div>
            {preview.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {preview.tags.map((t) => (
                  <span key={t.label} className="rounded-full border-2 border-neutral-900 bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide">
                    {t.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section step="3" title="Method" subtitle="One step per line — they'll be numbered automatically">
        <textarea
          id="steps" name="steps" rows={7} required
          defaultValue={initial?.steps.join("\n")}
          className={`${input} font-mono text-xs leading-relaxed`}
          placeholder={"Marinate chicken in spiced curd for 2 hours…\nGrill at 220°C for 25 minutes…\nRest, slice and serve with lemon."}
        />
      </Section>

      <Section
        step="4"
        title="Photos, videos & family notes"
        subtitle="Tag YouTube/Instagram links to watch later — YouTube links auto-preview"
        aside={
          <button
            type="button"
            onClick={() => setMedia((rows) => [...rows, { kind: "video", url: "", label: null }])}
            className="rounded-none border-2 border-neutral-900 bg-white px-3.5 py-2 text-xs font-semibold font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111]"
          >
            + Tag media
          </button>
        }
      >
        {media.length === 0 ? (
          <p className="rounded-none border-2 border-dashed border-neutral-900 px-4 py-6 text-center text-xs text-neutral-400">
            Nothing tagged yet — recipe cards look great with the gradient placeholder too.
          </p>
        ) : (
          <div className="space-y-2.5">
            {media.map((m, idx) => (
              <div key={idx} className="grid grid-cols-[100px_1fr_1fr_36px] items-center gap-2">
                <select
                  value={m.kind}
                  onChange={(e) =>
                    setMedia((rows) => rows.map((r, i) => (i === idx ? { ...r, kind: e.target.value as MediaRow["kind"] } : r)))
                  }
                  className={input}
                  aria-label="Media kind"
                >
                  <option value="video">▶ Video</option>
                  <option value="image">🖼 Photo</option>
                </select>
                <input
                  type="url"
                  value={m.url}
                  onChange={(e) => setMedia((rows) => rows.map((r, i) => (i === idx ? { ...r, url: e.target.value } : r)))}
                  placeholder="https://youtu.be/… or https://instagram.com/reel/…"
                  className={input}
                />
                <input
                  value={m.label ?? ""}
                  onChange={(e) => setMedia((rows) => rows.map((r, i) => (i === idx ? { ...r, label: e.target.value || null } : r)))}
                  placeholder="label — e.g. Chef's original reel"
                  className={input}
                />
                <button
                  type="button"
                  onClick={() => setMedia((rows) => rows.filter((_, i) => i !== idx))}
                  className="rounded-none px-2 py-2 text-neutral-300 transition hover:bg-red-50 hover:text-red-500"
                  aria-label="Remove media"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t-2 border-neutral-900 pt-5">
          <label className={label} htmlFor="notes">Family notes</label>
          <textarea
            id="notes" name="notes" rows={3}
            defaultValue={initial?.notes ?? ""}
            className={`${input} text-sm`}
            placeholder="Mom's trick: use mustard oil… · halve the chilli for the kids · pairs well with curd rice"
          />
          <p className="mt-1 text-[10px] text-neutral-400">Visible to everyone in the household.</p>
        </div>
      </Section>

      {state.error && (
        <p className="rounded-none bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-neutral-900 bg-amber-50 md:left-56">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-xs text-neutral-500">
            {preview
              ? `${Math.round(preview.n.kcal)} kcal/serving · P ${preview.n.proteinG}g · C ${preview.n.carbsG}g · F ${preview.n.fatG}g`
              : "Add ingredients to see live nutrition"}
          </p>
          <div className="flex items-center gap-2">
            <Link href={recipeId ? `/recipes/${recipeId}` : "/recipes"} className="rounded-none px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="rounded-none bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save recipe"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
