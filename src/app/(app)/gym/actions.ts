"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { istDateISO } from "@/lib/date";
import { GYM_EQUIPMENT } from "@/data/gym-equipment";
import { buildProgram, templateById, type ProgramTemplate } from "@/lib/gym/program";
import { calorieFloorFor } from "@/lib/gym/fuel";
import { mergeMeasurement, type MeasurementFields } from "@/lib/gym/measurements";
import { pickSessionForDate } from "@/lib/gym/sessions";
import { KG_BARS, LB_BARS, type PlateDenom, type WeightUnit, clamp } from "@/lib/gym/types";

export type GymActionState = { error: string | null; ok: string | null };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

function parseJson<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const equipmentIds = new Set(GYM_EQUIPMENT.map((e) => e.id));

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type SessionRow = {
  id: string;
  session_date: string;
  status: "in_progress" | "completed" | "skipped";
  created_at: string;
  program_day_id: string | null;
};

/** Deterministic UUIDv5 so two tabs cannot create two sessions for one day. */
function sessionIdFor(memberId: string, date: string): string {
  const hash = createHash("sha1").update(`fmp-gym:${memberId}:${date}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Builds a program and all its days/exercises as INACTIVE. The current
 * program is untouched until `activateProgram` succeeds, so a failed insert
 * can never leave the member with no program.
 */
async function createInactiveProgram(
  supabase: ServerClient,
  profileId: string,
  template: ProgramTemplate,
  ids: string[],
): Promise<{ id: string } | { error: string }> {
  const built = buildProgram(template, ids);
  const { data: program, error } = await supabase
    .from("programs")
    .insert({
      member_id: profileId,
      name: built.name,
      template: built.templateId,
      days_per_week: built.days.length,
      is_active: false,
    })
    .select("id")
    .single();
  if (error || !program) return { error: error?.message ?? "Could not create program" };

  const cleanup = async () => {
    // Cascades program_days + program_exercises.
    await supabase.from("programs").delete().eq("id", program.id).eq("member_id", profileId);
  };

  for (const [index, day] of built.days.entries()) {
    const { data: programDay, error: dayError } = await supabase
      .from("program_days")
      .insert({ program_id: program.id, day_index: index, name: day.name, focus: day.focus })
      .select("id")
      .single();
    if (dayError || !programDay) {
      await cleanup();
      return { error: dayError?.message ?? "Could not create day" };
    }

    if (day.exercises.length > 0) {
      const { error: exercisesError } = await supabase.from("program_exercises").insert(
        day.exercises.map((e, position) => ({
          program_day_id: programDay.id,
          exercise_key: e.exerciseKey,
          position,
          target_sets: e.sets,
          rep_min: e.repMin,
          rep_max: e.repMax,
          increment_kg: e.incrementKg,
        })),
      );
      if (exercisesError) {
        await cleanup();
        return { error: exercisesError.message };
      }
    }
  }

  return { id: program.id };
}

/** Swaps the active program. Reactivates the old one if activation fails. */
async function activateProgram(
  supabase: ServerClient,
  profileId: string,
  newProgramId: string,
): Promise<string | null> {
  const { data: current, error: readError } = await supabase
    .from("programs")
    .select("id")
    .eq("member_id", profileId)
    .eq("is_active", true)
    .maybeSingle();
  if (readError) return readError.message;
  if (current?.id === newProgramId) return null;

  if (current) {
    const { error: deactivateError } = await supabase
      .from("programs")
      .update({ is_active: false })
      .eq("id", current.id);
    if (deactivateError) return deactivateError.message;
  }

  const { error: activateError } = await supabase
    .from("programs")
    .update({ is_active: true })
    .eq("id", newProgramId);
  if (activateError) {
    if (current) {
      await supabase.from("programs").update({ is_active: true }).eq("id", current.id);
    }
    await supabase.from("programs").delete().eq("id", newProgramId).eq("member_id", profileId);
    return activateError.message;
  }
  return null;
}

// ── Setup ───────────────────────────────────────────────────────────────────
const setupSchema = z.object({
  unit: z.enum(["kg", "lb"]),
  barWeight: z.coerce.number().min(0).max(100),
  templateId: z.string().min(1),
});

export async function saveGymSetup(
  _prev: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const profile = await requireFullProfile();
  const parsed = setupSchema.safeParse({
    unit: formData.get("unit"),
    barWeight: formData.get("barWeight"),
    templateId: formData.get("templateId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid setup", ok: null };

  const rawEquipment = parseJson<string[]>(formData.get("equipmentIds"), []);
  const ids = rawEquipment.filter((id) => equipmentIds.has(id));
  const rawDays = parseJson<number[]>(formData.get("trainingDays"), []);
  const days = [...new Set(rawDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  );
  if (days.length === 0) return { error: "Pick at least one training day", ok: null };

  const rawPlates = parseJson<PlateDenom[]>(formData.get("plates"), []);
  const plates = rawPlates
    .slice(0, 40)
    .filter((p) => p && typeof p.id === "string" && Number.isFinite(Number(p.weight)))
    .map((p) => ({
      id: String(p.id),
      label: String(p.label ?? p.weight),
      weight: Math.max(0, Number(p.weight)),
      count: clamp(Math.round(Number(p.count) || 0), 0, 40),
      color: typeof p.color === "string" ? p.color : undefined,
    }));

  const template = templateById(parsed.data.templateId);
  if (!template) return { error: "Unknown program template", ok: null };

  const supabase = await createClient();
  const unit = parsed.data.unit as WeightUnit;
  const bars = unit === "lb" ? LB_BARS : KG_BARS;

  const { error: gymError } = await supabase.from("gyms").upsert(
    {
      member_id: profile.id,
      unit,
      bar_weight: parsed.data.barWeight,
      plate_inventory: plates,
      bars,
      equipment_ids: ids,
      training_days: days,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" },
  );
  if (gymError) return { error: gymError.message, ok: null };

  // Build the replacement as inactive, then swap atomically. A failed build
  // leaves the current program active instead of stranding the member.
  const created = await createInactiveProgram(supabase, profile.id, template, ids);
  if ("error" in created) return { error: created.error, ok: null };
  const activationError = await activateProgram(supabase, profile.id, created.id);
  if (activationError) return { error: activationError, ok: null };

  revalidatePath("/gym");
  revalidatePath("/gym/setup");
  revalidatePath("/gym/plan");
  revalidatePath("/");
  revalidatePath("/week");
  return { error: null, ok: "Gym saved — your program is ready." };
}

/** Rebuild the active program after changing equipment, keeping the template. */
export async function rebuildProgram(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const templateId = z.string().safeParse(formData.get("templateId"));
  if (!templateId.success) return;
  const supabase = await createClient();
  const { data: gym } = await supabase
    .from("gyms")
    .select("equipment_ids")
    .eq("member_id", profile.id)
    .maybeSingle();
  const template = templateById(templateId.data);
  if (!template) return;

  const created = await createInactiveProgram(supabase, profile.id, template, gym?.equipment_ids ?? []);
  if ("error" in created) return;
  const activationError = await activateProgram(supabase, profile.id, created.id);
  if (activationError) return;

  revalidatePath("/gym");
  revalidatePath("/gym/plan");
  revalidatePath("/gym/history");
  revalidatePath("/");
  revalidatePath("/week");
}

// ── Sessions ────────────────────────────────────────────────────────────────
export async function startSession(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const programDayId = z.string().uuid().safeParse(formData.get("programDayId"));
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(formData.get("date"));
  const today = date.success ? date.data : istDateISO();
  const supabase = await createClient();

  // Only a day from the user's own active program may be attached.
  let ownProgramDayId: string | null = null;
  if (programDayId.success) {
    const { data: ownProgram } = await supabase
      .from("programs")
      .select("id")
      .eq("member_id", profile.id)
      .eq("is_active", true)
      .maybeSingle();
    if (ownProgram) {
      const { data: day } = await supabase
        .from("program_days")
        .select("id")
        .eq("id", programDayId.data)
        .eq("program_id", ownProgram.id)
        .maybeSingle();
      ownProgramDayId = day?.id ?? null;
    }
  }

  if (programDayId.success && !ownProgramDayId) {
    // The form came from an archived program; don't start an empty session.
    revalidatePath("/gym");
    return;
  }

  const { data: existingRows } = await supabase
    .from("workout_sessions")
    .select("id, session_date, status, created_at, program_day_id")
    .eq("member_id", profile.id)
    .eq("session_date", today);
  const existing = pickSessionForDate((existingRows ?? []) as SessionRow[], today);
  if (existing) {
    if (existing.status === "skipped") {
      await supabase
        .from("workout_sessions")
        .update({
          status: "in_progress",
          ended_at: null,
          program_day_id: ownProgramDayId ?? existing.program_day_id,
          client_updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("member_id", profile.id);
    }
    redirect(`/gym/workout/${existing.id}`);
  }

  const { data: session, error } = await supabase
    .from("workout_sessions")
    .insert({
      id: sessionIdFor(profile.id, today),
      member_id: profile.id,
      program_day_id: ownProgramDayId,
      session_date: today,
      status: "in_progress",
    })
    .select("id")
    .single();
  if (error || !session) {
    revalidatePath("/gym");
    // A concurrent tab may have won the deterministic id.
    const { data: racedRows } = await supabase
      .from("workout_sessions")
      .select("id, session_date, status, created_at, program_day_id")
      .eq("member_id", profile.id)
      .eq("session_date", today);
    const raced = pickSessionForDate((racedRows ?? []) as SessionRow[], today);
    if (raced) redirect(`/gym/workout/${raced.id}`);
    return;
  }
  revalidatePath("/gym");
  redirect(`/gym/workout/${session.id}`);
}

/**
 * One-tap "gym done" for a day. The member does not need to open the workout
 * or log every exercise: this completes today's open/skipped session or
 * creates a completed one. Only completed days count toward the streak.
 */
export async function markTodayDone(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(formData.get("date"));
  const today = istDateISO();
  const sessionDate = date.success ? date.data : today;
  if (sessionDate > today) return;

  const programDayId = z.string().uuid().safeParse(formData.get("programDayId"));
  const supabase = await createClient();

  // Only attach a day from the member's own active program.
  let ownProgramDayId: string | null = null;
  if (programDayId.success) {
    const { data: ownProgram } = await supabase
      .from("programs")
      .select("id")
      .eq("member_id", profile.id)
      .eq("is_active", true)
      .maybeSingle();
    if (ownProgram) {
      const { data: day } = await supabase
        .from("program_days")
        .select("id")
        .eq("id", programDayId.data)
        .eq("program_id", ownProgram.id)
        .maybeSingle();
      ownProgramDayId = day?.id ?? null;
    }
  }

  const { data: rows } = await supabase
    .from("workout_sessions")
    .select("id, session_date, status, created_at, program_day_id")
    .eq("member_id", profile.id)
    .eq("session_date", sessionDate);
  const existing = pickSessionForDate((rows ?? []) as SessionRow[], sessionDate);
  const now = new Date().toISOString();

  if (existing) {
    if (existing.status !== "completed") {
      await supabase
        .from("workout_sessions")
        .update({
          status: "completed",
          ended_at: now,
          client_updated_at: now,
          ...(existing.program_day_id == null && ownProgramDayId
            ? { program_day_id: ownProgramDayId }
            : {}),
        })
        .eq("id", existing.id)
        .eq("member_id", profile.id);
    }
  } else {
    const { error } = await supabase.from("workout_sessions").insert({
      id: sessionIdFor(profile.id, sessionDate),
      member_id: profile.id,
      program_day_id: ownProgramDayId,
      session_date: sessionDate,
      status: "completed",
      ended_at: now,
      client_updated_at: now,
    });
    if (error) {
      // A concurrent start created the day; complete whichever one exists.
      const { data: racedRows } = await supabase
        .from("workout_sessions")
        .select("id, session_date, status, created_at, program_day_id")
        .eq("member_id", profile.id)
        .eq("session_date", sessionDate);
      const raced = pickSessionForDate((racedRows ?? []) as SessionRow[], sessionDate);
      if (raced && raced.status !== "completed") {
        await supabase
          .from("workout_sessions")
          .update({ status: "completed", ended_at: now, client_updated_at: now })
          .eq("id", raced.id)
          .eq("member_id", profile.id);
      }
    }
  }

  revalidatePath("/gym");
  revalidatePath("/gym/history");
  revalidatePath("/gym/progress");
  revalidatePath("/");
}

export async function completeSession(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const id = z.string().uuid().safeParse(formData.get("sessionId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase
    .from("workout_sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("member_id", profile.id);
  revalidatePath("/gym");
  revalidatePath(`/gym/workout/${id.data}`);
  revalidatePath("/gym/history");
  revalidatePath("/");
}

export async function skipSession(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const id = z.string().uuid().safeParse(formData.get("sessionId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase
    .from("workout_sessions")
    .update({ status: "skipped", ended_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("member_id", profile.id);
  revalidatePath("/gym");
  revalidatePath("/gym/history");
}

// ── Measurements ────────────────────────────────────────────────────────────
const measurementSchema = z.object({
  measuredOn: isoDate,
  waist: z.coerce.number().min(20).max(250).optional(),
  chest: z.coerce.number().min(20).max(250).optional(),
  arm: z.coerce.number().min(10).max(100).optional(),
  thigh: z.coerce.number().min(10).max(120).optional(),
  hip: z.coerce.number().min(20).max(250).optional(),
  neck: z.coerce.number().min(15).max(100).optional(),
  notes: z.string().max(300).optional(),
});

export async function saveMeasurement(
  _prev: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const profile = await requireFullProfile();
  const raw = Object.fromEntries(formData);
  const cleaned = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  const parsed = measurementSchema.safeParse(cleaned);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid measurement", ok: null };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("body_measurements")
    .select("waist_cm, chest_cm, arm_cm, thigh_cm, hip_cm, neck_cm, notes")
    .eq("member_id", profile.id)
    .eq("measured_on", v.measuredOn)
    .maybeSingle();
  const merged = mergeMeasurement((existing as MeasurementFields | null) ?? null, {
    waist: v.waist,
    chest: v.chest,
    arm: v.arm,
    thigh: v.thigh,
    hip: v.hip,
    neck: v.neck,
    notes: v.notes,
  });
  const { error } = await supabase.from("body_measurements").upsert(
    {
      member_id: profile.id,
      measured_on: v.measuredOn,
      ...merged,
    },
    { onConflict: "member_id,measured_on" },
  );
  if (error) return { error: error.message, ok: null };
  revalidatePath("/gym/progress");
  return { error: null, ok: "Measurement saved." };
}

export async function deleteMeasurement(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("body_measurements").delete().eq("id", id.data).eq("member_id", profile.id);
  revalidatePath("/gym/progress");
}

export async function deleteProgressPhoto(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("progress_photos")
    .select("storage_path")
    .eq("id", id.data)
    .eq("member_id", profile.id)
    .maybeSingle();
  if (row?.storage_path) {
    await supabase.storage.from("progress-photos").remove([row.storage_path]);
  }
  await supabase.from("progress_photos").delete().eq("id", id.data).eq("member_id", profile.id);
  revalidatePath("/gym/progress");
}

// ── Adaptation + streak freeze ──────────────────────────────────────────────
export async function applyAdaptation(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const delta = z.coerce.number().min(-400).max(400).safeParse(formData.get("deltaKcal"));
  const reason = z.string().min(1).max(400).safeParse(formData.get("reason"));
  if (!delta.success || !reason.success) return;

  const base = profile.targets_cache?.targets;
  const current = profile.calorie_adjustment_kcal ?? 0;
  // Never let the adaptive offset push the day below the engine's safety floor.
  const floor = calorieFloorFor(profile.sex);
  const minAdjustment = base ? Math.min(400, Math.max(-400, floor - base.kcal)) : -400;
  const next = clamp(current + delta.data, minAdjustment, 400);
  if (next === current) return;
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ calorie_adjustment_kcal: next, updated_at: new Date().toISOString() })
    .eq("id", profile.id);
  await supabase.from("adaptive_adjustments").insert({
    member_id: profile.id,
    effective_on: istDateISO(),
    delta_kcal: next - current,
    total_kcal: next,
    reason: reason.data,
  });
  revalidatePath("/gym");
  revalidatePath("/gym/progress");
  revalidatePath("/");
  revalidatePath("/week");
}

export async function resetAdaptation(): Promise<void> {
  const profile = await requireFullProfile();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ calorie_adjustment_kcal: 0, updated_at: new Date().toISOString() })
    .eq("id", profile.id);
  await supabase.from("adaptive_adjustments").insert({
    member_id: profile.id,
    effective_on: istDateISO(),
    delta_kcal: -(profile.calorie_adjustment_kcal ?? 0),
    total_kcal: 0,
    reason: "Reset to the engine baseline.",
  });
  revalidatePath("/gym/progress");
  revalidatePath("/");
}

export async function useStreakFreeze(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const date = isoDate.safeParse(formData.get("date"));
  if (!date.success) return;
  const month = date.data.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth =
    monthNumber === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("streak_freezes")
    .select("id")
    .eq("member_id", profile.id)
    .gte("used_on", `${month}-01`)
    .lt("used_on", nextMonth)
    .limit(1);
  if ((existing ?? []).length > 0) return; // one per calendar month
  await supabase.from("streak_freezes").insert({ member_id: profile.id, used_on: date.data });
  revalidatePath("/gym");
}

// ── Custom exercises ────────────────────────────────────────────────────────
const customExerciseSchema = z.object({
  name: z.string().min(2).max(80),
  primary: z.string().min(2).max(30),
  equipment: z.string().min(2).max(30),
  pattern: z.string().min(2).max(30),
  instructions: z.string().max(600).optional(),
});

export async function addCustomExercise(
  _prev: GymActionState,
  formData: FormData,
): Promise<GymActionState> {
  const profile = await requireFullProfile();
  const parsed = customExerciseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid exercise", ok: null };
  const supabase = await createClient();
  const { error } = await supabase.from("custom_exercises").insert({
    member_id: profile.id,
    name: parsed.data.name,
    primary_muscle: parsed.data.primary,
    equipment: parsed.data.equipment,
    pattern: parsed.data.pattern,
    instructions: parsed.data.instructions ?? null,
  });
  if (error) return { error: error.message, ok: null };
  revalidatePath("/gym/exercises");
  return { error: null, ok: "Custom exercise added." };
}
