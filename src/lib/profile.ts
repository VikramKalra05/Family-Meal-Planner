import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { istDateISO } from "@/lib/date";
import type { Profile } from "@/lib/db-types";

/**
 * Request-scoped caches. A page and the shared layout both need the profile;
 * without this dedupe every navigation paid for two `auth.getUser()` network
 * calls plus two profile queries before rendering anything.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Returns the signed-in user's profile, or null when not yet onboarded. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

/**
 * Request-scoped weigh-in status for the header nudge. Cached so the layout
 * and any page in the same request don't duplicate the query.
 */
export const getWeighInStatus = cache(async () => {
  const profile = await getProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const today = istDateISO();
  const { data } = await supabase
    .from("weight_logs")
    .select("id")
    .eq("member_id", profile.id)
    .eq("logged_on", today)
    .maybeSingle();
  return {
    today,
    loggedToday: !!data,
    weighInTime: profile.weigh_in_time,
  };
});

/**
 * Page guard: requires a session (middleware), a completed profile, and a
 * household. Redirects to the earliest missing step instead of rendering.
 */
export const requireFullProfile = cache(async (): Promise<Profile> => {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  if (!profile.household_id) redirect("/onboarding?step=household");
  return profile;
});
