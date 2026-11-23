import Link from "next/link";
import { requireFullProfile } from "@/lib/profile";
import { getActiveProgram, getGym } from "@/lib/gym/data";
import { SetupForm } from "./setup-form";

export const instant = false;

export default async function GymSetupPage() {
  const profile = await requireFullProfile();
  const [gym, program] = await Promise.all([getGym(profile.id), getActiveProgram(profile.id)]);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/gym" className="text-xs font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900">
          ← Gym
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Set up your gym</h1>
        <p className="text-sm text-neutral-500">
          Tick what your gym actually has. The program only uses exercises you can do, and the plate
          calculator learns your unlabelled plates.
        </p>
      </div>

      {gym && (
        <div className="rounded-none border-2 border-neutral-900 bg-amber-100 p-3 text-xs shadow-[2px_2px_0_#111]">
          Saving again replaces the active program. Logged sessions and personal records are kept.
        </div>
      )}

      <SetupForm
        initial={{
          unit: gym?.unit ?? "kg",
          barWeight: Number(gym?.bar_weight ?? (gym?.unit === "lb" ? 45 : 20)),
          equipmentIds: gym?.equipment_ids ?? [],
          trainingDays: gym?.training_days ?? [0, 2, 4],
          plates: gym?.plate_inventory ?? [],
          machineStacks: gym?.machine_stacks ?? [],
          templateId: program?.template ?? "full_body_3",
        }}
      />
    </div>
  );
}
