import Link from "next/link";
import { redirect } from "next/navigation";
import { EvalRun } from "./eval-run";
import { requireFullProfile } from "@/lib/profile";

export const instant = false;

export default async function EvalPage() {
  const profile = await requireFullProfile();
  if (profile.role !== "owner") redirect("/");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/settings" className="text-xs font-medium text-neutral-400 hover:text-neutral-900">
          ← Settings
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Evaluation</h1>
        <p className="text-sm text-neutral-500">
          Report-grade experiments over the deterministic engine — no LLM needed for these two.
        </p>
      </div>

      <section className="rounded-none border-2 border-neutral-900 bg-white p-6 shadow-[4px_4px_0_#111]">
        <h2 className="text-sm font-extrabold uppercase tracking-widest">E1 · plan adherence</h2>
        <p className="mb-4 mt-1 text-xs text-neutral-500">
          Generates weeks with the engine and measures how far each planned dish lands from the eater&apos;s
          kcal target for that slot (breakfast 25% · lunch 35% · snack 10% · dinner 30%).
        </p>
        <h2 className="text-sm font-extrabold uppercase tracking-widest">E4 · constraint compliance</h2>
        <p className="mb-4 mt-1 text-xs text-neutral-500">
          Counts diet-rule and allergen-safety violations across every generated entry. The deterministic
          filters make the expected value exactly 0 — the experiment proves it.
        </p>
        <EvalRun />
      </section>

      <p className="text-xs text-neutral-400">
        E2 (AI estimation error vs verified values) and E3 (craving re-optimization impact) run from
        logged data as it accumulates — planned for the report writing phase.
      </p>
    </div>
  );
}
