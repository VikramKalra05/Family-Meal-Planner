"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { calculateTargets } from "@/lib/nutrition/engine";
import { ageFromDob } from "@/lib/age";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { istDateISO } from "@/lib/date";

export type WeightActionState = { error: string | null; ok: string | null };

const logSchema = z.object({
  weightKg: z.coerce.number().min(25, "That looks too low").max(250, "That looks too high"),
});

/**
 * Logs today's weigh-in (upserts the day), syncs the profile's current
 * weight, and recalculates targets — so TDEE/macros follow the user as they
 * progress toward their target weight.
 */
export async function logWeight(_prev: WeightActionState, formData: FormData): Promise<WeightActionState> {
  const profile = await requireFullProfile();
  const parsed = logSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid weight", ok: null };
  const kg = Math.round(parsed.data.weightKg * 10) / 10;

  const supabase = await createClient();
  const today = istDateISO();

  const { error: logErr } = await supabase.from("weight_logs").upsert(
    { member_id: profile.id, logged_on: today, weight_kg: kg, source: "manual" },
    { onConflict: "member_id,logged_on" },
  );
  if (logErr) return { error: logErr.message, ok: null };

  // Sync profile weight + recalculate targets when the weight moved.
  if (Number(profile.weight_kg) !== kg) {
    const { targets, breakdown } = calculateTargets({
      sex: profile.sex!,
      age: profile.date_of_birth ? ageFromDob(profile.date_of_birth) : 30,
      heightCm: Number(profile.height_cm ?? 170),
      weightKg: kg,
      activityLevel: profile.activity_level ?? "moderate",
      goal: profile.goal ?? "maintenance",
    });
    const { error: profErr } = await supabase
      .from("profiles")
      .update({
        weight_kg: kg,
        targets_cache: { targets, breakdown },
        targets_version: profile.targets_version + 1,
      })
      .eq("id", profile.id);
    if (profErr) return { error: profErr.message, ok: null };
  }

  revalidatePath("/progress");
  revalidatePath("/");
  return { error: null, ok: `Logged ${kg} kg for today` };
}

export async function setTargetWeight(
  _prev: WeightActionState,
  formData: FormData,
): Promise<WeightActionState> {
  const profile = await requireFullProfile();
  const parsed = z
    .object({ targetKg: z.coerce.number().min(25).max(250).optional(), weighInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input", ok: null };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      ...(parsed.data.targetKg != null ? { target_weight_kg: parsed.data.targetKg } : {}),
      ...(parsed.data.weighInTime ? { weigh_in_time: parsed.data.weighInTime } : {}),
    })
    .eq("id", profile.id);
  if (error) return { error: error.message, ok: null };

  revalidatePath("/progress");
  revalidatePath("/");
  return { error: null, ok: "Goal saved" };
}

/** For the reminder component: has today's weigh-in been logged? */
export async function hasLoggedToday(): Promise<boolean> {
  const profile = await requireFullProfile();
  const supabase = await createClient();
  const today = istDateISO();
  const { data } = await supabase
    .from("weight_logs")
    .select("id")
    .eq("member_id", profile.id)
    .eq("logged_on", today)
    .maybeSingle();
  return !!data;
}
