"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Recipe, RecipeNutrition } from "@/lib/db-types";
import { healthScore, healthTags, type HealthTag } from "@/lib/nutrition/health";
import { dishEmoji, parseMediaUrl, placeholderGradient } from "@/lib/media";

export interface RecipeCardData extends Recipe {
  recipe_nutrition: RecipeNutrition | null;
  media: { id: string; kind: "image" | "video"; url: string; label: string | null }[];
  gramsPerServing?: number;
}

type VegFilter = "all" | "veg" | "non_veg";
type SortKey = "recommended" | "healthiest" | "protein" | "light" | "quick";
type Refinement = "healthy" | "protein" | "fiber" | "light" | "quick" | "elaborate";

function tagsFor(n: RecipeNutrition | null): HealthTag[] {
  if (!n) return [];
  return healthTags({
    kcal: n.kcal,
    proteinG: n.protein_g,
    carbsG: n.carbs_g,
    fatG: n.fat_g,
    fiberG: n.fiber_g ?? 0,
  });
}

const REFINEMENTS: { key: Refinement; label: string }[] = [
  { key: "healthy", label: "✦ Healthy picks" },
  { key: "protein", label: "High protein" },
  { key: "fiber", label: "High fiber" },
  { key: "light", label: "Light" },
  { key: "quick", label: "⚡ Quick · ≤20 min" },
  { key: "elaborate", label: "Elaborate · 45 min+" },
];

/** Sliding three-way toggle (All / Veg / Non-veg). */
function TriToggle({
  value,
  onChange,
  options,
}: {
  value: VegFilter;
  onChange: (v: VegFilter) => void;
  options: { key: VegFilter; label: string; count: number }[];
}) {
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  return (
    <div className="relative grid grid-cols-3 rounded-full border-2 border-neutral-900 bg-white p-1 shadow-[3px_3px_0_#111]">
      <span
        className="pointer-events-none absolute inset-y-1 rounded-full bg-white transition-all duration-200"
        style={{ width: "calc((100% - 8px) / 3)", left: `calc(4px + ${idx} * (100% - 8px) / 3)` }}
      />
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`relative z-10 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.key ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-0.5 text-[10px] opacity-60">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

const selectCls =
  "rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition focus:shadow-[3px_3px_0_#111] focus:outline-none";

function cardArt(r: RecipeCardData): string | null {
  if (r.image_url) return r.image_url;
  const image = r.media.find((m) => m.kind === "image");
  if (image) return image.url;
  const video = r.media.find((m) => m.kind === "video");
  if (video) return parseMediaUrl(video.url).thumbnailUrl;
  return null;
}

function VegMark({ isVeg }: { isVeg: boolean }) {
  // FSSAI-style packaged-food mark: green dot = veg, brown triangle = non-veg.
  return (
    <span
      className={`flex h-5 w-5 items-center justify-center rounded-[5px] border-2 bg-white shadow-[2px_2px_0_#111] ${
        isVeg ? "border-neutral-900" : "border-neutral-900"
      }`}
      title={isVeg ? "Vegetarian" : "Non-vegetarian"}
    >
      {isVeg ? (
        <span className="h-2.5 w-2.5 rounded-full bg-lime-400" />
      ) : (
        <span className="h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-stone-800" />
      )}
    </span>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide"
          : "border-2 border-neutral-900 bg-white text-neutral-600 shadow-[2px_2px_0_#111] hover:bg-yellow-100"
      }`}
    >
      {children}
    </button>
  );
}

export function RecipesBrowser({ recipes }: { recipes: RecipeCardData[] }) {
  const [q, setQ] = useState("");
  const [veg, setVeg] = useState<VegFilter>("all");
  const [cuisine, setCuisine] = useState("all");
  const [sort, setSort] = useState<SortKey>("recommended");
  const [refinements, setRefinements] = useState<Set<Refinement>>(new Set());

  const cuisines = useMemo(
    () => [...new Set(recipes.map((r) => r.cuisine).filter((c): c is string => !!c))].sort(),
    [recipes],
  );

  const toggleRefinement = (key: Refinement) => {
    setRefinements((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (key === "quick") next.delete("elaborate");
        if (key === "elaborate") next.delete("quick");
        next.add(key);
        if (key === "healthy") setSort("healthiest"); // suggestion comes with its sort
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = recipes.filter((r) => {
      if (veg === "veg" && !r.is_veg) return false;
      if (veg === "non_veg" && r.is_veg) return false;
      if (cuisine !== "all" && r.cuisine !== cuisine) return false;
      if (!needle) return true;
      return (
        r.title.toLowerCase().includes(needle) ||
        (r.description ?? "").toLowerCase().includes(needle) ||
        (r.cuisine ?? "").toLowerCase().includes(needle)
      );
    });

    const withTags = out.map((r) => ({ r, tags: tagsFor(r.recipe_nutrition) }));

    const refined = withTags.filter(({ r, tags }) => {
      for (const key of refinements) {
        const labels = new Set(tags.map((t) => t.label));
        switch (key) {
          case "healthy":
            if (tags.some((t) => t.tone === "watch") || tags.length === 0) return false;
            break;
          case "protein":
            if (!labels.has("High protein") && !labels.has("Protein-rich")) return false;
            break;
          case "fiber":
            if (!labels.has("High fiber") && !labels.has("Fiber-rich")) return false;
            break;
          case "light":
            if (!labels.has("Light")) return false;
            break;
          case "quick":
            if (r.prep_minutes == null || r.prep_minutes > 20) return false;
            break;
          case "elaborate":
            if (r.prep_minutes == null || r.prep_minutes < 45) return false;
            break;
        }
      }
      return true;
    });

    const sorted = [...refined];
    const scoreOf = (n: RecipeNutrition | null) =>
      n
        ? healthScore({ kcal: n.kcal, proteinG: n.protein_g, carbsG: n.carbs_g, fatG: n.fat_g, fiberG: n.fiber_g ?? 0 })
        : -Infinity;
    switch (sort) {
      case "healthiest":
        sorted.sort((a, b) => scoreOf(b.r.recipe_nutrition) - scoreOf(a.r.recipe_nutrition));
        break;
      case "protein":
        sorted.sort((a, b) => (b.r.recipe_nutrition?.protein_g ?? 0) - (a.r.recipe_nutrition?.protein_g ?? 0));
        break;
      case "light":
        sorted.sort((a, b) => (a.r.recipe_nutrition?.kcal ?? 9999) - (b.r.recipe_nutrition?.kcal ?? 9999));
        break;
      case "quick":
        sorted.sort((a, b) => (a.r.prep_minutes ?? 999) - (b.r.prep_minutes ?? 999));
        break;
      default:
        sorted.sort((a, b) => a.r.title.localeCompare(b.r.title));
    }
    return sorted.map((x) => x.r);
  }, [recipes, q, veg, cuisine, refinements, sort]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="space-y-3">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            viewBox="0 0 20 20" fill="currentColor" aria-hidden
          >
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${recipes.length} dishes — filters as you type…`}
            className="w-full rounded-none border-2 border-neutral-900 bg-white py-2.5 pl-10 pr-4 text-sm transition focus:shadow-[3px_3px_0_#111] focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TriToggle
            value={veg}
            onChange={setVeg}
            options={[
              { key: "all", label: "All", count: recipes.length },
              { key: "veg", label: "Veg", count: recipes.filter((r) => r.is_veg).length },
              { key: "non_veg", label: "Non-veg", count: recipes.filter((r) => !r.is_veg).length },
            ]}
          />
          <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className={selectCls} aria-label="Cuisine">
            <option value="all">All cuisines</option>
            {cuisines.map((c) => (
              <option key={c} value={c}>{c.replace("-", " ")}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className={selectCls}
            aria-label="Sort"
          >
            <option value="recommended">Sort: Recommended</option>
            <option value="healthiest">Sort: Healthiest first</option>
            <option value="protein">Sort: Highest protein</option>
            <option value="light">Sort: Lowest calories</option>
            <option value="quick">Sort: Quickest</option>
          </select>
          <span className="ml-auto hidden text-xs text-neutral-400 sm:block">
            {filtered.length} of {recipes.length} dishes
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {REFINEMENTS.map((rf) => (
            <Chip key={rf.key} active={refinements.has(rf.key)} onClick={() => toggleRefinement(rf.key)}>
              {rf.label}
            </Chip>
          ))}
          {refinements.size > 0 && (
            <button
              type="button"
              onClick={() => {
                setRefinements(new Set());
                setSort("recommended");
              }}
              className="rounded-full px-2.5 py-1.5 text-xs font-medium text-neutral-400 transition hover:text-red-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Catalog grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
        {filtered.map((r) => {
          const n = r.recipe_nutrition;
          const art = cardArt(r);
          const videoCount = r.media.filter((m) => m.kind === "video").length;

          return (
            <Link
              key={r.id}
              href={`/recipes/${r.id}`}
              className="group overflow-hidden rounded-none bg-white border-2 border-neutral-900 shadow-[4px_4px_0_#111] transition-all duration-200 hover:-translate-y-1 hover:shadow-[6px_6px_0_#111]"
            >
              <div className={`relative aspect-[5/4] overflow-hidden ${placeholderGradient(r.cuisine)}`}>
                {art ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={art}
                    alt={r.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(23,23,23,0.07) 0 10px, transparent 10px 20px)" }}
                  >
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="border-2 border-neutral-900 bg-white px-3.5 py-2 text-4xl shadow-[3px_3px_0_#111] transition-transform duration-300 group-hover:rotate-3 group-hover:scale-110">
                        {dishEmoji(r.title)}
                      </span>
                    </span>
                  </div>
                )}
                <div className="absolute left-2 top-2">
                  <VegMark isVeg={r.is_veg} />
                </div>
                {videoCount > 0 && (
                  <span className="absolute bottom-2 left-2 rounded-full border-2 border-neutral-900 bg-yellow-300 px-2 py-0.5 text-[10px] font-extrabold text-neutral-900">
                    ▶ {videoCount}
                  </span>
                )}
              </div>
              <div className="space-y-1 p-3">
                <h3 className="line-clamp-1 text-sm font-semibold text-neutral-900 group-hover:underline">
                  {r.title}
                </h3>
                {n && (
                  <p className="text-xs text-neutral-700">
                    <span className="font-bold">{Math.round(n.kcal)} kcal</span>
                    {r.gramsPerServing ? <span className="text-neutral-400"> / {r.gramsPerServing} g</span> : null}
                  </p>
                )}
                {n && (
                  <p className="text-[11px] font-semibold">
                    <span className="text-emerald-700">P</span> {Math.round(n.protein_g)}
                    <span className="text-neutral-300"> · </span>
                    <span className="text-amber-700">C</span> {Math.round(n.carbs_g)}
                    <span className="text-neutral-300"> · </span>
                    <span className="text-red-700">F</span> {Math.round(n.fat_g)}
                    {r.prep_minutes != null ? (
                      <>
                        <span className="text-neutral-300"> · </span>
                        <span className="text-neutral-500">{r.prep_minutes} min</span>
                      </>
                    ) : null}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 px-3 pb-2.5">
                <span className="truncate text-[10px] uppercase tracking-wide text-neutral-400">
                  {r.cuisine?.replace("-", " ")}
                </span>
                <HealthPips n={n} />
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-none bg-white p-10 text-center text-sm text-neutral-500 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
          Nothing matches those filters. Try clearing a chip or two.
        </p>
      )}
    </div>
  );
}

function HealthPips({ n }: { n: RecipeNutrition | null }) {
  const tags = tagsFor(n);
  if (tags.length === 0) return null;
  return (
    <span className="flex gap-1" title={tags.map((t) => t.label).join(", ")}>
      {tags.slice(0, 3).map((t) => (
        <span
          key={t.label}
          className={`h-1.5 w-1.5 rounded-full ${t.tone === "good" ? "bg-emerald-400" : "bg-amber-400"}`}
        />
      ))}
    </span>
  );
}
