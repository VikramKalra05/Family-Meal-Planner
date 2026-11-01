import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/db-types";

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Returns the signed-in user's profile, or null when not yet onboarded. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
}

/**
 * Page guard: requires a session (middleware), a completed profile, and a
 * household. Redirects to the earliest missing step instead of rendering.
 */
export async function requireFullProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  if (!profile.household_id) redirect("/onboarding?step=household");
  return profile;
}
