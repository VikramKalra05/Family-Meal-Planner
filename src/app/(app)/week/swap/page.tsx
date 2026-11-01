import { createClient } from "@/lib/supabase/server";
import { requireFullProfile } from "@/lib/profile";
import { candidatesFor, mondayOf, SLOT_KEYS, type SlotKey } from "@/lib/planner";
import { loadPlanData } from "@/lib/plan-data";
import { BackLink } from "@/components/back-link";
import { swapEntryAction } from "../actions";

export const instant = false;

export default async function SwapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { date, slot: slotParam, entry, w } = await searchParams;
  if (typeof date !== "string" || typeof slotParam !== "string" || typeof entry !== "string" || !SLOT_KEYS.includes(slotParam as SlotKey)) {
    return <p className="text-sm text-neutral-500">Invalid swap request.</p>;
  }
  const weekStart = mondayOf(typeof w === "string" ? w : date);
  const profile = await requireFullProfile();
  const supabase = await createClient();

  const { data: entryRow } = await supabase
    .from("plan_entries")
    .select("id, member_id, slot, entry_date")
    .eq("id", entry)
    .maybeSingle();
  if (!entryRow) return <p className="text-sm text-neutral-500">Entry not found.</p>;

  const { plannerRecipes, members } = await loadPlanData();
  const eater = entryRow.member_id
    ? members.find((m) => m.id === entryRow.member_id) ?? members[0]
    : undefined;
  if (!eater) return <p className="text-sm text-neutral-500">No eater resolved for this entry.</p>;

  // Variety: avoid dishes already planned this week.
  const { data: allWeek } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("household_id", profile.household_id!)
    .eq("week_start", weekStart)
    .maybeSingle();
  let usedTitles = new Set<string>();
  if (allWeek) {
    const { data: weekRows } = await supabase
      .from("plan_entries")
      .select("recipe_id")
      .eq("plan_id", allWeek.id);
    const ids = new Set((weekRows ?? []).map((r) => r.recipe_id));
    usedTitles = new Set(plannerRecipes.filter((r) => ids.has(r.id)).map((r) => r.title));
  }

  const slot = entryRow.slot as SlotKey;
  const candidates = candidatesFor(plannerRecipes, eater, slot, usedTitles, 8);

  return (
    <div className="space-y-5">
      <div>
        <BackLink href="/week" label="Week" />
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          Swap {slot} · {new Date(entryRow.entry_date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
        </h1>
        <p className="text-sm text-neutral-500">
          Ranked for {eater.name} — kcal fit for the slot, family diet rules, allergen safety.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((c) => (
          <form key={c.recipe.id} action={swapEntryAction} className="rounded-none border-2 border-neutral-900 bg-white p-4 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111]">
            <input type="hidden" name="entryId" value={entry} />
            <input type="hidden" name="recipeId" value={c.recipe.id} />
            <p className="text-sm font-extrabold">{c.recipe.title}</p>
            <p className="mt-1 text-xs text-neutral-600">
              {Math.round(c.recipe.kcal)} kcal · {Math.round(c.kcalGap * 100)}% off slot target
            </p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              {c.reason}
            </p>
            <button className="mt-3 w-full rounded-none border-2 border-neutral-900 bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
              Choose this
            </button>
          </form>
        ))}
        {candidates.length === 0 && (
          <p className="text-sm text-neutral-500">No safe candidates — every dish clashes with diet or allergies.</p>
        )}
      </div>
    </div>
  );
}
