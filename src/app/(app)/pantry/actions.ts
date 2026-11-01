"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type PantryActionState = { error: string | null; ok: string | null };

const addSchema = z.object({
  ingredient_id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().min(1, "Name is required").max(80),
  quantity: z.coerce.number().min(0).max(100000),
  unit: z.enum(["g", "kg", "ml", "l", "piece"]),
});

export async function addPantryItem(
  _prev: PantryActionState,
  formData: FormData,
): Promise<PantryActionState> {
  const profile = await requireFullProfile();
  const parsed = addSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input", ok: null };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("pantry_items").insert({
    household_id: profile.household_id,
    ingredient_id: v.ingredient_id || null,
    name: v.name,
    quantity: v.quantity,
    unit: v.unit,
  });
  if (error) return { error: error.message, ok: null };

  revalidatePath("/pantry");
  return { error: null, ok: `${v.name} added to the pantry` };
}

export async function updatePantryItem(formData: FormData): Promise<void> {
  await requireFullProfile();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const quantity = z.coerce.number().min(0).max(100000).safeParse(formData.get("quantity"));
  if (!id.success || !quantity.success) return;

  const supabase = await createClient();
  // RLS restricts updates to the household's own rows.
  await supabase
    .from("pantry_items")
    .update({ quantity: quantity.data, updated_at: new Date().toISOString() })
    .eq("id", id.data);
  revalidatePath("/pantry");
}

export async function deletePantryItem(formData: FormData): Promise<void> {
  await requireFullProfile();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase.from("pantry_items").delete().eq("id", id.data);
  revalidatePath("/pantry");
}
