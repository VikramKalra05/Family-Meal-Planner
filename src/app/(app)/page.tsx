import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireFullProfile } from "@/lib/profile";
import { QuickLogForm } from "./progress/weight-forms";
import { AiLogForm, CravingForm } from "./today-forms";
import { setEntryStatusAction } from "./week/actions";
import { mondayOf } from "@/lib/planner";
import { formatIstDate, istDateISO } from "@/lib/date";
import { WeighInReminder } from "@/components/weigh-in-reminder";
import { SubmitButton } from "@/components/submit-button";

export const instant = false;

const SLOT_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Evening snack",
  dinner: "Dinner · family",
};
const SLOT_ORDER = ["breakfast", "lunch", "snack", "dinner"];

export default async function TodayPage() {
  const profile = await requireFullProfile();
  const supabase = await createClient();
  const today = istDateISO();

  const [householdRes, todayLogRes, latestLogRes, logsRes] = await Promise.all([
    supabase.from("households").select("*").eq("id", profile.household_id!).single(),
    supabase.from("weight_logs").select("weight_kg").eq("member_id", profile.id).eq("logged_on", today).maybeSingle(),
    supabase.from("weight_logs").select("weight_kg, logged_on").order("logged_on", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("intake_logs").select("slot, kcal, protein_g, description, source").eq("member_id", profile.id).eq("logged_on", today),
  ]);
  const household = householdRes.data;
  const weighIn = { loggedToday: !!todayLogRes.data, latestKg: latestLogRes.data ? Number(latestLogRes.data.weight_kg) : null };

  const targets = profile.targets_cache?.targets;

  // This week's plan entries for today: mine + shared
  const { data: plan } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("household_id", profile.household_id!)
    .eq("week_start", mondayOf(today))
    .maybeSingle();
  const { data: entries } = plan
    ? await supabase
        .from("plan_entries")
        .select("id, slot, recipe_id, member_id, status, servings_base, member_portions, recipes(title), recipe_nutrition(kcal)")
        .eq("plan_id", plan.id)
        .eq("entry_date", today)
    : { data: null };
  const myEntries = (entries ?? []).filter(
    (e: { member_id: string | null }) => e.member_id === profile.id || e.member_id === null,
  );

  // Named recipe nutrition comes through the embed
  const myEntriesTyped = (myEntries ?? []).map((e: unknown) => {
    const row = e as {
      id: string; slot: string; status: string; member_id: string | null; recipe_id: string;
      servings_base: number; member_portions: Record<string, number> | null;
      recipes: { title: string } | { title: string }[] | null;
      recipe_nutrition: { kcal: number } | { kcal: number }[] | null;
    };
    const title = Array.isArray(row.recipes) ? row.recipes[0]?.title : row.recipes?.title;
    const kcalRow = Array.isArray(row.recipe_nutrition) ? row.recipe_nutrition[0] : row.recipe_nutrition;
    const portion =
      row.member_portions?.[profile.id] ?? (row.member_id ? Number(row.servings_base) : 1) ?? 1;
    return {
      id: row.id, slot: row.slot, status: row.status, title: title ?? "Recipe",
      recipeId: row.recipe_id,
      kcal: kcalRow ? Math.round(Number(kcalRow.kcal) * portion) : null,
    };
  });

  const consumed = (logsRes.data ?? []).reduce((s, l) => s + Number(l.kcal), 0);
  const consumedProtein = (logsRes.data ?? []).reduce((s, l) => s + Number(l.protein_g), 0);
  const pct = targets ? Math.min(100, Math.round((consumed / targets.kcal) * 100)) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <WeighInReminder weighInTime={profile.weigh_in_time} />
      <section className="rounded-none border-2 border-neutral-900 bg-white p-6 shadow-[4px_4px_0_#111]">
        <h1 className="text-lg font-extrabold uppercase tracking-tight">
          Namaste, {profile.display_name} 👋
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {formatIstDate(new Date())}
        </p>
      </section>

      <WeighInSection loggedToday={weighIn.loggedToday} time={profile.weigh_in_time} latest={weighIn.latestKg} />

      <section className="rounded-none border-2 border-neutral-900 bg-white p-6 shadow-[4px_4px_0_#111]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">
            Your daily targets
          </h2>
          <Link href="/progress" className="text-[10px] font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900">
            engine v{profile.targets_version} →
          </Link>
        </div>
        {targets ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex items-center gap-4">
              <TargetRing kcal={targets.kcal} />
              <div className="text-sm text-neutral-600">
                <p className="font-extrabold uppercase tracking-wide text-neutral-900">{targets.kcal} kcal / day</p>
                <p className="mt-1 text-xs">
                  {profile.goal === "weight_loss"
                    ? "Weight loss plan"
                    : profile.goal === "muscle_gain"
                      ? "Muscle gain plan"
                      : "Maintenance plan"}
                </p>
                {profile.budget_daily != null && profile.budget_daily > 0 && (
                  <p className="mt-1 text-xs">Budget: ₹{profile.budget_daily}/day</p>
                )}
                {profile.target_weight_kg != null && (
                  <p className="mt-1 text-xs">Target weight: {Number(profile.target_weight_kg)} kg</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Protein", grams: targets.proteinG, cls: "bg-lime-200" },
                { label: "Carbs", grams: targets.carbsG, cls: "bg-amber-200" },
                { label: "Fat", grams: targets.fatG, cls: "bg-red-200" },
                { label: "Fiber", grams: targets.fiberG, cls: "bg-violet-200" },
              ].map((m) => (
                <div key={m.label} className={`border-2 border-neutral-900 p-2.5 shadow-[3px_3px_0_#111] ${m.cls}`}>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-700">{m.label}</p>
                  <p className="text-lg font-extrabold text-neutral-900">{m.grams} g</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Complete your profile to calculate targets.</p>
        )}
        {targets && (
          <div className="mt-5 border-t-2 border-neutral-900 pt-4">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="uppercase tracking-wide text-neutral-500">Eaten today: {Math.round(consumed)} kcal ({consumedProtein}g protein)</span>
              <span className="text-neutral-500">{pct}%</span>
            </div>
            <div className="mt-1.5 h-4 w-full border-2 border-neutral-900 bg-white">
              <div className="h-full bg-lime-400" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">
            Today&apos;s plan
          </h2>
          <Link href="/week" className="text-[10px] font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900">
            full week →
          </Link>
        </div>
        {SLOT_ORDER.map((slot) => {
          const entry = myEntriesTyped.find((e) => e.slot === slot);
          return (
            <div key={slot} className="flex items-center justify-between gap-3 rounded-none border-2 border-neutral-900 bg-white p-4 shadow-[3px_3px_0_#111]">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
                  {SLOT_LABEL[slot]}
                  {slot === "dinner" ? " · shared" : ""}
                </p>
                {entry ? (
                  <p className="truncate text-sm font-bold">
                    <Link href={`/recipes/${entry.recipeId}`} className="hover:underline">
                      {entry.title}
                    </Link>{" "}
                    {entry.kcal != null && <span className="font-medium text-neutral-500">· {Math.round(entry.kcal)} kcal</span>}
                  </p>
                ) : (
                  <p className="text-xs text-neutral-400">
                    Not planned — <Link href="/week" className="underline">generate or swap in the week planner</Link>
                  </p>
                )}
              </div>
              {entry && entry.status !== "eaten" ? (
                <form action={setEntryStatusAction} className="shrink-0">
                  <input type="hidden" name="entryId" value={entry.id} />
                  <input type="hidden" name="status" value="eaten" />
                  <SubmitButton
                    pendingText="…"
                    className="rounded-none border-2 border-neutral-900 bg-lime-300 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-60"
                  >
                    ✓ Ate it
                  </SubmitButton>
                </form>
              ) : entry ? (
                <span className="shrink-0 rounded-full border-2 border-neutral-900 bg-lime-300 px-2.5 py-1 text-[10px] font-extrabold uppercase">
                  eaten
                </span>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-widest text-neutral-500">Craving check</h2>
          <CravingForm />
        </div>
        <div className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-widest text-neutral-500">AI meal log</h2>
          <AiLogForm />
        </div>
      </section>

      {household && (
        <section className="rounded-none border-2 border-dashed border-neutral-900 bg-white p-4">
          <p className="text-sm">
            <span className="font-bold">{household.name}</span> · invite code{" "}
            <code className="border-2 border-neutral-900 bg-yellow-200 px-1.5 py-0.5 font-mono font-bold">
              {household.invite_code}
            </code>
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Share this code so family members can join your household.
          </p>
        </section>
      )}
    </div>
  );
}

function WeighInSection({
  loggedToday,
  time,
  latest,
}: {
  loggedToday: boolean;
  time: string | null;
  latest: number | null;
}) {
  return (
    <section className="rounded-none border-2 border-neutral-900 bg-lime-200 p-5 shadow-[4px_4px_0_#111]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-neutral-900">
            ⚖️ Weigh-in{" "}
            {loggedToday ? (
              <span className="border-2 border-neutral-900 bg-lime-400 px-2 py-0.5 text-[10px]">done today ✓</span>
            ) : time ? (
              <span className="border-2 border-neutral-900 bg-white px-2 py-0.5 text-[10px]">reminder {time}</span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-700">
            {loggedToday
              ? latest != null
                ? `Today: ${latest} kg — every log keeps your targets accurate.`
                : "Logged."
              : latest != null
                ? `Last logged ${latest} kg. Step on the scale and keep the streak.`
                : "First weigh-in? Log it — the tracker and targets build from here."}
          </p>
        </div>
        {!loggedToday && <QuickLogForm compact />}
        {loggedToday && (
          <Link
            href="/progress"
            className="rounded-none border-2 border-neutral-900 bg-white px-3.5 py-2 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            View progress →
          </Link>
        )}
      </div>
    </section>
  );
}

function TargetRing({ kcal }: { kcal: number }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e5e5e5" strokeWidth="10" />
      <circle
        cx="70" cy="70" r={r} fill="none" stroke="#171717" strokeWidth="10"
        strokeLinecap="butt" strokeDasharray={`${c * 0.25} ${c}`} transform="rotate(-90 70 70)"
      />
      <text x="70" y="66" textAnchor="middle" className="fill-neutral-900 text-xl font-extrabold">
        {kcal}
      </text>
      <text x="70" y="88" textAnchor="middle" className="fill-neutral-400 text-xs font-bold uppercase">
        kcal target
      </text>
    </svg>
  );
}
