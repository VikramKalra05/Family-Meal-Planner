import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteRecipe, tagRecipeMedia, untagRecipeMedia } from "../actions";
import { BackLink } from "@/components/back-link";
import { SubmitButton } from "@/components/submit-button";
import { PortionCalculator, type CalcIngredient, type CalcMember } from "./portion-calculator";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { dishEmoji, parseMediaUrl, placeholderGradient } from "@/lib/media";
import { healthTags } from "@/lib/nutrition/health";
import { servingSize } from "@/lib/nutrition/serving";
import type { Ingredient, Profile, Recipe, RecipeNutrition } from "@/lib/db-types";

export const instant = false;

interface ItemRow {
  id: string;
  quantity_g: number | null;
  unit: string | null;
  note: string | null;
  ingredients: Pick<Ingredient, "name" | "name_hi"> | null;
}

interface MediaRow {
  id: string;
  kind: "image" | "video";
  url: string;
  label: string | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  link: "Link",
};

export default async function RecipeDetailPage({
  params,
}: PageProps<"/recipes/[id]">) {
  const { id } = await params;
  const profile = await requireFullProfile();
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("*, recipe_nutrition(kcal, protein_g, carbs_g, fat_g, fiber_g, method), recipe_media(id, kind, url, label)")
    .eq("id", id)
    .maybeSingle();
  if (!recipe) notFound();

  const [{ data: items }, householdRes] = await Promise.all([
    supabase
      .from("recipe_items")
      .select("id, quantity_g, unit, note, ingredients(name, name_hi)")
      .eq("recipe_id", id),
    profile.household_id
      ? supabase
          .from("profiles")
          .select("id, display_name, targets_cache")
          .eq("household_id", profile.household_id)
      : Promise.resolve({ data: null }),
  ]);

  let members: CalcMember[] = [{ id: profile.id, name: profile.display_name, targets: profile.targets_cache?.targets ?? null }];
  if (householdRes.data) {
    members = ((householdRes.data ?? []) as Pick<Profile, "id" | "display_name" | "targets_cache">[])
      .filter((m) => m.targets_cache)
      .map((m) => ({ id: m.id, name: m.display_name, targets: m.targets_cache!.targets }));
    if (!members.some((m) => m.id === profile.id)) {
      members.unshift({ id: profile.id, name: profile.display_name, targets: profile.targets_cache?.targets ?? null });
    }
  }

  const r = recipe as Recipe & {
    recipe_nutrition: RecipeNutrition | null;
    recipe_media: MediaRow[] | null;
  };
  const rows = (items ?? []) as unknown as ItemRow[];
  const calcIngredients: CalcIngredient[] = rows.map((it) => ({
    id: it.id,
    name: it.ingredients?.name ?? "unknown",
    quantityG: it.quantity_g == null ? null : Number(it.quantity_g),
    unit: it.unit,
    note: it.note,
  }));
  const media = r.recipe_media ?? [];
  const videos = media.filter((m) => m.kind === "video");
  const extraImages = media.filter((m) => m.kind === "image");
  const isOwner = r.owner_id === profile.id;

  const hero = r.image_url ?? extraImages[0]?.url ?? null;
  const tags = r.recipe_nutrition
    ? healthTags({
        kcal: r.recipe_nutrition.kcal,
        proteinG: r.recipe_nutrition.protein_g,
        carbsG: r.recipe_nutrition.carbs_g,
        fatG: r.recipe_nutrition.fat_g,
        fiberG: r.recipe_nutrition.fiber_g ?? 0,
      })
    : [];

  const totalRawGrams = calcIngredients.reduce((sum, i) => sum + (i.quantityG ?? 0), 0);
  const serving = servingSize(r.title, totalRawGrams, r.servings);

  return (
    <div className="space-y-5">
      <div>
        <BackLink href="/recipes" label="Recipes" />
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
          {r.title}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              r.is_veg ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {r.is_veg ? "VEG" : "NON-VEG"}
          </span>
          {tags.map((t) => (
            <span
              key={t.label}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                t.tone === "good" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {t.label}
            </span>
          ))}
        </h1>
        {r.description && <p className="mt-1 text-sm text-neutral-500">{r.description}</p>}
        <p className="mt-1 text-xs text-neutral-400">
          {r.servings} servings base
          {r.prep_minutes ? ` · ${r.prep_minutes} min` : ""}
          {r.cuisine ? ` · ${r.cuisine.replace("-", " ")}` : ""}
          {` · nutrition ${r.recipe_nutrition?.method ?? "n/a"}`}
        </p>
      </div>

      {isOwner && (
        <div className="flex gap-2">
          <Link
            href={`/recipes/${r.id}/edit`}
            className="rounded-none border-2 border-neutral-900 px-3 py-1.5 text-xs font-medium hover:bg-amber-50"
          >
            Edit recipe & media
          </Link>
          <form action={deleteRecipe}>
            <input type="hidden" name="recipe_id" value={r.id} />
            <SubmitButton
              pendingText="Deleting…"
              className="rounded-none border-2 border-neutral-900 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              Delete
            </SubmitButton>
          </form>
        </div>
      )}

      {videos.length > 0 ? (
        <section className="rounded-none bg-white p-5 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Watch later
          </h2>
          <div className="flex flex-wrap gap-3">
            {videos.map((m) => {
              const parsed = parseMediaUrl(m.url);
              return (
                <div key={m.id} className="relative w-44 overflow-hidden rounded-none border-2 border-neutral-900 bg-white shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {parsed.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={parsed.thumbnailUrl} alt={m.label ?? "video"} className="h-24 w-full object-cover" />
                  ) : (
                    <span className="flex h-24 w-full items-center justify-center bg-yellow-200 text-3xl">▶</span>
                  )}
                  <span className="block truncate px-2 py-1.5 text-[11px] font-bold text-neutral-700">
                    ▶ {m.label ?? PLATFORM_LABEL[parsed.platform]}
                  </span>
                </a>
                <form action={untagRecipeMedia} className="absolute right-1 top-1">
                  <input type="hidden" name="mediaId" value={m.id} />
                  <input type="hidden" name="recipeId" value={r.id} />
                  <SubmitButton
                    pendingText="…"
                    ariaLabel="Remove tag"
                    className="rounded-none border-2 border-neutral-900 bg-white px-1.5 text-[10px] font-extrabold leading-5 shadow-[2px_2px_0_#111] hover:bg-red-300 disabled:opacity-60"
                  >
                    ✕
                  </SubmitButton>
                </form>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="rounded-none border-2 border-dashed border-neutral-900 bg-white/60 px-4 py-3 text-xs text-neutral-400">
          No videos or photos tagged yet — tag one below to save it for later.
        </p>
      )}

      {/* Quick tag form — every household member can tag watch-later links */}
      <form action={tagRecipeMedia} className="flex flex-wrap items-end gap-2 rounded-none border-2 border-neutral-900 bg-white p-4 shadow-[3px_3px_0_#111]">
        <input type="hidden" name="recipe_id" value={r.id} />
        <div className="w-28">
          <label htmlFor={`kind-${r.id}`} className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">Type</label>
          <select id={`kind-${r.id}`} name="kind" className="w-full rounded-none border-2 border-neutral-900 bg-white px-2 py-2 text-xs font-bold focus:shadow-[3px_3px_0_#111] focus:outline-none">
            <option value="video">▶ Video</option>
            <option value="image">🖼 Photo</option>
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor={`url-${r.id}`} className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">Link</label>
          <input id={`url-${r.id}`} name="url" type="url" required placeholder="https://youtu.be/… or https://instagram.com/reel/…" className="w-full rounded-none border-2 border-neutral-900 bg-white px-2.5 py-2 text-xs focus:shadow-[3px_3px_0_#111] focus:outline-none" />
        </div>
        <div className="w-36">
          <label htmlFor={`mlabel-${r.id}`} className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">Label</label>
          <input id={`mlabel-${r.id}`} name="label" placeholder="optional" className="w-full rounded-none border-2 border-neutral-900 bg-white px-2.5 py-2 text-xs focus:shadow-[3px_3px_0_#111] focus:outline-none" />
        </div>
        <SubmitButton
          pendingText="Tagging…"
          className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] disabled:opacity-60"
        >
          + Tag
        </SubmitButton>
      </form>

      <div className={`overflow-hidden rounded-none border-2 border-neutral-900 shadow-[4px_4px_0_#111] ${hero ? "" : "hidden"}`}>
        {hero && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero} alt={r.title} className="h-64 w-full object-cover" />
            <p className="bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
              Recipe photo
            </p>
          </>
        )}
      </div>
      {!hero && (
        <div
          className={`flex h-48 items-center justify-center border-2 border-neutral-900 shadow-[4px_4px_0_#111] ${placeholderGradient(r.cuisine)}`}
          style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(23,23,23,0.07) 0 12px, transparent 12px 24px)" }}
        >
          <span className="border-2 border-neutral-900 bg-white px-6 py-4 text-6xl shadow-[4px_4px_0_#111]">
            {dishEmoji(r.title)}
          </span>
        </div>
      )}

      {r.recipe_nutrition && (
        <section className="grid grid-cols-2 gap-3 rounded-none bg-white p-5 border-2 border-neutral-900 shadow-[4px_4px_0_#111] md:grid-cols-5">
          {[
            { label: "Calories", value: `${Math.round(r.recipe_nutrition.kcal)} kcal`, color: "text-neutral-900" },
            { label: "Protein", value: `${r.recipe_nutrition.protein_g} g`, color: "text-emerald-600" },
            { label: "Carbs", value: `${r.recipe_nutrition.carbs_g} g`, color: "text-amber-600" },
            { label: "Fat", value: `${r.recipe_nutrition.fat_g} g`, color: "text-red-600" },
            { label: "Fiber", value: `${r.recipe_nutrition.fiber_g ?? 0} g`, color: "text-violet-600" },
          ].map((m) => (
            <div key={m.label}>
              <p className="text-[10px] uppercase tracking-wide text-neutral-400">{m.label}</p>
              <p className={`text-lg font-semibold ${m.color}`}>{m.value}</p>
            </div>
          ))}
          <p className="col-span-2 text-[10px] text-neutral-400 md:col-span-5">
            {serving.phrase}
            {" · prepared from "}
            {(totalRawGrams / 1000).toFixed(2)} kg of ingredients
            {" (weights are raw; cooked yield is slightly lower)"}
          </p>
        </section>
      )}

      <section className="rounded-none bg-white p-6 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Ingredients & portions
        </h2>
        <p className="mb-4 text-xs text-neutral-400">
          Scale the batch, or fit it to a family member&apos;s meal target — quantities adjust live.
        </p>
        <PortionCalculator
          baseServings={r.servings}
          gramsPerServing={serving.gramsPerServing}
          perServing={
            r.recipe_nutrition
              ? {
                  kcal: r.recipe_nutrition.kcal,
                  proteinG: r.recipe_nutrition.protein_g,
                  carbsG: r.recipe_nutrition.carbs_g,
                  fatG: r.recipe_nutrition.fat_g,
                  fiberG: r.recipe_nutrition.fiber_g ?? 0,
                }
              : null
          }
          ingredients={calcIngredients}
          members={members}
          currentMemberId={profile.id}
        />
      </section>

      {r.notes && (
        <section className="rounded-none border-2 border-neutral-900 bg-amber-200 p-5">
          <h2 className="mb-1.5 text-sm font-semibold text-amber-900">Family notes</h2>
          <p className="whitespace-pre-line text-sm text-amber-900/90">{r.notes}</p>
        </section>
      )}

      <section className="rounded-none bg-white p-6 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Steps
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {r.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
