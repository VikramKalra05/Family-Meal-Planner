import { z } from "zod";
import { formatIntakeName } from "@/lib/intake";

/**
 * One parsed food item from a freeform meal message.
 *
 * `quantity` is the portion the person actually ate; kcal/macros are totals
 * for that portion — never per unit. Keeping the count in its own field stops
 * the model from collapsing "2 bananas" into a row labelled just "banana".
 */
export const mealParseItemSchema = z.object({
  name: z.string().min(1).max(80),
  quantity: z.string().trim().max(40).optional(),
  kcal: z.coerce.number().min(0).max(3000),
  proteinG: z.coerce.number().min(0).max(300),
  carbsG: z.coerce.number().min(0).max(500),
  fatG: z.coerce.number().min(0).max(300),
  fiberG: z.coerce.number().min(0).max(200).optional(),
});

export const mealParseSchema = z.object({
  items: z.array(mealParseItemSchema).min(1).max(15),
});

export type MealParseItem = z.infer<typeof mealParseItemSchema>;

export const MEAL_PARSE_SYSTEM = `You extract everything a person ATE from a short message (Hinglish, English, or food names with counts).
Respond with ONLY JSON: {"items": [{"name": string, "quantity": string, "kcal": number, "proteinG": number, "carbsG": number, "fatG": number, "fiberG": number}]}.
"quantity" is the portion the person actually ate, copied from their words when given ("2 pieces", "1 plate", "500 ml"). kcal and macros are the TOTAL for that portion, not per unit.
Example: "2 bananas" → {"items":[{"name":"Banana","quantity":"2 pieces","kcal":210,"proteinG":2.6,"carbsG":54,"fatG":0.8,"fiberG":6}]}.
Estimate nutrition for typical Indian home portions. One entry per distinct food item; keep the name short and put the count in "quantity".`;

/** Diary label: "Banana (2 pieces)" — the count survives into the UI. */
export function intakeDescription(item: MealParseItem): string {
  return formatIntakeName(item.name, item.quantity);
}

// ── Quick-log command intents ───────────────────────────────────────────────
// The quick meal box is not only "what did I eat": a user will reasonably type
// "move the soya tikki to breakfast". A parser that only knows food will turn
// that into a new item. This schema makes the intent explicit and gives the
// server a safe path to update an existing diary row instead.

export const MEAL_SLOTS = ["breakfast", "lunch", "snack", "dinner"] as const;
export type MealSlotName = (typeof MEAL_SLOTS)[number];

export const mealLogCommandSchema = z.object({
  action: z.literal("log"),
  items: z.array(mealParseItemSchema).min(1).max(15),
  /** Explicit meal from the message ("2 roti for breakfast"). */
  slot: z.enum(MEAL_SLOTS).optional(),
});

export const mealMoveCommandSchema = z.object({
  action: z.literal("move"),
  /** Food name as it appears in the diary, without the quantity. */
  item: z.string().trim().min(1).max(80),
  fromSlot: z.enum(MEAL_SLOTS).optional(),
  /** Omit when the user only names a day; the review card asks for the target. */
  toSlot: z.enum(MEAL_SLOTS).optional(),
});

export const mealUnsupportedCommandSchema = z.object({
  action: z.literal("unsupported"),
  reason: z.string().trim().min(1).max(160),
});

export const mealCommandSchema = z.discriminatedUnion("action", [
  mealLogCommandSchema,
  mealMoveCommandSchema,
  mealUnsupportedCommandSchema,
]);

export type MealCommand = z.infer<typeof mealCommandSchema>;
export type MealMoveCommand = z.infer<typeof mealMoveCommandSchema>;

export const MEAL_COMMAND_SYSTEM = `You are the quick meal logger for an Indian food diary. Read one short message and decide which ONE thing the user wants.

1) They describe food they ATE → {"action":"log","items":[...],"slot":"breakfast|lunch|snack|dinner"}.
   - "slot" is optional. Include it only when the message says when: "2 roti for breakfast", "dal at lunch".
   - kcal and macros are the TOTAL for the portion eaten, never per unit.
   - "quantity" copies the portion from their words ("2 pieces", "1 plate", "250 g"). Keep the food name short and put the count in quantity.
   - Ignore day/date words ("yesterday", "tomorrow", "last Friday") when naming foods — the app reads the target day separately.
   - Estimate typical Indian home portions. One entry per distinct food.

2) They ask to MOVE an item already in the diary to another meal or day → {"action":"move","item":"<food name>","fromSlot":"lunch","toSlot":"breakfast"}.
   - "fromSlot" is optional if they did not say where it is now.
   - "toSlot" is optional too: if they only name a day ("move the soya tikki to yesterday"), omit toSlot. The app supplies the source day and lets the user pick the target day and meal in the review card.
   - "item" is the food name from the diary, not a quantity.

3) Anything else — deleting, changing macros, asking a question, editing a recipe — → {"action":"unsupported","reason":"<short reason>"}.
   - NEVER turn a move, edit or delete request into a new food log.

Respond with ONLY JSON.

Examples:
"2 roti and dal, plus a mango" → {"action":"log","items":[{"name":"Roti","quantity":"2 pieces","kcal":240,"proteinG":6,"carbsG":48,"fatG":2,"fiberG":4},{"name":"Dal","quantity":"1 bowl","kcal":180,"proteinG":9,"carbsG":28,"fatG":4,"fiberG":6},{"name":"Mango","quantity":"1 medium","kcal":150,"proteinG":1,"carbsG":38,"fatG":0.6,"fiberG":4}]}
"log yesterday's dinner: 2 roti and dal" → {"action":"log","slot":"dinner","items":[{"name":"Roti","quantity":"2 pieces","kcal":240,"proteinG":6,"carbsG":48,"fatG":2,"fiberG":4},{"name":"Dal","quantity":"1 bowl","kcal":180,"proteinG":9,"carbsG":28,"fatG":4,"fiberG":6}]}
"shift the lunch's soya aloo tikki to breakfast" → {"action":"move","item":"soya aloo tikki","fromSlot":"lunch","toSlot":"breakfast"}
"move the soya tikki to yesterday" → {"action":"move","item":"soya aloo tikki"}
"remove the chicken breast" → {"action":"unsupported","reason":"Use the trash icon on the diary row to delete an item."}`;
