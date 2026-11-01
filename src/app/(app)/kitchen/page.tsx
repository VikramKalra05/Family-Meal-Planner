import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireFullProfile } from "@/lib/profile";
import { mondayOf } from "@/lib/planner";

export const instant = false;

const SLOT_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner",
};

/**
 * KITCHEN MODE — for the cook/maid (role "staff") and household owner.
 * Shows what to cook and in what quantity. NO personal health data
 * (no weights, no targets, no member-level nutrition) by design.
 */
export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { w } = await searchParams;
  const profile = await requireFullProfile();
  if (profile.role !== "staff" && profile.role !== "owner") {
    redirect("/family");
  }
  const weekStart = mondayOf(typeof w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : new Date().toISOString().slice(0, 10));

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("household_id", profile.household_id!)
    .eq("week_start", weekStart)
    .maybeSingle();
  const { data: entries } = plan
    ? await supabase
        .from("plan_entries")
        .select("id, entry_date, slot, servings_base, status, recipes(title, steps, servings, recipe_items(quantity_g, unit, ingredients(name)))")
        .eq("plan_id", plan.id)
    : { data: null };

  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.parse(weekStart) + i * 86400000).toISOString().slice(0, 10),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold uppercase tracking-tight">🍳 Kitchen Mode</h1>
          <p className="text-sm text-neutral-500">
            Week of {new Date(weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "long" })} — dishes and
            quantities only. Family health data is not shown here.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/kitchen?w=${mondayOf(new Date(Date.parse(weekStart) - 7 * 86400000).toISOString())}`} className="rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-extrabold uppercase shadow-[2px_2px_0_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
            ← Prev
          </Link>
          <Link href={`/kitchen?w=${mondayOf(new Date(Date.parse(weekStart) + 7 * 86400000).toISOString())}`} className="rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-extrabold uppercase shadow-[2px_2px_0_#111] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
            Next →
          </Link>
        </div>
      </div>

      {!entries?.length ? (
        <div className="rounded-none border-2 border-neutral-900 bg-white p-10 text-center shadow-[4px_4px_0_#111]">
          <p className="text-4xl">🍽️</p>
          <p className="mt-3 text-sm font-bold uppercase tracking-wide">No plan this week</p>
          <p className="mt-2 text-sm text-neutral-500">The family hasn&apos;t generated a meal plan yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {days.map((date) => {
            const dayEntries = entries.filter((e) => e.entry_date === date);
            return (
              <div key={date} className="rounded-none border-2 border-neutral-900 bg-white shadow-[4px_4px_0_#111]">
                <div className="border-b-2 border-neutral-900 bg-orange-200 px-4 py-2 text-sm font-extrabold uppercase tracking-wide">
                  {new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
                </div>
                <div className="divide-y-2 divide-dashed divide-neutral-200">
                  {dayEntries.length === 0 && <p className="p-4 text-sm text-neutral-400">Nothing planned</p>}
                  {dayEntries.map((e) => {
                    const recipe = e.recipes as unknown as {
                      title: string;
                      steps: string[];
                      servings: number;
                      recipe_items: { quantity_g: number | null; unit: string | null; ingredients: { name: string }[] | null }[];
                    } | null;
                    if (!recipe) return null;
                    const factor = Number(e.servings_base) / Math.max(1, recipe.servings);
                    return (
                      <div key={e.id} className="p-4">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
                          {SLOT_LABEL[e.slot] ?? e.slot} · for {Number(e.servings_base)} eater{Number(e.servings_base) > 1 ? "s" : ""}
                        </p>
                        <p className="text-sm font-extrabold">{recipe.title}</p>
                        <ul className="mt-2 space-y-1 text-xs">
                          {(recipe.recipe_items ?? []).map((i, idx) => (
                            <li key={idx} className="flex justify-between gap-2">
                              <span>{i.ingredients?.[0]?.name ?? "item"}</span>
                              <span className="font-bold">
                                {Math.round(Number(i.quantity_g ?? 0) * factor)} {i.unit ?? "g"}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[10px] font-extrabold uppercase tracking-wide text-neutral-500 hover:text-neutral-900">
                            Show steps
                          </summary>
                          <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs">
                            {recipe.steps.map((st, i) => (
                              <li key={i}>{st}</li>
                            ))}
                          </ol>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
