import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireFullProfile } from "@/lib/profile";
import { loadPlanData } from "@/lib/plan-data";
import { mondayOf, SLOT_KEYS } from "@/lib/planner";
import { generateWeekAction, removeEntryAction, setEntryStatusAction } from "./actions";

export const instant = false;

const SLOT_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner · family",
};

interface CellEntry {
  id: string;
  recipeId: string;
  title: string;
  kcal: number | null;
  portion: number;
  status: string;
  memberName: string | null;
}

export default async function WeekPage({ searchParams }: PageProps<"/week">) {
  const { w, m } = await searchParams;
  const weekStart = mondayOf(typeof w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : new Date().toISOString().slice(0, 10));
  const prev = mondayOf(new Date(Date.parse(weekStart) - 7 * 86400000).toISOString());
  const next = mondayOf(new Date(Date.parse(weekStart) + 7 * 86400000).toISOString());

  const profile = await requireFullProfile();
  const supabase = await createClient();
  const { members, recipesById } = await loadPlanData();

  const { data: plan } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("household_id", profile.household_id!)
    .eq("week_start", weekStart)
    .maybeSingle();
  const { data: entries } = plan
    ? await supabase
        .from("plan_entries")
        .select("id, entry_date, slot, member_id, recipe_id, servings_base, status, member_portions")
        .eq("plan_id", plan.id)
    : { data: null };

  const rows = (entries ?? []) as {
    id: string;
    entry_date: string;
    slot: string;
    member_id: string | null;
    recipe_id: string;
    servings_base: number;
    status: string;
    member_portions: Record<string, number> | null;
  }[];

  // View = whose personal meals are shown; dinner is always the family row.
  const viewMemberId =
    typeof m === "string" && members.some((mm) => mm.id === m) ? m : profile.id;
  const viewMember = members.find((mm) => mm.id === viewMemberId);

  const portionOf = (e: (typeof rows)[number]) =>
    e.member_portions?.[e.member_id ?? viewMemberId] ?? Number(e.servings_base) ?? 1;

  function cellFor(date: string, slot: string): CellEntry | null {
    const e = rows.find(
      (r) =>
        r.entry_date === date &&
        r.slot === slot &&
        (slot === "dinner" ? r.member_id === null : r.member_id === viewMemberId),
    );
    if (!e) return null;
    const info = recipesById.get(e.recipe_id);
    return {
      id: e.id,
      recipeId: e.recipe_id,
      title: info?.title ?? "Recipe",
      kcal: info?.kcal != null ? Math.round(info.kcal * portionOf(e)) : null,
      portion: portionOf(e),
      status: e.status,
      memberName: e.member_id ? (members.find((mm) => mm.id === e.member_id)?.name ?? null) : null,
    };
  }

  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.parse(weekStart) + i * 86400000).toISOString().slice(0, 10),
  );
  const dayLabel = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });

  const hasPlan = !!plan && rows.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold uppercase tracking-tight">Week planner</h1>
          <p className="text-sm text-neutral-500">
            {new Date(weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/week?w=${prev}${viewMemberId !== profile.id ? `&m=${viewMemberId}` : ""}`} className="rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
            ← Prev
          </Link>
          <Link href={`/week?w=${next}${viewMemberId !== profile.id ? `&m=${viewMemberId}` : ""}`} className="rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
            Next →
          </Link>
          <Link
            href={`/shopping?w=${weekStart}`}
            className="rounded-none border-2 border-neutral-900 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111]"
          >
            🛒 Shopping
          </Link>
          <form action={generateWeekAction}>
            <input type="hidden" name="weekStart" value={weekStart} />
            <button
              className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111]"
              title={hasPlan ? "Discards the current plan and regenerates" : "Generate the week"}
            >
              ✨ {hasPlan ? "Regenerate" : "Generate week"}
            </button>
          </form>
        </div>
      </div>

      {hasPlan && members.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">Viewing</span>
          {members.map((mm) => (
            <Link
              key={mm.id}
              href={`/week?w=${weekStart}&m=${mm.id}`}
              className={`rounded-full border-2 border-neutral-900 px-3 py-1 text-xs font-bold shadow-[2px_2px_0_#111] transition-all ${
                viewMemberId === mm.id ? "bg-yellow-300 text-neutral-900" : "bg-white text-neutral-600 hover:bg-yellow-100"
              }`}
            >
              {mm.name}
            </Link>
          ))}
        </div>
      )}

      {!hasPlan ? (
        <div className="rounded-none border-2 border-neutral-900 bg-white p-10 text-center shadow-[4px_4px_0_#111]">
          <p className="text-4xl">🗓️</p>
          <p className="mt-3 text-sm font-bold uppercase tracking-wide">No plan for this week yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
            The engine picks a variety of dishes per member and scales portions to hit each slot&apos;s
            kcal target — with one shared family dinner every day.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-none border-2 border-neutral-900 bg-white shadow-[5px_5px_0_#111]">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b-2 border-neutral-900 bg-yellow-300">
                <th className="w-28 border-r-2 border-neutral-900 px-2 py-2 text-left text-[10px] font-extrabold uppercase tracking-widest">
                  {viewMember?.name ?? "Me"}
                </th>
                {days.map((d) => (
                  <th key={d} className="border-r-2 border-neutral-900 px-2 py-2.5 text-center text-sm font-extrabold uppercase tracking-wide text-neutral-900 last:border-r-0">
                    {dayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOT_KEYS.map((slot) => (
                <tr key={slot} className="border-b-2 border-dashed border-neutral-200 last:border-b-0">
                  <th className="border-r-2 border-neutral-900 bg-neutral-50 px-2.5 py-2 text-left align-top text-xs font-extrabold uppercase tracking-widest text-neutral-500">
                    {SLOT_LABEL[slot]}
                  </th>
                  {days.map((date) => {
                    const cell = cellFor(date, slot);
                    return (
                      <td key={date + slot} className="border-r-2 border-dashed border-neutral-200 p-2 align-top last:border-r-0">
                        {cell ? (
                          <div className="space-y-1">
                            <Link href={`/recipes/${cell.recipeId}`} className="block text-sm font-bold leading-snug hover:underline">
                              {cell.title}
                            </Link>
                            <p className="text-xs text-neutral-500">
                              {cell.kcal != null && <span className="font-bold text-neutral-700">{cell.kcal} kcal</span>}
                              {cell.portion !== 1 && <span> · {cell.portion}×</span>}
                            </p>
                            {cell.status !== "planned" && (
                              <span className="inline-block rounded-full border-2 border-neutral-900 bg-lime-300 px-1.5 py-0.5 text-[9px] font-extrabold uppercase">
                                {cell.status}
                              </span>
                            )}
                            <div className="flex items-center gap-1 pt-0.5">
                              <Link
                                href={`/week/swap?date=${date}&slot=${slot}&entry=${cell.id}&w=${weekStart}`}
                                className="rounded-none border border-neutral-900 bg-white px-1.5 py-0.5 text-[9px] font-extrabold uppercase hover:bg-yellow-200"
                              >
                                ⇄
                              </Link>
                              {cell.status !== "eaten" && (
                                <form action={setEntryStatusAction}>
                                  <input type="hidden" name="entryId" value={cell.id} />
                                  <input type="hidden" name="status" value="eaten" />
                                  <button className="rounded-none border border-neutral-900 bg-lime-300 px-1.5 py-0.5 text-[9px] font-extrabold uppercase hover:bg-lime-400">
                                    ate
                                  </button>
                                </form>
                              )}
                              <form action={removeEntryAction} className="ml-auto">
                                <input type="hidden" name="entryId" value={cell.id} />
                                <button className="text-[9px] font-bold text-neutral-300 hover:text-red-600" aria-label="Remove">✕</button>
                              </form>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Day totals */}
              <tr className="border-t-2 border-neutral-900 bg-amber-50">
                <th className="border-r-2 border-neutral-900 px-2.5 py-2 text-left text-xs font-extrabold uppercase tracking-widest text-neutral-500">
                  Day total
                </th>
                {days.map((date) => {
                  const total = SLOT_KEYS.reduce((sum, slot) => {
                    const cell = cellFor(date, slot);
                    return sum + (cell?.kcal ?? 0);
                  }, 0);
                  return (
                    <td key={date + "t"} className="border-r-2 border-dashed border-neutral-200 px-2 py-2.5 text-center text-sm font-extrabold last:border-r-0">
                      {total > 0 ? `${total} kcal` : "—"}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {hasPlan && (
        <p className="text-[11px] text-neutral-400">
          Portions are scaled per person to hit each slot&apos;s kcal target (×0.5 = half a serving).
          Use ⇄ to swap a dish — the replacement is re-portioned automatically.
        </p>
      )}
    </div>
  );
}
