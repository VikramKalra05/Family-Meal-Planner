import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { mondayOf } from "@/lib/planner";
import { requireFullProfile } from "@/lib/profile";
import { buildShoppingListAction, toggleShoppingItemAction } from "../week/actions";
import { ShareButton } from "./share-button";

export const instant = false;

interface Item {
  name: string;
  display: string;
  checked: boolean;
}

export default async function ShoppingPage({ searchParams }: PageProps<"/shopping">) {
  const { w } = await searchParams;
  const weekStart = mondayOf(typeof w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : new Date().toISOString().slice(0, 10));
  const profile = await requireFullProfile();
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("household_id", profile.household_id!)
    .eq("week_start", weekStart)
    .maybeSingle();
  const { data: list } = await supabase
    .from("shopping_lists")
    .select("id, items")
    .eq("household_id", profile.household_id!)
    .eq("week_start", weekStart)
    .maybeSingle();

  const items = (list?.items ?? []) as Item[];
  const unchecked = items.filter((i) => !i.checked).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Shopping list</h1>
          <p className="text-sm text-neutral-500">
            Week of {new Date(weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "long" })} ·
            {" "}plan needs minus pantry stock
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/week?w=${weekStart}`}
            className="rounded-none border-2 border-neutral-900 bg-white px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111]"
          >
            ← Week
          </Link>
          <form action={buildShoppingListAction}>
            <input type="hidden" name="weekStart" value={weekStart} />
            <button
              className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111]"
              title={plan ? "Recalculates from the current plan and pantry" : "Generate a week plan first"}
            >
              🔄 Build from plan
            </button>
          </form>
          {items.length > 0 && <ShareButton items={items} weekStart={weekStart} />}
        </div>
      </div>

      {!plan ? (
        <div className="rounded-none border-2 border-neutral-900 bg-white p-10 text-center shadow-[4px_4px_0_#111]">
          <p className="text-4xl">🛒</p>
          <p className="mt-3 text-sm font-bold uppercase tracking-wide">No plan this week</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
            Generate the week plan first — the list is its ingredient needs minus what your pantry already has.
          </p>
          <Link href="/week" className="mt-4 inline-block rounded-none border-2 border-neutral-900 bg-emerald-400 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111]">
            Go to week planner
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-none border-2 border-neutral-900 bg-white p-10 text-center shadow-[4px_4px_0_#111]">
          <p className="text-4xl">✅</p>
          <p className="mt-3 text-sm font-bold uppercase tracking-wide">
            {list ? "All covered by the pantry" : "List not built yet"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
            {list
              ? "Nothing to buy — the pantry covers this week's plan. Rebuild after changing the plan."
              : "Hit “Build from plan” to aggregate the week's ingredients."}
          </p>
        </div>
      ) : (
        <div className="rounded-none border-2 border-neutral-900 bg-white shadow-[4px_4px_0_#111]">
          <div className="border-b-2 border-neutral-900 bg-yellow-300 px-4 py-2 text-sm font-extrabold uppercase tracking-wide">
            {unchecked} to buy · {items.length - unchecked} in the basket
          </div>
          <ul className="divide-y-2 divide-dashed divide-neutral-200">
            {items.map((item, index) => (
              <li key={`${item.name}-${index}`} className={`flex items-center justify-between gap-3 px-4 py-3 ${item.checked ? "opacity-40" : ""}`}>
                <span className={`text-sm font-medium ${item.checked ? "line-through" : ""}`}>
                  {item.checked ? "🧺 " : "🛒 "}
                  {item.name}
                </span>
                <div className="flex items-center gap-3">
                  <span className="rounded-none border-2 border-neutral-900 bg-yellow-200 px-2 py-0.5 text-xs font-extrabold">
                    {item.display}
                  </span>
                  <form action={toggleShoppingItemAction}>
                    <input type="hidden" name="weekStart" value={weekStart} />
                    <input type="hidden" name="index" value={index} />
                    <button className={`rounded-none border-2 border-neutral-900 px-2 py-1 text-[10px] font-extrabold uppercase shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none ${
                      item.checked ? "bg-white" : "bg-lime-300"
                    }`}>
                      {item.checked ? "Unbuy" : "Got it"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
