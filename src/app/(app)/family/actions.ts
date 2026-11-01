"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type FamilyActionState = { error: string | null; ok: string | null };

export async function sendMessageAction(
  _prev: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  const profile = await requireFullProfile();
  const parsed = z
    .object({
      toMember: z.string().optional().or(z.literal("")), // "" = whole family
      kind: z.enum(["suggestion", "instruction"]),
      title: z.string().trim().min(2, "Title is required").max(80),
      body: z.string().trim().min(2, "Message is required").max(600),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid message", ok: null };

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    household_id: profile.household_id!,
    from_member: profile.id,
    to_member: parsed.data.toMember || null,
    kind: parsed.data.kind,
    title: parsed.data.title,
    body: parsed.data.body,
  });
  if (error) return { error: error.message, ok: null };

  revalidatePath("/family");
  return { error: null, ok: "Sent" };
}

export async function markMessageRead(formData: FormData): Promise<void> {
  await requireFullProfile();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  // Scoped RPC (migration 0007): only the recipient can mark read, and only
  // read_at — the old row-level UPDATE policy let any member rewrite messages.
  await supabase.rpc("mark_message_read", { msg_id: id.data });
  revalidatePath("/family");
}
