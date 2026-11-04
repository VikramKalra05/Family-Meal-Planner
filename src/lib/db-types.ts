import type { TargetsResult } from "@/lib/nutrition/types";

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
