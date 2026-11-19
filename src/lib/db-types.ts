import type { TargetsResult } from "@/lib/nutrition/types";
import type { MachineStack, PlateDenom } from "@/lib/gym/types";

export type HouseholdRole = "owner" | "member" | "staff";
export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "weight_loss" | "maintenance" | "muscle_gain";
export type DietType = "veg" | "egg" | "non_veg";
export type MealSlot = "breakfast" | "lunch" | "snack" | "dinner";

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  currency: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  household_id: string | null;
  role: HouseholdRole;
  display_name: string;
  sex: Sex | null;
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  diet_type: DietType;
  allergies: string[];
  budget_daily: number | null;
  target_weight_kg: number | null;
  weigh_in_time: string | null;
  chat_language: string | null;
  assistant_privacy_mode: boolean;
  calorie_adjustment_kcal: number;
  targets_cache: TargetsResult | null;
  targets_version: number;
  created_at: string;
  updated_at: string;
}

export interface Ingredient {
  id: string;
  household_id: string | null;
  name: string;
  name_hi: string | null;
  category: string | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number | null;
  cost_per_100g: number | null;
  created_at: string;
}

export interface Recipe {
  id: string;
  household_id: string | null;
  owner_id: string | null;
  title: string;
  description: string | null;
  source_type: "seed" | "user" | "reel";
  source_url: string | null;
  servings: number;
  prep_minutes: number | null;
  steps: string[];
  image_url: string | null;
  is_veg: boolean;
  cuisine: string | null;
  region: string | null;
  verified: boolean;
  confidence: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeNutrition {
  recipe_id: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  method: "computed" | "ai_estimated";
  computed_at: string;
}

export interface WeightLog {
  id: string;
  member_id: string;
  logged_on: string;
  weight_kg: number;
  source: "manual" | "reminder";
  created_at: string;
}

export interface PushSubscription {
  id: string;
  member_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface PushLog {
  id: string;
  member_id: string;
  kind: string;
  day: string;
  sent_at: string;
}

export interface AiUsageEvent {
  id: string;
  user_id: string;
  provider_id: string | null;
  provider_label: string;
  model: string;
  feature: string;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number | null;
  total_tokens: number;
  estimated: boolean;
  cost_usd: number | null;
  created_at: string;
}

// ── Gym ─────────────────────────────────────────────────────────────────────
export interface Gym {
  id: string;
  member_id: string;
  name: string;
  unit: "kg" | "lb";
  bar_weight: number;
  plate_inventory: PlateDenom[];
  bars: { id: string; label: string; weight: number }[];
  machine_stacks: MachineStack[];
  equipment_ids: string[];
  training_days: number[];
  created_at: string;
  updated_at: string;
}

export interface CustomExercise {
  id: string;
  member_id: string;
  name: string;
  aliases: string[];
  primary_muscle: string;
  secondary_muscles: string[];
  equipment: string;
  pattern: string;
  is_unilateral: boolean;
  instructions: string | null;
  tips: string | null;
  media: { type: string; url: string; thumb?: string }[];
  created_at: string;
}

export interface Program {
  id: string;
  member_id: string;
  name: string;
  template: string;
  days_per_week: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgramDay {
  id: string;
  program_id: string;
  day_index: number;
  name: string;
  focus: string[];
}

export interface ProgramExercise {
  id: string;
  program_day_id: string;
  exercise_key: string;
  position: number;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
  increment_kg: number;
  notes: string | null;
}

export interface WorkoutSession {
  id: string;
  member_id: string;
  program_day_id: string | null;
  session_date: string;
  status: "in_progress" | "completed" | "skipped";
  readiness: Record<string, unknown> | null;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  client_updated_at: string;
  created_at: string;
}

export interface SetLog {
  id: string;
  session_id: string;
  member_id: string;
  exercise_key: string;
  set_index: number;
  weight_kg: number;
  display_weight: number | null;
  display_unit: "kg" | "lb";
  plates: { label: string; qty: number }[] | null;
  stack_position: number | null;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  is_pr: boolean;
  notes: string | null;
  client_updated_at: string;
  created_at: string;
  deleted_at: string | null;
}

export interface BodyMeasurement {
  id: string;
  member_id: string;
  measured_on: string;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  hip_cm: number | null;
  neck_cm: number | null;
  notes: string | null;
  created_at: string;
}

export interface ProgressPhoto {
  id: string;
  member_id: string;
  taken_on: string;
  storage_path: string;
  pose: "front" | "side" | "back";
  note: string | null;
  created_at: string;
}

export interface AdaptiveAdjustment {
  id: string;
  member_id: string;
  effective_on: string;
  delta_kcal: number;
  total_kcal: number;
  reason: string;
  signals: Record<string, unknown>;
  applied_at: string;
}

export interface StreakFreeze {
  id: string;
  member_id: string;
  used_on: string;
  note: string | null;
  created_at: string;
}
