"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { istDateISO } from "@/lib/date";

/**
 * Food-diary writes. Every action is RLS-scoped and also filters by
 * member_id, so a crafted form can never touch another member's intake —
 * the household owner can READ their logs (support view) but not edit them.
 */

export type IntakeEditState = { error: string | null; ok: string | null; ts: number };

const init = { error: null, ok: null, ts: 0 } satisfies IntakeEditState;

const slotEnum = z.enum(["breakfast", "lunch", "snack", "dinner"]);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((d) => d <= istDateISO(), "That day is in the future");

const itemFields = z.object({
  description: z.string().trim().min(1, "Name the food").max(120),
  kcal: z.coerce.number().min(0, "Calories can't be negative").max(5000),
  proteinG: z.coerce.number().min(0).max(400),
  carbsG: z.coerce.number().min(0).max(600),
  fatG: z.coerce.number().min(0).max(400),
  fiberG: z.coerce.number().min(0).max(200),
  slot: slotEnum,
  date: isoDate,
});

function fail(message: string): IntakeEditState {
  return { ...init, error: message };
}

function done(message: string): IntakeEditState {
  return { error: null, ok: message, ts: Date.now() };
}

function revalidateDiary(): void {
  revalidatePath("/");
}

/** Adds one manually-estimated food item to a day. */
export async function addIntakeItem(
  _prev: IntakeEditState,
  formData: FormData,
): Promise<IntakeEditState> {
  const profile = await requireFullProfile();
  const parsed = itemFields.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check those numbers");
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("intake_logs").insert({
    member_id: profile.id,
    logged_on: v.date,
    slot: v.slot,
    description: v.description,
    kcal: v.kcal,
    protein_g: v.proteinG,
    carbs_g: v.carbsG,
    fat_g: v.fatG,
    fiber_g: v.fiberG,
    source: "manual",
  });
  if (error) return fail(error.message);

  revalidateDiary();
  return done(`Added ${v.description} (${Math.round(v.kcal)} kcal)`);
}

/** Edits one logged item — including moving it to another slot or day. */
export async function updateIntakeItem(
  _prev: IntakeEditState,
  formData: FormData,
): Promise<IntakeEditState> {
  const profile = await requireFullProfile();
  const id = z.string().uuid().safeParse(formData.get("itemId"));
  if (!id.success) return fail("That entry is no longer available");

  const parsed = itemFields.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check those numbers");
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_logs")
    .update({
      description: v.description,
      kcal: v.kcal,
      protein_g: v.proteinG,
      carbs_g: v.carbsG,
      fat_g: v.fatG,
      fiber_g: v.fiberG,
      slot: v.slot,
      logged_on: v.date,
    })
    .eq("id", id.data)
    .eq("member_id", profile.id)
    .select("id")
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail("That entry was not found");

  revalidateDiary();
  return done(`Updated ${v.description ?? "the entry"}`);
}

/** Removes one logged item. Plain form action (Confirm is the button itself). */
export async function deleteIntakeItem(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const id = z.string().uuid().safeParse(formData.get("itemId"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase.from("intake_logs").delete().eq("id", id.data).eq("member_id", profile.id);
  revalidateDiary();
}

const clearSchema = z.object({ date: isoDate, slot: slotEnum.optional() });

/** Empties a day (or one slot of it) — the "that was yesterday's food" fix. */
export async function clearIntakeDay(
  _prev: IntakeEditState,
  formData: FormData,
): Promise<IntakeEditState> {
  const profile = await requireFullProfile();
  const parsed = clearSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid day");

  const supabase = await createClient();
  let query = supabase
    .from("intake_logs")
    .delete({ count: "exact" })
    .eq("member_id", profile.id)
    .eq("logged_on", parsed.data.date);
  if (parsed.data.slot) query = query.eq("slot", parsed.data.slot);
  const { error, count } = await query;
  if (error) return fail(error.message);

  revalidateDiary();
  if (!count) return done("Nothing was logged on that day");
  return done(`Cleared ${count} item${count === 1 ? "" : "s"}`);
}
