import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireFullProfile } from "@/lib/profile";
import type { Recipe, RecipeNutrition } from "@/lib/db-types";
import { RecipesBrowser, type RecipeCardData } from "./recipes-browser";

export const instant = false;

interface Row extends Recipe {
  recipe_nutrition: RecipeNutrition | null;
  recipe_media: { id: string; kind: "image" | "video"; url: string; label: string | null }[] | null;
  recipe_items: { quantity_g: number | null }[] | null;
}

export default async function RecipesPage() {
  await requireFullProfile();
  const supabase = await createClient();

  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("*, recipe_nutrition(kcal, protein_g, carbs_g, fat_g, fiber_g), recipe_media(id, kind, url, label), recipe_items(quantity_g)")
    .order("title");

  // Fail loudly — a silent empty grid looks like data loss.
  if (error) {
    const needsMediaMigration = error.message.includes("recipe_media");
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">Recipes</h1>
        <div className="rounded-none border border-amber-300 bg-amber-50 p-6">
          <p className="text-sm font-semibold text-amber-900">Couldn&apos;t load recipes</p>
          <p className="mt-1 font-mono text-xs text-amber-800">{error.message}</p>
          {needsMediaMigration && (
            <p className="mt-3 text-xs text-amber-800">
              Run <code className="rounded bg-white px-1.5 py-0.5">supabase/migrations/0004_recipe_media.sql</code>{" "}
              in the Supabase SQL editor, then refresh — the media table for tagging videos hasn&apos;t been created yet.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Raw-weight totals for the "~Xg per serving" line on cards.
  // Embedded in the same query — this used to be a second full table scan.
  const rows: RecipeCardData[] = ((recipes ?? []) as Row[]).map((r) => {
    const totalGrams = (r.recipe_items ?? []).reduce(
      (sum, item) => sum + Number(item.quantity_g ?? 0),
      0,
    );
    return {
      ...r,
      media: r.recipe_media ?? [],
      gramsPerServing: Math.round(totalGrams / Math.max(1, r.servings)),
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recipes</h1>
          <p className="text-sm text-neutral-500">
            Computed nutrition on every dish · tag videos to watch later
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/recipes/from-reel"
            className="rounded-none border-2 border-neutral-900 bg-white px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111]"
          >
            ✨ Add from Reel
          </Link>
          <Link
            href="/recipes/new"
            className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            + New recipe
          </Link>
        </div>
      </div>

      <RecipesBrowser recipes={rows} />
    </div>
  );
}
