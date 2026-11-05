import { z } from "zod";
import type { Profile } from "@/lib/db-types";
import { createClient } from "@/lib/supabase/server";
import {
  aggregateIngredients,
  buildShoppingList,
  candidatesFor,
  generateWeek,
  isRecipeSafeFor,
  mondayOf,
  portionFor,
  sharedDiet,
  type PlannerMember,
  type PlannerRecipe,
  type SlotKey,
} from "@/lib/planner";
import { loadPlanData, loadPantry } from "@/lib/plan-data";
import { calculateTargets } from "@/lib/nutrition/engine";
import { ageFromDob } from "@/lib/age";
import { healthTags } from "@/lib/nutrition/health";
import { weightTrend, progressPct, projectTargetDate } from "@/lib/weight";
import { istDateISO, istHour } from "@/lib/date";
import { memberLabels } from "./labels";
import { chatJson, ProviderError, type ResolvedProvider } from "@/lib/ai/provider";
import { importDraftRecipe } from "@/app/(app)/recipes/from-reel/actions";
import type { AssistantAction } from "./schema";

/**
 * Executors for the assistant's whitelisted actions. Everything runs through
 * the request-scoped (RLS) Supabase client, so the assistant can never read
 * or write anything the signed-in member couldn't. Mutations re-validate in
 * the /act route via the same zod schema before reaching these functions.
 *
 * Logic mirrors the existing server actions but without their redirect()
 * endings — those are navigation conveniences that would kill an API caller.
 */

export interface ToolOutcome {
  ok: boolean;
  /** Human-readable line for the chat thread / confirmation result. */
  message: string;
}

export interface ReadResult extends ToolOutcome {
  /** Compact JSON fed back to the model (and shown as a chip in the UI). */
  data?: unknown;
}

// ── Read executors ──────────────────────────────────────────────────────────

export async function executeReadAction(action: AssistantAction, profile: Profile): Promise<ReadResult> {
  const supabase = await createClient();

  switch (action.action) {
    case "query_week": {
      const weekStart = mondayOf(action.week_start ?? istDateISO());
      // recipe_nutrition hangs off recipes (no direct FK from plan_entries) —
      // the embed must go through recipes or PostgREST rejects the whole query.
      const { data: plan } = await supabase
        .from("weekly_plans")
        .select(
          "week_start, plan_entries(id, entry_date, slot, member_id, member_portions, status, recipe_id, recipes(title, recipe_nutrition(kcal, protein_g)))",
        )
        .eq("household_id", profile.household_id!)
        .eq("week_start", weekStart)
        .maybeSingle();
      if (!plan) return { ok: true, message: `No plan exists for the week of ${weekStart}`, data: { week_start: weekStart, planned: false } };

      const { data: memberRows } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("household_id", profile.household_id!);
      // Privacy: aliases only — real names never reach the model.
      const names = memberLabels(
        (memberRows ?? []).map((m) => ({ id: m.id, display_name: m.display_name })),
        profile.id,
      );

      type Entry = {
        id: string;
        entry_date: string;
        slot: string;
        member_id: string | null;
        member_portions: Record<string, number> | null;
        status: string;
        recipe_id: string;
        recipes: { title: string; recipe_nutrition: { kcal: number; protein_g: number }[] | null } | null;
      };
      const entries = (plan.plan_entries ?? []) as unknown as Entry[];
      const byDay = new Map<string, unknown[]>();
      for (const e of entries) {
        const eater = e.member_id ? (names.get(e.member_id) ?? "member") : "family (shared)";
        const portion = e.member_id ? (e.member_portions ?? {})[e.member_id] ?? 1 : null;
        const kcal = e.recipes?.recipe_nutrition?.[0]?.kcal != null ? Number(e.recipes.recipe_nutrition[0].kcal) : null;
        const list = byDay.get(e.entry_date) ?? [];
        list.push({
          entry_id: e.id,
          recipe_id: e.recipe_id,
          slot: e.slot,
          who: eater,
          dish: e.recipes?.title ?? "?",
          kcal: kcal != null ? (portion != null ? Math.round(kcal * portion) : Math.round(kcal)) : null,
          status: e.status,
        });
        byDay.set(e.entry_date, list);
      }
      return {
        ok: true,
        message: `Checked the plan for the week of ${weekStart}`,
        data: { week_start: weekStart, days: Object.fromEntries(byDay) },
      };
    }

    case "query_today": {
      const today = istDateISO();
      const [entriesRes, intakeRes] = await Promise.all([
        supabase
          .from("weekly_plans")
          .select("plan_entries(id, slot, member_id, member_portions, status, recipes(title, recipe_nutrition(kcal, protein_g)))")
          .eq("household_id", profile.household_id!)
          .lte("week_start", today)
          .gte("week_start", new Date(Date.parse(today) - 6 * 86400000).toISOString().slice(0, 10))
          .maybeSingle(),
        supabase
          .from("intake_logs")
          .select("slot, description, kcal, protein_g, carbs_g, fat_g")
          .eq("member_id", profile.id)
          .eq("logged_on", today),
      ]);
      type Entry = {
        id: string;
        slot: string;
        member_id: string | null;
        member_portions: Record<string, number> | null;
        status: string;
        recipes: { title: string; recipe_nutrition: { kcal: number; protein_g: number }[] | null } | null;
      };
      const entries = ((entriesRes?.data as { plan_entries: Entry[] } | null)?.plan_entries ?? []).filter(
        (e) => e.member_id === null || e.member_id === profile.id,
      );
      const intake = intakeRes.data ?? [];
      const eaten = intake.reduce((s, l) => s + Number(l.kcal), 0);
      const targets = profile.targets_cache?.targets ?? null;
      return {
        ok: true,
        message: "Checked today's plan and intake",
        data: {
          today,
          targets,
          planned: entries.map((e) => {
            const portion = e.member_id ? (e.member_portions ?? {})[e.member_id] ?? 1 : null;
            const kcal = e.recipes?.recipe_nutrition?.[0]?.kcal != null ? Number(e.recipes.recipe_nutrition[0].kcal) : null;
            return {
              entry_id: e.id,
              slot: e.slot,
              dish: e.recipes?.title ?? "?",
              who: e.member_id ? "me" : "family (shared)",
              kcal: kcal != null ? (portion != null ? Math.round(kcal * portion) : Math.round(kcal)) : null,
              status: e.status,
            };
          }),
          eaten_today: {
            kcal: Math.round(eaten),
            protein_g: Math.round(intake.reduce((s, l) => s + Number(l.protein_g ?? 0), 0)),
            remaining_kcal: targets ? Math.round(targets.kcal - eaten) : null,
            items: intake.map((l) => ({ slot: l.slot, what: l.description, kcal: Math.round(Number(l.kcal)) })),
          },
        },
      };
    }

    case "query_intake_history": {
      const days = action.days ?? 7;
      const since = new Date(Date.parse(istDateISO()) - (days - 1) * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("intake_logs")
        .select("logged_on, kcal, protein_g")
        .eq("member_id", profile.id)
        .gte("logged_on", since)
        .order("logged_on");
      const targets = profile.targets_cache?.targets ?? null;
      const byDay = new Map<string, { kcal: number; protein: number }>();
      for (const row of data ?? []) {
        const d = byDay.get(row.logged_on) ?? { kcal: 0, protein: 0 };
        d.kcal += Number(row.kcal);
        d.protein += Number(row.protein_g ?? 0);
        byDay.set(row.logged_on, d);
      }
      return {
        ok: true,
        message: `Checked intake for the last ${days} days`,
        data: {
          days,
          target_kcal: targets?.kcal ?? null,
          target_protein_g: targets?.proteinG ?? null,
          per_day: [...byDay.entries()].map(([day, v]) => ({
            day,
            kcal: Math.round(v.kcal),
            protein_g: Math.round(v.protein),
          })),
        },
      };
    }

    case "search_recipes": {
      let q = supabase
        .from("recipes")
        .select("id, title, cuisine, is_veg, servings, prep_minutes, recipe_nutrition(kcal, protein_g, fiber_g, carbs_g, fat_g)")
        .order("title")
        .limit(40);
      if (action.q) q = q.ilike("title", `%${action.q}%`);
      if (action.veg === "veg") q = q.eq("is_veg", true);
      if (action.veg === "non_veg") q = q.eq("is_veg", false);
      const { data } = await q;
      const results = (data ?? [])
        .map((r) => {
          const n = (r.recipe_nutrition as unknown as { kcal: number; protein_g: number; fiber_g: number | null; carbs_g: number; fat_g: number }[] | null)?.[0];
          if (!n) return null;
          const perServing = { kcal: Number(n.kcal), protein_g: Number(n.protein_g), carbs_g: Number(n.carbs_g), fat_g: Number(n.fat_g), fiber_g: n.fiber_g == null ? null : Number(n.fiber_g) };
          if (action.max_kcal != null && perServing.kcal > action.max_kcal) return null;
          if (action.max_prep != null && r.prep_minutes != null && r.prep_minutes > action.max_prep) return null;
          return {
            recipe_id: r.id,
            title: r.title,
            cuisine: r.cuisine,
            veg: r.is_veg,
            prep_minutes: r.prep_minutes,
            per_serving: perServing,
            tags: healthTags({ kcal: perServing.kcal, proteinG: perServing.protein_g, carbsG: perServing.carbs_g, fatG: perServing.fat_g, fiberG: perServing.fiber_g ?? 0 }),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .slice(0, action.limit ?? 5);
      return {
        ok: true,
        message: `Searched recipes${action.q ? ` for “${action.q}”` : ""}`,
        data: { count: results.length, results },
      };
    }

    case "recipe_detail": {
      const ref = action.recipe_ref;
      const isUuid = /^[0-9a-f-]{36}$/i.test(ref);
      const detailQuery = supabase
        .from("recipes")
        .select("id, title, description, cuisine, servings, prep_minutes, is_veg, steps, notes, recipe_nutrition(kcal, protein_g, carbs_g, fat_g, fiber_g), recipe_items(quantity_g, unit, note, ingredients(name))");
      const { data: r } = await (isUuid ? detailQuery.eq("id", ref) : detailQuery.ilike("title", `%${ref}%`))
        .limit(1)
        .maybeSingle();
      if (!r) return { ok: false, message: `No recipe found for “${ref}”` };
      const n = (r.recipe_nutrition as unknown as { kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number | null }[] | null)?.[0] ?? null;
      const items = (r.recipe_items ?? []) as unknown as { quantity_g: number | null; unit: string | null; note: string | null; ingredients: { name: string } | null }[];
      return {
        ok: true,
        message: `Looked up “${r.title}”`,
        data: {
          recipe_id: r.id,
          title: r.title,
          description: r.description,
          cuisine: r.cuisine,
          servings: r.servings,
          prep_minutes: r.prep_minutes,
          veg: r.is_veg,
          per_serving: n,
          ingredients: items.map((i) => ({ name: i.ingredients?.name ?? "?", qty: `${Number(i.quantity_g ?? 0)}${i.unit ?? "g"}`, note: i.note })),
          steps: r.steps,
          notes: r.notes,
        },
      };
    }

    case "query_pantry": {
      const { data } = await supabase
        .from("pantry_items")
        .select("id, name, quantity, unit, updated_at")
        .eq("household_id", profile.household_id!)
        .order("name");
      return {
        ok: true,
        message: "Checked the pantry",
        data: { items: (data ?? []).map((p) => ({ pantry_item_id: p.id, name: p.name, quantity: Number(p.quantity), unit: p.unit })) },
      };
    }

    case "query_shopping": {
      const { data: list } = await supabase
        .from("shopping_lists")
        .select("week_start, items, status")
        .eq("household_id", profile.household_id!)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!list) return { ok: true, message: "No shopping list yet", data: { exists: false } };
      const items = (list.items as { name: string; display: string; checked: boolean }[]) ?? [];
      return {
        ok: true,
        message: "Checked the shopping list",
        data: {
          week_start: list.week_start,
          status: list.status,
          items: items.map((i) => ({ name: i.name, need: i.display, checked: i.checked })),
        },
      };
    }

    case "query_weight": {
      const { data } = await supabase
        .from("weight_logs")
        .select("logged_on, weight_kg")
        .eq("member_id", profile.id)
        .order("logged_on", { ascending: false })
        .limit(90);
      const points = (data ?? []).map((w) => ({ date: w.logged_on, kg: Number(w.weight_kg) }));
      const trend = points.length >= 4 ? weightTrend([...points].reverse()) : null;
      const targetKg = profile.target_weight_kg != null ? Number(profile.target_weight_kg) : null;
      const projection = trend != null && targetKg != null ? projectTargetDate(points, targetKg, trend) : null;
      return {
        ok: true,
        message: "Checked weight progress",
        data: {
          latest_kg: points[0]?.kg ?? null,
          logged_days: points.length,
          target_kg: targetKg,
          trend_kg_per_week: trend != null ? Math.round(trend * 100) / 100 : null,
          progress_pct: targetKg != null ? progressPct(points, targetKg) : null,
          projection: projection === "regressing" ? "trend moving away from target" : projection,
        },
      };
    }

    case "query_family": {
      const [membersRes, inviteRes, unreadRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, role, diet_type, allergies, targets_cache")
          .eq("household_id", profile.household_id!),
        supabase.from("households").select("name, invite_code").eq("id", profile.household_id!).maybeSingle(),
        supabase
          .from("messages")
          .select("title, body, kind, created_at, profiles(id)")
          .or(`to_member.is.null,to_member.eq.${profile.id}`)
          .is("read_at", null)
          .neq("from_member", profile.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      const labels = memberLabels(
        (membersRes.data ?? []).map((m) => ({ id: m.id, display_name: m.display_name })),
        profile.id,
      );
      return {
        ok: true,
        message: "Checked the family",
        data: {
          household: inviteRes?.data?.name ?? null,
          invite_code: inviteRes?.data?.invite_code ?? null,
          members: (membersRes.data ?? []).map((m) => ({
            member: labels.get(m.id) ?? "a member",
            role: m.role,
            diet: m.diet_type,
            allergies: m.allergies ?? [],
            target_kcal: (m.targets_cache as { targets?: { kcal?: number } } | null)?.targets?.kcal ?? null,
          })),
          unread_messages: (unreadRes.data ?? []).map((m) => ({
            from: labels.get((m.profiles as unknown as { id: string } | null)?.id ?? "") ?? "a member",
            kind: m.kind,
            title: m.title,
            body: m.body,
          })),
        },
      };
    }

    case "query_usage": {
      const days = action.days ?? 30;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data } = await supabase
        .from("ai_usage_events")
        .select("feature, model, prompt_tokens, completion_tokens, reasoning_tokens, total_tokens, cost_usd, estimated")
        .eq("user_id", profile.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      const rows = data ?? [];
      const totals = rows.reduce(
        (acc, r) => {
          acc.calls += 1;
          acc.prompt += Number(r.prompt_tokens ?? 0);
          acc.completion += Number(r.completion_tokens ?? 0);
          acc.reasoning += Number(r.reasoning_tokens ?? 0);
          acc.cost += r.cost_usd == null ? 0 : Number(r.cost_usd);
          if (r.cost_usd == null) acc.unpriced += 1;
          return acc;
        },
        { calls: 0, prompt: 0, completion: 0, reasoning: 0, cost: 0, unpriced: 0 },
      );
      const byFeature = new Map<string, number>();
      for (const r of rows) byFeature.set(r.feature, (byFeature.get(r.feature) ?? 0) + 1);
      return {
        ok: true,
        message: `Checked AI usage for the last ${days} days`,
        data: {
          days,
          totals: { ...totals, cost_usd: Math.round(totals.cost * 1e6) / 1e6 },
          calls_by_feature: Object.fromEntries(byFeature),
        },
      };
    }

    case "suggest_dishes": {
      const { plannerRecipes, members } = await loadPlanData(profile);
      const labels = memberLabels(
        members.map((m) => ({ id: m.id, display_name: m.name })),
        profile.id,
      );
      const wanted = action.member?.toLowerCase();
      const eater = wanted
        ? members.find((m) => (labels.get(m.id) ?? "").toLowerCase() === wanted)
        : null;
      if (action.member && !eater) {
        return { ok: false, message: `No member with that alias — query_family lists the exact aliases (e.g. "Member-A")` };
      }
      const member: PlannerMember = eater ?? sharedDiet(members);
      const usedTitles = new Set<string>();
      const picks = candidatesFor(plannerRecipes, member, action.slot as SlotKey, usedTitles, 6)
        .filter((c) => action.max_kcal == null || c.recipe.kcal <= action.max_kcal)
        .slice(0, 6);
      return {
        ok: true,
        message: `Picked ${action.slot} ideas for ${member.name}`,
        data: {
          for_whom: member.name,
          suggestions: picks.map((c) => ({
            recipe_id: c.recipe.id,
            title: c.recipe.title,
            kcal_per_serving: c.recipe.kcal,
            suggested_portion: Math.round(c.portion * 4) / 4,
            kcal_at_portion: Math.round(c.recipe.kcal * c.portion),
            why: c.reason,
          })),
        },
      };
    }

    default:
      return { ok: false, message: "That read action is not available" };
  }
}

// ── Mutation executors (always called after explicit user confirmation) ─────

const mealParseSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        kcal: z.coerce.number().min(0).max(3000),
        proteinG: z.coerce.number().min(0).max(300),
        carbsG: z.coerce.number().min(0).max(500),
        fatG: z.coerce.number().min(0).max(300),
      }),
    )
    .min(1)
    .max(15),
});

const MEAL_PARSE_SYSTEM = `You extract everything a person ATE from a short message (Hinglish, English, or food names with counts).
Respond with ONLY JSON: {"items": [{"name": string, "kcal": number, "proteinG": number, "carbsG": number, "fatG": number}]}.
Estimate nutrition for typical Indian home portions. One entry per distinct food item, name kept short.`;

export async function executeMutationAction(
  action: AssistantAction,
  profile: Profile,
  provider: ResolvedProvider | null,
): Promise<ToolOutcome> {
  const supabase = await createClient();

  switch (action.action) {
    case "log_meal": {
      if (!provider) return { ok: false, message: "No AI provider configured — add one in Settings → AI Providers first." };
      let items: z.infer<typeof mealParseSchema>["items"];
      try {
        const parsed = await chatJson(
          provider,
          mealParseSchema,
          [
            { role: "system", content: MEAL_PARSE_SYSTEM },
            { role: "user", content: action.text },
          ],
          { maxTokens: 900, temperature: 0.2, feature: "assistant" },
        );
        items = parsed.items;
      } catch (e) {
        return { ok: false, message: e instanceof ProviderError ? e.message : "Could not parse that meal — try rephrasing." };
      }
      const totalKcal = items.reduce((s, i) => s + i.kcal, 0);
      if (totalKcal > 8000) return { ok: false, message: "That adds up to over 8,000 kcal — double-check and try again." };

      const hour = istHour();
      const slot = action.slot ?? (hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 19 ? "snack" : "dinner");
      await supabase.from("intake_logs").insert(
        items.map((i) => ({
          member_id: profile.id,
          logged_on: istDateISO(),
          slot,
          description: i.name,
          kcal: i.kcal,
          protein_g: i.proteinG,
          carbs_g: i.carbsG,
          fat_g: i.fatG,
          source: "ai_chat",
        })),
      );
      return { ok: true, message: `Logged ${items.length} item${items.length > 1 ? "s" : ""} (~${Math.round(totalKcal)} kcal) to ${slot}.` };
    }

    case "log_weight": {
      const kg = Math.round(action.weight_kg * 10) / 10;
      const today = istDateISO();
      const { error } = await supabase
        .from("weight_logs")
        .upsert({ member_id: profile.id, logged_on: today, weight_kg: kg, source: "manual" }, { onConflict: "member_id,logged_on" });
      if (error) return { ok: false, message: error.message };

      if (Number(profile.weight_kg) !== kg) {
        const { targets, breakdown } = calculateTargets({
          sex: profile.sex!,
          age: profile.date_of_birth ? ageFromDob(profile.date_of_birth) : 30,
          heightCm: Number(profile.height_cm ?? 170),
          weightKg: kg,
          activityLevel: profile.activity_level ?? "moderate",
          goal: profile.goal ?? "maintenance",
        });
        await supabase
          .from("profiles")
          .update({ weight_kg: kg, targets_cache: { targets, breakdown }, targets_version: profile.targets_version + 1 })
          .eq("id", profile.id);
      }
      return { ok: true, message: `Logged ${kg} kg for today${Number(profile.weight_kg) !== kg ? " — targets recalculated." : "."}` };
    }

    case "add_recipe": {
      const result = await importDraftRecipe({ ...action.draft, source_url: null });
      if ("error" in result) return { ok: false, message: result.error };
      return { ok: true, message: `Recipe “${action.draft.title}” saved with computed nutrition.` };
    }

    case "generate_week": {
      const weekStart = mondayOf(action.week_start ?? istDateISO());
      const { plannerRecipes, members } = await loadPlanData(profile);
      const entries = generateWeek({ recipes: plannerRecipes, members, weekStart });
      const { data: plan } = await supabase
        .from("weekly_plans")
        .upsert({ household_id: profile.household_id!, week_start: weekStart, status: "active" }, { onConflict: "household_id,week_start" })
        .select("id")
        .single();
      if (!plan) return { ok: false, message: "Could not save the plan." };
      await supabase.from("plan_entries").delete().eq("plan_id", plan.id);
      if (entries.length > 0) {
        await supabase.from("plan_entries").insert(
          entries.map((e) => ({
            plan_id: plan.id,
            entry_date: e.date,
            slot: e.slot,
            recipe_id: e.recipeId,
            member_id: e.memberId,
            servings_base: e.servingsBase,
            member_portions: e.memberPortions,
            status: "planned",
          })),
        );
      }
      return { ok: true, message: `Week of ${weekStart} regenerated with ${entries.length} planned meals.` };
    }

    case "swap_dish": {
      const { data: recipeRow } = await supabase
        .from("recipes")
        .select("id, title, is_veg, servings, prep_minutes, recipe_nutrition(kcal, protein_g, fiber_g), recipe_items(ingredients(name))")
        .eq("id", action.new_recipe_id)
        .maybeSingle();
      const rawNut = recipeRow?.recipe_nutrition as unknown;
      const nut = (Array.isArray(rawNut) ? rawNut[0] : rawNut) as { kcal: number; protein_g: number; fiber_g: number | null } | null;
      if (!recipeRow || !nut) return { ok: false, message: "That replacement recipe was not found (or has no nutrition)." };

      const items = (recipeRow.recipe_items ?? []) as unknown as { ingredients: { name: string } | null }[];
      const candidate: PlannerRecipe = {
        id: recipeRow.id,
        title: recipeRow.title,
        isVeg: recipeRow.is_veg,
        servings: recipeRow.servings,
        prepMinutes: recipeRow.prep_minutes,
        kcal: Number(nut.kcal),
        proteinG: Number(nut.protein_g),
        fiberG: nut.fiber_g == null ? 0 : Number(nut.fiber_g),
        ingredientNames: items.map((i) => i.ingredients?.name ?? "").filter(Boolean),
        ingredientIds: [],
      };

      const { data: entry } = await supabase
        .from("plan_entries")
        .select("member_id, slot, entry_date")
        .eq("id", action.entry_id)
        .maybeSingle();
      if (!entry) return { ok: false, message: "That planned meal was not found." };

      const { data: memberRows } = await supabase
        .from("profiles")
        .select("id, display_name, diet_type, allergies, targets_cache, role")
        .eq("household_id", profile.household_id!)
        .neq("role", "staff");
      const allMembers: PlannerMember[] = (memberRows ?? [])
        .filter((m) => m.targets_cache)
        .map((m) => ({ id: m.id, name: m.display_name, diet: m.diet_type, allergies: m.allergies ?? [], targets: m.targets_cache!.targets }));
      if (allMembers.length === 0) return { ok: false, message: "No plan members found." };

      const slot = entry.slot as SlotKey;
      const eater = entry.member_id ? allMembers.find((m) => m.id === entry.member_id) : sharedDiet(allMembers);
      if (!eater) return { ok: false, message: "Could not determine who eats that meal." };
      if (!isRecipeSafeFor(candidate, eater)) {
        return { ok: false, message: `“${candidate.title}” is not safe for ${eater.name} (diet/allergy rules) — pick another dish.` };
      }

      const targets = entry.member_id ? allMembers.filter((m) => m.id === entry.member_id) : allMembers;
      const memberPortions: Record<string, number> = {};
      let totalPortions = 0;
      for (const member of targets) {
        const portion = portionFor(candidate, member, slot);
        memberPortions[member.id] = portion;
        totalPortions += portion;
      }
      if (totalPortions <= 0) return { ok: false, message: "Could not compute portions for that dish." };

      await supabase
        .from("plan_entries")
        .update({ recipe_id: action.new_recipe_id, servings_base: Math.round(totalPortions * 100) / 100, member_portions: memberPortions })
        .eq("id", action.entry_id);
      return { ok: true, message: `Swapped the ${slot} dish to “${candidate.title}” — portions re-scaled for ${eater.name}.` };
    }

    case "mark_eaten": {
      const { data: entry } = await supabase
        .from("plan_entries")
        .select("entry_date, slot, recipe_id, member_id, servings_base, member_portions")
        .eq("id", action.entry_id)
        .maybeSingle();
      if (!entry) return { ok: false, message: "That planned meal was not found." };
      await supabase.from("plan_entries").update({ status: "eaten" }).eq("id", action.entry_id);
      const { data: nut } = await supabase
        .from("recipe_nutrition")
        .select("kcal, protein_g, carbs_g, fat_g, fiber_g")
        .eq("recipe_id", entry.recipe_id)
        .maybeSingle();
      if (nut && (entry.member_id === null || entry.member_id === profile.id)) {
        const portions = (entry.member_portions ?? {}) as Record<string, number>;
        const factor = portions[profile.id] ?? (entry.member_id === profile.id ? Number(entry.servings_base) : 1);
        await supabase.from("intake_logs").insert({
          member_id: profile.id,
          logged_on: entry.entry_date,
          slot: entry.slot,
          recipe_id: entry.recipe_id,
          description: "from plan",
          kcal: Number(nut.kcal) * factor,
          protein_g: Number(nut.protein_g) * factor,
          carbs_g: Number(nut.carbs_g) * factor,
          fat_g: Number(nut.fat_g) * factor,
          fiber_g: nut.fiber_g == null ? null : Number(nut.fiber_g) * factor,
          source: "plan",
        });
      }
      return { ok: true, message: "Marked as eaten — intake updated." };
    }

    case "remove_plan_entry": {
      const { error } = await supabase.from("plan_entries").delete().eq("id", action.entry_id);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: "Removed that planned meal." };
    }

    case "add_pantry_item": {
      const { error } = await supabase.from("pantry_items").insert({
        household_id: profile.household_id!,
        name: action.name.toLowerCase(),
        quantity: action.quantity,
        unit: action.unit,
      });
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `Added ${action.name} (${action.quantity} ${action.unit}) to the pantry.` };
    }

    case "remove_pantry_item": {
      const { error } = await supabase.from("pantry_items").delete().eq("id", action.pantry_item_id);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: "Removed that pantry item." };
    }

    case "build_shopping_list": {
      const weekStart = mondayOf(action.week_start ?? istDateISO());
      const { data: plan } = await supabase
        .from("weekly_plans")
        .select("id")
        .eq("household_id", profile.household_id!)
        .eq("week_start", weekStart)
        .maybeSingle();
      if (!plan) return { ok: false, message: `No plan exists for the week of ${weekStart} — generate one first.` };
      const { data: entries } = await supabase
        .from("plan_entries")
        .select("entry_date, slot, member_id, recipe_id, servings_base, member_portions")
        .eq("plan_id", plan.id);
      if (!entries || entries.length === 0) return { ok: false, message: "That week's plan is empty." };
      const { itemsByRecipe } = await loadPlanData(profile);
      const agg = aggregateIngredients(
        entries.map((e) => ({
          date: e.entry_date,
          slot: e.slot as SlotKey,
          memberId: e.member_id,
          recipeId: e.recipe_id,
          servingsBase: Number(e.servings_base),
          memberPortions: (e.member_portions ?? {}) as Record<string, number>,
        })),
        itemsByRecipe,
      );
      const pantry = await loadPantry(profile);
      const items = buildShoppingList(agg, pantry);
      await supabase
        .from("shopping_lists")
        .upsert({ household_id: profile.household_id!, week_start: weekStart, items, status: "open" }, { onConflict: "household_id,week_start" });
      return { ok: true, message: `Shopping list built — ${items.length} items for the week of ${weekStart}.` };
    }

    case "toggle_shopping_item": {
      const weekStart = mondayOf(istDateISO());
      const { data: list } = await supabase
        .from("shopping_lists")
        .select("id, items")
        .eq("household_id", profile.household_id!)
        .eq("week_start", weekStart)
        .maybeSingle();
      if (!list) return { ok: false, message: "No shopping list for this week yet." };
      const items = (list.items as { name: string; display: string; checked: boolean }[]) ?? [];
      const needle = action.item_name.toLowerCase();
      const item = items.find((i) => i.name.toLowerCase().includes(needle)) ?? items.find((i) => i.display.toLowerCase().includes(needle));
      if (!item) return { ok: false, message: `No list item matches “${action.item_name}”.` };
      item.checked = !item.checked;
      await supabase.from("shopping_lists").update({ items }).eq("id", list.id);
      return { ok: true, message: `${item.checked ? "Checked off" : "Unchecked"} “${item.display}”.` };
    }

    case "send_family_message": {
      let toMemberId: string | null = null;
      let toLabel = "the whole family";
      if (action.to_member) {
        const { data: householdMembers } = await supabase
          .from("profiles")
          .select("id, display_name")
          .eq("household_id", profile.household_id!);
        const labels = memberLabels(householdMembers ?? [], profile.id);
        const wanted = action.to_member.toLowerCase();
        const hit = [...labels.entries()].find(([, label]) => label.toLowerCase() === wanted);
        if (!hit) {
          return { ok: false, message: `No member with that alias — query_family lists the exact aliases (e.g. "Member-A")` };
        }
        toMemberId = hit[0];
        toLabel = labels.get(toMemberId) ?? "the member";
      }
      const { error } = await supabase.from("messages").insert({
        household_id: profile.household_id!,
        from_member: profile.id,
        to_member: toMemberId,
        kind: action.kind,
        title: action.title,
        body: action.body,
      });
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `${action.kind === "instruction" ? "Instruction" : "Suggestion"} sent to ${toLabel}.` };
    }

    case "set_weigh_in_reminder": {
      const { error } = await supabase
        .from("profiles")
        .update({
          ...(action.time_hhmm ? { weigh_in_time: action.time_hhmm } : {}),
          ...(action.target_weight_kg != null ? { target_weight_kg: action.target_weight_kg } : {}),
        })
        .eq("id", profile.id);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: "Weigh-in goal updated." };
    }

    case "tag_recipe_media": {
      const { data: recipe } = await supabase.from("recipes").select("id, title").eq("id", action.recipe_id).maybeSingle();
      if (!recipe) return { ok: false, message: "That recipe was not found." };
      const { error } = await supabase.from("recipe_media").insert({
        recipe_id: action.recipe_id,
        kind: action.kind,
        url: action.url,
        label: action.label ?? null,
      });
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `Tagged a ${action.kind} on “${recipe.title}”.` };
    }

    default:
      return { ok: false, message: "That action is not available." };
  }
}
