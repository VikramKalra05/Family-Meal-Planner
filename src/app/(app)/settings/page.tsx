import Link from "next/link";
import { ageFromDob } from "@/lib/age";
import { deleteAiProvider, setDefaultAiProvider } from "./actions";
import { AddProviderForm } from "./provider-form";
import { TestSavedButton } from "./test-saved-button";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export const instant = false;

interface ProviderRow {
  id: string;
  label: string;
  base_url: string;
  model: string;
  is_default: boolean;
  created_at: string;
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary (desk job)",
  light: "Lightly active",
  moderate: "Moderately active",
  active: "Active",
  very_active: "Very active",
};

const GOAL_LABELS: Record<string, string> = {
  weight_loss: "Weight loss",
  maintenance: "Maintain weight",
  muscle_gain: "Muscle gain",
};

export default async function SettingsPage() {
  const profile = await requireFullProfile();
  const supabase = await createClient();
  const { data: providers } = await supabase
    .from("ai_providers")
    .select("id, label, base_url, model, is_default, created_at")
    .order("is_default", { ascending: false })
    .order("created_at");
  const rows = (providers ?? []) as ProviderRow[];

  return (
    <div className="space-y-5 mx-auto max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-neutral-500">Account, household and AI providers.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-none bg-white p-5 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
          <div className="flex items-start justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Profile</h2>
            <Link
              href="/settings/profile"
              className="rounded-none border-2 border-neutral-900 px-3 py-1 text-xs font-medium hover:bg-amber-50"
            >
              Edit
            </Link>
          </div>
          <p className="mt-2 text-base font-medium text-neutral-900">{profile.display_name}</p>
          <p className="text-xs text-neutral-400">
            {profile.role === "owner" ? "Household owner" : profile.role === "staff" ? "Kitchen staff" : "Family member"}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {[
              ["Age", profile.date_of_birth ? `${ageFromDob(profile.date_of_birth)} yrs` : null],
              ["Sex", profile.sex],
              ["Height", profile.height_cm ? `${Number(profile.height_cm)} cm` : null],
              ["Weight", profile.weight_kg ? `${Number(profile.weight_kg)} kg` : null],
              ["Activity", ACTIVITY_LABELS[profile.activity_level ?? ""] ?? null],
              ["Goal", GOAL_LABELS[profile.goal ?? ""] ?? null],
              ["Diet", profile.diet_type === "non_veg" ? "Non-vegetarian" : profile.diet_type === "egg" ? "Eggetarian" : "Vegetarian"],
              ["Daily budget", profile.budget_daily != null && Number(profile.budget_daily) > 0 ? `₹${Number(profile.budget_daily)}` : null],
              ["Target weight", profile.target_weight_kg != null ? `${Number(profile.target_weight_kg)} kg` : null],
              ["Weigh-in reminder", profile.weigh_in_time ?? null],
            ].map(([k, v]) =>
              v ? (
                <div key={k as string}>
                  <dt className="text-neutral-400">{k}</dt>
                  <dd className="font-medium capitalize text-neutral-700">{String(v).replace("_", " ")}</dd>
                </div>
              ) : null,
            )}
          </dl>
          {profile.allergies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.allergies.map((a) => (
                <span key={a} className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                  allergic to {a}
                </span>
              ))}
            </div>
          )}
          <form action={signOut} className="mt-4 border-t-2 border-neutral-900 pt-3">
            <button className="text-xs font-medium text-red-600 hover:text-red-700">Sign out</button>
          </form>
        </div>

        <div className="rounded-none bg-white p-5 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
          <div className="flex items-start justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Your daily targets</h2>
            {profile.targets_cache?.breakdown && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                engine v{profile.targets_version}
              </span>
            )}
          </div>
          {profile.targets_cache ? (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <p className="text-3xl font-bold text-neutral-900">{profile.targets_cache.targets.kcal}</p>
                <p className="text-sm text-neutral-500">kcal / day</p>
                <span className="ml-auto rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium capitalize text-neutral-600">
                  {GOAL_LABELS[profile.goal ?? ""] ?? ""}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  ["Protein", `${profile.targets_cache.targets.proteinG} g`, "text-emerald-600"],
                  ["Carbs", `${profile.targets_cache.targets.carbsG} g`, "text-amber-600"],
                  ["Fat", `${profile.targets_cache.targets.fatG} g`, "text-red-600"],
                  ["Fiber", `${profile.targets_cache.targets.fiberG} g`, "text-violet-600"],
                ].map(([l, v, c]) => (
                  <div key={l} className="rounded-none bg-amber-50 p-2.5 text-center">
                    <p className="text-[10px] text-neutral-400">{l}</p>
                    <p className={`text-sm font-bold ${c}`}>{v}</p>
                  </div>
                ))}
              </div>
              {profile.targets_cache.breakdown && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t-2 border-neutral-900 pt-3 text-[11px]">
                  {[
                    ["BMR (Mifflin-St Jeor)", `${profile.targets_cache.breakdown.bmr} kcal`],
                    ["TDEE", `${profile.targets_cache.breakdown.tdee} kcal`],
                    ["Goal adjustment", `${profile.targets_cache.breakdown.goalAdjustmentPct > 0 ? "+" : ""}${Math.round(profile.targets_cache.breakdown.goalAdjustmentPct * 100)}%`],
                    ["Protein target", `${profile.targets_cache.breakdown.proteinGPerKg} g/kg`],
                    ...(profile.targets_cache.breakdown.calorieFloorApplied
                      ? [["Safety floor", "1200/1500 kcal applied"]]
                      : []),
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between gap-2">
                      <dt className="text-neutral-400">{k}</dt>
                      <dd className="font-medium text-neutral-600">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-3 text-[11px] text-neutral-400">
                Changing weight or goal?{" "}
                <Link href="/settings/profile" className="font-medium text-emerald-700 hover:underline">
                  Edit profile
                </Link>{" "}
                — targets recalculate instantly.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-neutral-400">No targets yet — complete your profile.</p>
          )}
        </div>
      </section>

      <section className="rounded-none bg-white border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
        <header className="border-b-2 border-neutral-900 bg-yellow-300 px-6 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">AI providers</h2>
          <p className="text-xs text-neutral-500">
            Bring your own key — any OpenAI-compatible endpoint. Powers reel→recipe drafts and nutrition estimation.
          </p>
        </header>
        <div className="divide-y divide-neutral-100">
          {rows.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {p.label}
                  {p.is_default && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Default
                    </span>
                  )}
                </p>
                <p className="truncate font-mono text-[11px] text-neutral-400">
                  {p.model} · {p.base_url}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <TestSavedButton id={p.id} />
                {!p.is_default && (
                  <form action={setDefaultAiProvider}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="rounded-none border-2 border-neutral-900 px-3 py-1.5 text-xs font-medium hover:bg-amber-50">
                      Make default
                    </button>
                  </form>
                )}
                <form action={deleteAiProvider}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="rounded-none px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                    Remove
                  </button>
                </form>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="px-6 py-4 text-xs text-neutral-400">
              No providers yet — add one below to unlock the AI features.
            </p>
          )}
        </div>
        <div className="border-t-2 border-neutral-900 p-6">
          <AddProviderForm />
        </div>
      </section>
    </div>
  );
}
