import type { Profile } from "@/lib/db-types";
import { createClient } from "@/lib/supabase/server";
import { istDateISO, istTimeHHMM, formatIstDate } from "@/lib/date";
import { mondayOf } from "@/lib/planner";
import { weightTrend } from "@/lib/weight";
import { memberLabels } from "./labels";

/**
 * Compact, grounding snapshot of the household's current state, embedded in
 * the assistant's system prompt each turn so most natural questions answer
 * without extra tool hops. Tool actions exist for everything beyond this.
 */
export async function buildContextSnapshot(profile: Profile): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  const today = istDateISO();
  const weekStart = mondayOf(today);

  const [membersRes, entriesRes, intakeRes, pantryRes, weightRes, unreadRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, role, diet_type, allergies, targets_cache")
      .eq("household_id", profile.household_id!),
    supabase
      .from("weekly_plans")
      .select("id, plan_entries(entry_date, slot, member_id, member_portions, status, recipes(title, recipe_nutrition(kcal)))")
      .eq("household_id", profile.household_id!)
      .eq("week_start", weekStart)
      .maybeSingle(),
    supabase
      .from("intake_logs")
      .select("kcal, protein_g, slot, description")
      .eq("member_id", profile.id)
      .eq("logged_on", today),
    supabase
      .from("pantry_items")
      .select("name, quantity, unit")
      .eq("household_id", profile.household_id!)
      .order("name")
      .limit(15),
    supabase
      .from("weight_logs")
      .select("logged_on, weight_kg")
      .eq("member_id", profile.id)
      .order("logged_on", { ascending: false })
      .limit(90),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .or(`to_member.is.null,to_member.eq.${profile.id}`)
      .is("read_at", null)
      .neq("from_member", profile.id),
  ]);

  const targets = profile.targets_cache?.targets ?? null;

  type EntryRow = {
    entry_date: string;
    slot: string;
    member_id: string | null;
    member_portions: Record<string, number> | null;
    status: string;
    recipes: { title: string; recipe_nutrition: { kcal: number }[] | null } | null;
  };
  const plan = entriesRes?.data as { plan_entries: EntryRow[] } | null;
  const allEntries = plan?.plan_entries ?? [];
  // Privacy: the model sees stable aliases, never real display names.
  const memberLabel = memberLabels(
    (membersRes.data ?? []).map((m) => ({ id: m.id as string, display_name: m.display_name as string })),
    profile.id,
  );

  const todayEntries = allEntries
    .filter((e) => e.entry_date === today)
    .map((e) => {
      const portion = e.member_id ? (e.member_portions ?? {})[e.member_id] ?? 1 : null;
      const kcal = e.recipes?.recipe_nutrition?.[0]?.kcal != null ? Number(e.recipes.recipe_nutrition[0].kcal) : null;
      return {
        slot: e.slot,
        dish: e.recipes?.title ?? "?",
        who: e.member_id ? (memberLabel.get(e.member_id) ?? "a member") : "family (shared)",
        kcal: kcal != null && portion != null ? Math.round(kcal * portion) : kcal,
        status: e.status,
      };
    });

  const consumedKcal = (intakeRes.data ?? []).reduce((s, l) => s + Number(l.kcal), 0);
  const consumedProtein = (intakeRes.data ?? []).reduce((s, l) => s + Number(l.protein_g ?? 0), 0);

  const weights = (weightRes.data ?? []).map((w) => ({
    date: w.logged_on,
    kg: Number(w.weight_kg),
  }));
  const trend = weights.length >= 4 ? weightTrend([...weights].reverse()) : null;

  return {
    now: {
      today,
      today_label: formatIstDate(today),
      time_ist: istTimeHHMM(),
      week_start: weekStart,
    },
    me: {
      role: profile.role,
      diet: profile.diet_type,
      allergies: profile.allergies ?? [],
      budget_daily: profile.budget_daily ?? null,
      target_weight_kg: profile.target_weight_kg != null ? Number(profile.target_weight_kg) : null,
      targets: targets
        ? { kcal: targets.kcal, protein_g: targets.proteinG, carbs_g: targets.carbsG, fat_g: targets.fatG, fiber_g: targets.fiberG }
        : null,
    },
    family: (membersRes.data ?? []).map((m) => ({
      member: memberLabel.get(m.id as string) ?? "a member",
      role: m.role,
      diet: m.diet_type,
      allergies: m.allergies ?? [],
    })),
    today_plan: todayEntries,
    eaten_today: {
      kcal: Math.round(consumedKcal),
      protein_g: Math.round(consumedProtein),
      items: (intakeRes.data ?? []).map((l) => l.description),
    },
    pantry_sample: (pantryRes.data ?? []).map((p) => `${p.name} (${Number(p.quantity)} ${p.unit})`),
    weight: {
      latest_kg: weights[0]?.kg ?? null,
      trend_kg_per_week: trend != null ? Math.round(trend * 100) / 100 : null,
      logs: weights.length,
    },
    unread_family_messages: unreadRes.count ?? 0,
  };
}
