"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { calculateTargets } from "@/lib/nutrition/engine";
import {
  ACTIVITY_LEVELS,
  DIET_TYPES,
  GOALS,
  SEXES,
} from "@/lib/nutrition/types";
import { createClient } from "@/lib/supabase/server";
import { checkRate, rateLimited } from "@/lib/rate-limit";

export type ActionState = { error: string | null };

const profileFormSchema = z.object({
  displayName: z.string().min(1, "Name is required").max(60),
  sex: z.enum(SEXES),
  dateOfBirth: z
    .string()
    .refine((d) => !Number.isNaN(Date.parse(d)), "Invalid date of birth")
    .refine((d) => {
      const age = (Date.now() - Date.parse(d)) / (365.25 * 24 * 3600 * 1000);
      return age >= 10 && age <= 100;
    }, "Age must be between 10 and 100"),
  heightCm: z.coerce.number().min(100, "Height looks wrong").max(230, "Height looks wrong"),
  weightKg: z.coerce.number().min(30, "Weight looks wrong").max(250, "Weight looks wrong"),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  goal: z.enum(GOALS),
  dietType: z.enum(DIET_TYPES),
  allergiesRaw: z.string().optional(),
  budgetDaily: z.coerce.number().min(0).max(100000).optional(),
  targetWeightKg: z.coerce.number().min(25).max(250).optional(),
  weighInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM").optional(),
});

function ageFromDob(dob: string): number {
  return Math.floor((Date.now() - Date.parse(dob)) / (365.25 * 24 * 3600 * 1000));
}

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const parsed = profileFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;

  const { targets, breakdown } = calculateTargets({
    sex: v.sex,
    age: ageFromDob(v.dateOfBirth),
    heightCm: v.heightCm,
    weightKg: v.weightKg,
    activityLevel: v.activityLevel,
    goal: v.goal,
  });

  const allergies = (v.allergiesRaw ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  // Keep the engine-version stamp monotonic so Settings can tell users when
  // targets changed; the previous code reset it to 1 on every edit.
  const { data: current } = await supabase
    .from("profiles")
    .select("targets_version")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: v.displayName,
    sex: v.sex,
    date_of_birth: v.dateOfBirth,
    height_cm: v.heightCm,
    weight_kg: v.weightKg,
    activity_level: v.activityLevel,
    goal: v.goal,
    diet_type: v.dietType,
    allergies,
    budget_daily: v.budgetDaily ?? null,
    target_weight_kg: v.targetWeightKg ?? null,
    weigh_in_time: v.weighInTime ?? null,
    targets_cache: { targets, breakdown },
    targets_version: (current?.targets_version ?? 0) + 1,
  });

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { error: null };
}

const householdNameSchema = z.string().min(2, "Household name is too short").max(60);

export async function createHousehold(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const name = householdNameSchema.safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0]?.message ?? "Invalid name" };

  const { data: household, error: insertErr } = await supabase
    .from("households")
    .insert({ name: name.data, created_by: user.id })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ household_id: household.id, role: "owner" })
    .eq("id", user.id);
  if (updateErr) return { error: updateErr.message };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function joinHousehold(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  // Invite codes are capability tokens — meter guesses per user.
  if (!checkRate(`join:${user.id}`, 10, 60 * 60 * 1000)) {
    return { error: rateLimited(10, 60 * 60 * 1000) };
  }

  const code = z
    .string()
    .trim()
    .min(6, "Enter a valid invite code")
    .max(12, "Enter a valid invite code")
    .safeParse(formData.get("code"));
  if (!code.success) return { error: code.error.issues[0]?.message ?? "Enter a valid invite code" };

  // RLS blocks direct lookup of households you don't belong to; the
  // security-definer RPC resolves a valid code to exactly one id.
  const { data: householdId, error: rpcErr } = await supabase.rpc(
    "household_id_for_invite_code",
    { code: code.data },
  );
  if (rpcErr) return { error: rpcErr.message };
  if (!householdId) return { error: "No household found for that code" };

  const { error } = await supabase
    .from("profiles")
    .update({ household_id: householdId, role: "member" })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/");
}
