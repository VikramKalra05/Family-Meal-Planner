"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { testProviderCreds } from "@/lib/ai/provider";
import { getUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { checkRate, rateLimited } from "@/lib/rate-limit";

export type ProviderActionState = { error: string | null; ok: string | null };

const providerFormSchema = z.object({
  label: z.string().trim().min(2, "Label is required").max(40),
  base_url: z.string().trim().url("Base URL must be a valid URL").max(200),
  model: z.string().trim().min(1, "Model is required").max(80),
  api_key: z.string().trim().min(8, "API key looks too short").max(300),
});

export async function addAiProvider(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const user = await getUser();
  if (!user) return { error: "Not signed in", ok: null };

  const parsed = providerFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input", ok: null };

  const supabase = await createClient();
  const { count } = await supabase
    .from("ai_providers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { error } = await supabase.from("ai_providers").insert({
    user_id: user.id,
    label: parsed.data.label,
    base_url: parsed.data.base_url.replace(/\/+$/, ""),
    model: parsed.data.model,
    api_key_encrypted: encryptSecret(parsed.data.api_key),
    is_default: (count ?? 0) === 0,
  });
  if (error) return { error: error.message, ok: null };

  revalidatePath("/settings");
  return { error: null, ok: `${parsed.data.label} added` };
}

const updateProviderSchema = providerFormSchema.extend({
  id: z.string().uuid(),
  api_key: z
    .string()
    .trim()
    .max(300)
    .optional()
    .refine((v) => !v || v.length >= 8, "API key looks too short"),
});

/** Edit label/endpoint/model (and optionally rotate the key) in place. */
export async function updateAiProvider(
  _prev: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const user = await getUser();
  if (!user) return { error: "Not signed in", ok: null };

  const parsed = updateProviderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input", ok: null };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ai_providers")
    .select("id")
    .eq("id", v.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) return { error: "Provider not found", ok: null };

  const { error } = await supabase
    .from("ai_providers")
    .update({
      label: v.label,
      base_url: v.base_url.replace(/\/+$/, ""),
      model: v.model,
      ...(v.api_key ? { api_key_encrypted: encryptSecret(v.api_key) } : {}),
    })
    .eq("id", v.id)
    .eq("user_id", user.id);
  if (error) {
    const message = error.message.includes("duplicate")
      ? "That label is already used by another provider."
      : error.message;
    return { error: message, ok: null };
  }

  revalidatePath("/settings");
  revalidatePath(`/settings/providers/${v.id}`);
  redirect("/settings");
}

export async function setDefaultAiProvider(formData: FormData): Promise<void> {  const user = await getUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!user || !id.success) return;

  const supabase = await createClient();
  await supabase.from("ai_providers").update({ is_default: false }).eq("user_id", user.id);
  await supabase.from("ai_providers").update({ is_default: true }).eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/settings");
}

export async function deleteAiProvider(formData: FormData): Promise<void> {
  const user = await getUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!user || !id.success) return;

  const supabase = await createClient();
  await supabase.from("ai_providers").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/settings");
}

/** Live check against a stored provider (key decrypted server-side only). */
export async function testSavedProvider(
  id: string,
): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!checkRate(`test:${user.id}`, 10, 60 * 60 * 1000)) return { ok: false, error: rateLimited(10, 60 * 60 * 1000) };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("ai_providers")
    .select("label, base_url, api_key_encrypted, model")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Provider not found" };

  try {
    return await testProviderCreds(row.base_url, decryptSecret(row.api_key_encrypted), row.model, {
      userId: user.id,
      providerId: id,
      providerLabel: row.label,
    });
  } catch {
    return { ok: false, error: "Could not decrypt the stored key — re-add the provider." };
  }
}

/** Live check with the values currently in the edit form (blank key = stored key). */
export async function testProviderUpdate(
  id: string,
  base_url: string,
  model: string,
  api_key?: string,
): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!checkRate(`test:${user.id}`, 20, 60 * 60 * 1000)) {
    return { ok: false, error: rateLimited(20, 60 * 60 * 1000) };
  }

  const parsedId = z.string().uuid().safeParse(id);
  const url = z.string().trim().url().safeParse(base_url);
  if (!parsedId.success || !url.success || !model.trim()) {
    return { ok: false, error: "Fill base URL and model first" };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("ai_providers")
    .select("label, api_key_encrypted")
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Provider not found" };

  try {
    const key = api_key?.trim() ? api_key.trim() : decryptSecret(row.api_key_encrypted);
    return await testProviderCreds(url.data.replace(/\/+$/, ""), key, model.trim(), {
      userId: user.id,
      providerId: parsedId.data,
      providerLabel: row.label,
    });
  } catch {
    return { ok: false, error: "Could not decrypt the stored key — enter a new key." };
  }
}

/** Live check for unsaved credentials (the "Test" button on the add form). */
export async function testRawProvider(
  base_url: string,
  api_key: string,
  model: string,
): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!checkRate(`testraw:${user.id}`, 10, 60 * 60 * 1000)) return { ok: false, error: rateLimited(10, 60 * 60 * 1000) };
  const url = z.string().url().safeParse(base_url);
  if (!url.success || api_key.length < 8 || !model.trim()) {
    return { ok: false, error: "Fill base URL, API key and model first" };
  }
  return testProviderCreds(url.data, api_key, model.trim(), {
    userId: user.id,
    providerId: null,
    providerLabel: "Unsaved provider",
  });
}
