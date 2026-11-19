import { z } from "zod";
import { draftRecipeSchema } from "@/lib/ai/recipes";

/**
 * Assistant action protocol. The model must answer every turn as JSON
 * `{ reply, actions? }` where each action comes from this closed enum — the
 * zod schema is the whitelist, so nothing outside it can ever execute.
 *
 * Two tiers:
 *  - READ actions run automatically (grounding data for the answer).
 *  - MUTATION actions stop the loop and become a confirmation card; the
 *    confirmed action is re-validated against this same schema before it
 *    executes, so a crafted or replayed payload can never skip validation.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)");
const httpUrl = z
  .string()
  .url("Must be a valid URL")
  .refine((v) => /^https?:\/\//i.test(v), "Only http(s) URLs are allowed")
  .max(600);
const uuid = z.string().uuid();

const slotEnum = z.enum(["breakfast", "lunch", "snack", "dinner"]);

// ── Read actions (auto-executed) ────────────────────────────────────────────

const queryWeek = z.object({
  action: z.literal("query_week"),
  /** Monday of the week to inspect; defaults to the current week (IST). */
  week_start: isoDate.optional(),
});

const queryToday = z.object({ action: z.literal("query_today") });

const queryIntakeHistory = z.object({
  action: z.literal("query_intake_history"),
  days: z.coerce.number().int().min(1).max(30).optional(),
});

const queryIntakeDay = z.object({
  action: z.literal("query_intake_day"),
  /** Day to inspect; defaults to today (IST). */
  date: isoDate.optional(),
});

const searchRecipes = z.object({
  action: z.literal("search_recipes"),
  q: z.string().trim().min(1).max(60).optional(),
  veg: z.enum(["any", "veg", "non_veg"]).optional(),
  max_kcal: z.coerce.number().min(50).max(2000).optional(),
  max_prep: z.coerce.number().int().min(5).max(240).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

const recipeDetail = z.object({
  action: z.literal("recipe_detail"),
  /** Recipe id (preferred — read actions return them) or an exact-ish title. */
  recipe_ref: z.string().trim().min(1).max(120),
});

const queryPantry = z.object({ action: z.literal("query_pantry") });
const queryShopping = z.object({ action: z.literal("query_shopping") });
const queryWeight = z.object({ action: z.literal("query_weight") });
const queryFamily = z.object({ action: z.literal("query_family") });

const queryUsage = z.object({
  action: z.literal("query_usage"),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(),
});

const suggestDishes = z.object({
  action: z.literal("suggest_dishes"),
  slot: slotEnum,
  /** Member alias from query_family / the snapshot (e.g. "Member-A"); omit for the whole family. */
  member: z.string().trim().min(1).max(60).optional(),
  max_kcal: z.coerce.number().min(50).max(2000).optional(),
});

/** In-app navigation ("take me to Progress", "open that recipe"). */
const openPage = z
  .object({
    action: z.literal("open_page"),
    page: z.enum([
      "today",
      "week",
      "recipes",
      "pantry",
      "shopping",
      "progress",
      "family",
      "settings",
      "recipe",
    ]),
    /** Recipe id or title when page = "recipe". */
    recipe_ref: z.string().trim().min(1).max(120).optional(),
  })
  .refine((v) => v.page !== "recipe" || v.recipe_ref != null, {
    message: "recipe_ref is required for the recipe page",
  });

// ── Mutation actions (confirmation required) ────────────────────────────────

const logMeal = z.object({
  action: z.literal("log_meal"),
  /** Freeform description of what was eaten — parsed and logged. */
  text: z.string().trim().min(2).max(300),
  slot: slotEnum.optional(),
});

const logWeight = z.object({
  action: z.literal("log_weight"),
  weight_kg: z.coerce.number().min(25).max(250),
});

const addRecipe = z.object({
  action: z.literal("add_recipe"),
  draft: draftRecipeSchema,
});

const generateWeek = z.object({
  action: z.literal("generate_week"),
  week_start: isoDate.optional(),
});

const swapDish = z.object({
  action: z.literal("swap_dish"),
  entry_id: uuid,
  new_recipe_id: uuid,
});

const markEaten = z.object({ action: z.literal("mark_eaten"), entry_id: uuid });

const removePlanEntry = z.object({ action: z.literal("remove_plan_entry"), entry_id: uuid });

const addPantryItem = z.object({
  action: z.literal("add_pantry_item"),
  name: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().min(0.1).max(100000),
  unit: z.enum(["g", "kg", "ml", "l", "piece"]),
});

const removePantryItem = z.object({
  action: z.literal("remove_pantry_item"),
  pantry_item_id: uuid,
});

const buildShoppingList = z.object({
  action: z.literal("build_shopping_list"),
  week_start: isoDate.optional(),
});

const toggleShoppingItem = z.object({
  action: z.literal("toggle_shopping_item"),
  /** Name (or partial name) of the list item to flip; first match wins. */
  item_name: z.string().trim().min(1).max(80),
});

const sendFamilyMessage = z.object({
  action: z.literal("send_family_message"),
  /** Member alias to message (e.g. "Member-A"); omit to send to the whole family. */
  to_member: z.string().trim().min(1).max(60).optional(),
  kind: z.enum(["suggestion", "instruction"]),
  title: z.string().trim().min(2).max(80),
  body: z.string().trim().min(2).max(600),
});

const setWeighInReminder = z
  .object({
    action: z.literal("set_weigh_in_reminder"),
    time_hhmm: hhmm.optional(),
    target_weight_kg: z.coerce.number().min(25).max(250).optional(),
  })
  .refine((v) => v.time_hhmm != null || v.target_weight_kg != null, {
    message: "Provide a time and/or a target weight",
  });

const tagRecipeMedia = z.object({
  action: z.literal("tag_recipe_media"),
  recipe_id: uuid,
  kind: z.enum(["video", "image"]),
  url: httpUrl,
  label: z.string().trim().min(1).max(60).optional(),
});

// ── Intake repair (the "that was yesterday's food" set) ─────────────────────

const addIntakeItem = z.object({
  action: z.literal("add_intake_item"),
  description: z.string().trim().min(1).max(120),
  kcal: z.coerce.number().min(0).max(5000),
  protein_g: z.coerce.number().min(0).max(400).optional(),
  carbs_g: z.coerce.number().min(0).max(600).optional(),
  fat_g: z.coerce.number().min(0).max(400).optional(),
  fiber_g: z.coerce.number().min(0).max(200).optional(),
  slot: slotEnum.optional(),
  date: isoDate.optional(),
});

const updateIntakeItem = z
  .object({
    action: z.literal("update_intake_item"),
    item_id: uuid,
    description: z.string().trim().min(1).max(120).optional(),
    kcal: z.coerce.number().min(0).max(5000).optional(),
    protein_g: z.coerce.number().min(0).max(400).optional(),
    carbs_g: z.coerce.number().min(0).max(600).optional(),
    fat_g: z.coerce.number().min(0).max(400).optional(),
    fiber_g: z.coerce.number().min(0).max(200).optional(),
    slot: slotEnum.optional(),
    date: isoDate.optional(),
  })
  .refine(
    (v) =>
      v.description != null ||
      v.kcal != null ||
      v.protein_g != null ||
      v.carbs_g != null ||
      v.fat_g != null ||
      v.fiber_g != null ||
      v.slot != null ||
      v.date != null,
    { message: "Provide at least one field to update" },
  );

const deleteIntakeItem = z.object({
  action: z.literal("delete_intake_item"),
  item_id: uuid,
});

const resetIntakeDay = z.object({
  action: z.literal("reset_intake_day"),
  date: isoDate.optional(),
  slot: slotEnum.optional(),
});

// ── Everything else the app can do ──────────────────────────────────────────

const deleteWeightLog = z.object({
  action: z.literal("delete_weight_log"),
  date: isoDate.optional(),
});

const deleteRecipe = z.object({
  action: z.literal("delete_recipe"),
  recipe_id: uuid,
});

const untagRecipeMedia = z.object({
  action: z.literal("untag_recipe_media"),
  media_id: uuid,
});

const addShoppingItem = z.object({
  action: z.literal("add_shopping_item"),
  item_name: z.string().trim().min(1).max(80),
  quantity: z.string().trim().min(1).max(40).optional(),
});

const removeShoppingItem = z.object({
  action: z.literal("remove_shopping_item"),
  item_name: z.string().trim().min(1).max(80),
});

const setPantryQuantity = z.object({
  action: z.literal("set_pantry_quantity"),
  pantry_item_id: uuid,
  quantity: z.coerce.number().min(0).max(100000),
});

const updateProfilePrefs = z
  .object({
    action: z.literal("update_profile_prefs"),
    goal: z.enum(["weight_loss", "maintenance", "muscle_gain"]).optional(),
    diet_type: z.enum(["veg", "egg", "non_veg"]).optional(),
    activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional(),
    budget_daily: z.coerce.number().min(0).max(100000).optional(),
    target_weight_kg: z.coerce.number().min(25).max(250).optional(),
    weigh_in_time: hhmm.optional(),
  })
  .refine(
    (v) =>
      v.goal != null ||
      v.diet_type != null ||
      v.activity_level != null ||
      v.budget_daily != null ||
      v.target_weight_kg != null ||
      v.weigh_in_time != null,
    { message: "Provide at least one preference to change" },
  );

export const assistantActionSchema = z.discriminatedUnion("action", [
  queryWeek,
  queryToday,
  queryIntakeHistory,
  queryIntakeDay,
  searchRecipes,
  recipeDetail,
  queryPantry,
  queryShopping,
  queryWeight,
  queryFamily,
  queryUsage,
  suggestDishes,
  openPage,
  logMeal,
  logWeight,
  addRecipe,
  generateWeek,
  swapDish,
  markEaten,
  removePlanEntry,
  addPantryItem,
  removePantryItem,
  buildShoppingList,
  toggleShoppingItem,
  sendFamilyMessage,
  setWeighInReminder,
  tagRecipeMedia,
  addIntakeItem,
  updateIntakeItem,
  deleteIntakeItem,
  resetIntakeDay,
  deleteWeightLog,
  deleteRecipe,
  untagRecipeMedia,
  addShoppingItem,
  removeShoppingItem,
  setPantryQuantity,
  updateProfilePrefs,
]);

export type AssistantAction = z.infer<typeof assistantActionSchema>;
export type AssistantActionName = AssistantAction["action"];

export const READ_ACTIONS: ReadonlySet<AssistantActionName> = new Set([
  "query_week",
  "query_today",
  "query_intake_history",
  "query_intake_day",
  "search_recipes",
  "recipe_detail",
  "query_pantry",
  "query_shopping",
  "query_weight",
  "query_family",
  "query_usage",
  "suggest_dishes",
  "open_page",
]);

export function isReadAction(action: AssistantAction): boolean {
  return READ_ACTIONS.has(action.action);
}

/** The model's answer shape for one turn. */
export const chatTurnSchema = z.object({
  reply: z.string().min(1).max(2000),
  actions: z.array(assistantActionSchema).max(3).optional(),
});
export type ChatTurn = z.infer<typeof chatTurnSchema>;

/** One-line human summary of a proposed action (confirmation card title). */
export function summarizeAction(action: AssistantAction): string {
  switch (action.action) {
    case "log_meal":
      return `Log meal: “${truncate(action.text, 60)}”${action.slot ? ` (${action.slot})` : ""}`;
    case "log_weight":
      return `Log today's weigh-in: ${action.weight_kg} kg`;
    case "add_recipe":
      return `Add recipe “${action.draft.title}” (${action.draft.ingredients.length} ingredients)`;
    case "generate_week":
      return `Regenerate the week plan${action.week_start ? ` for ${action.week_start}` : ""}`;
    case "swap_dish":
      return "Swap the planned dish for the selected recipe (re-portioned automatically)";
    case "mark_eaten":
      return "Mark that planned meal as eaten (writes it to your intake)";
    case "remove_plan_entry":
      return "Remove that planned meal from the week";
    case "add_pantry_item":
      return `Add pantry item: ${action.name} — ${action.quantity} ${action.unit}`;
    case "remove_pantry_item":
      return "Remove that pantry item";
    case "build_shopping_list":
      return `Build the shopping list${action.week_start ? ` for ${action.week_start}` : " from this week's plan"}`;
    case "toggle_shopping_item":
      return `Check off “${truncate(action.item_name, 50)}” on the shopping list`;
    case "send_family_message": {
      const to = action.to_member ?? "the whole family";
      return `Send ${action.kind} to ${to}: “${truncate(action.title, 50)}”`;
    }
    case "set_weigh_in_reminder": {
      const parts = [
        action.time_hhmm ? `daily at ${action.time_hhmm}` : null,
        action.target_weight_kg != null ? `target ${action.target_weight_kg} kg` : null,
      ].filter(Boolean);
      return `Update weigh-in goal: ${parts.join(", ")}`;
    }
    case "tag_recipe_media":
      return `Tag a ${action.kind} on that recipe`;
    case "add_intake_item":
      return `Log ${action.description} — ${Math.round(action.kcal)} kcal${action.slot ? ` (${action.slot})` : ""}`;
    case "update_intake_item":
      return `Edit that logged food${action.description ? ` → “${truncate(action.description, 50)}”` : ""}`;
    case "delete_intake_item":
      return "Delete that logged food item";
    case "reset_intake_day":
      return `Clear intake for ${action.date ?? "today"}${action.slot ? ` (${action.slot})` : " (whole day)"}`;
    case "delete_weight_log":
      return `Delete the weigh-in for ${action.date ?? "today"}`;
    case "delete_recipe":
      return "Delete that recipe (only recipes you own)";
    case "untag_recipe_media":
      return "Remove that saved video/photo tag";
    case "add_shopping_item":
      return `Add “${truncate(action.item_name, 50)}” to the shopping list${action.quantity ? ` (${action.quantity})` : ""}`;
    case "remove_shopping_item":
      return `Remove “${truncate(action.item_name, 50)}” from the shopping list`;
    case "set_pantry_quantity":
      return `Set that pantry item to ${action.quantity}`;
    case "update_profile_prefs": {
      const parts = [
        action.goal ? `goal ${action.goal.replace("_", " ")}` : null,
        action.diet_type ? `diet ${action.diet_type.replace("_", " ")}` : null,
        action.activity_level ? `activity ${action.activity_level.replace("_", " ")}` : null,
        action.budget_daily != null ? `budget ₹${action.budget_daily}/day` : null,
        action.target_weight_kg != null ? `target ${action.target_weight_kg} kg` : null,
        action.weigh_in_time ? `weigh-in ${action.weigh_in_time}` : null,
      ].filter(Boolean);
      return `Update your preferences: ${parts.join(", ")}`;
    }
    default: {
      // Reads never reach the card, but keep the exhaustiveness honest.
      const label = (action as { action: string }).action.replaceAll("_", " ");
      return `Run: ${label}`;
    }
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
