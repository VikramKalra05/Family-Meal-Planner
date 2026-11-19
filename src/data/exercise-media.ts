/**
 * Exercise demo images from free-exercise-db (Unlicense / public domain).
 * https://github.com/yuhonas/free-exercise-db
 *
 * Only exercises with a confidently matching image are mapped. The detail
 * page still offers YouTube/Instagram search for every exercise — this is an
 * enhancement, never the only way to see a movement.
 */

export const EXERCISE_IMAGE_FOLDERS: Record<string, string> = {
  "seed:bench-press": "Barbell_Bench_Press_-_Medium_Grip",
  "seed:incline-bench-press": "Barbell_Incline_Bench_Press_-_Medium_Grip",
  "seed:dumbbell-bench-press": "Dumbbell_Bench_Press",
  "seed:incline-dumbbell-press": "Incline_Dumbbell_Press",
  "seed:dumbbell-fly": "Dumbbell_Flyes",
  "seed:cable-fly": "Cable_Crossover",
  "seed:pec-deck-fly": "Butterfly",
  "seed:machine-chest-press": "Machine_Bench_Press",
  "seed:push-up": "Pushups",
  "seed:chest-dip": "Dips_-_Chest_Version",
  "seed:smith-bench-press": "Smith_Machine_Bench_Press",
  "seed:deadlift": "Barbell_Deadlift",
  "seed:barbell-row": "Bent_Over_Barbell_Row",
  "seed:t-bar-row": "T-Bar_Row_with_Handle",
  "seed:one-arm-dumbbell-row": "One-Arm_Dumbbell_Row",
  "seed:seated-cable-row": "Seated_Cable_Rows",
  "seed:lat-pulldown": "Wide-Grip_Lat_Pulldown",
  "seed:pull-up": "Pullups",
  "seed:chin-up": "Chin-Up",
  "seed:assisted-pull-up": "Band_Assisted_Pull-Up",
  "seed:straight-arm-pulldown": "Straight-Arm_Pulldown",
  "seed:face-pull": "Face_Pull",
  "seed:barbell-shrug": "Barbell_Shrug",
  "seed:rack-pull": "Rack_Pulls",
  "seed:back-extension": "Hyperextensions_Back_Extensions",
  "seed:good-morning": "Good_Morning",
  "seed:overhead-press": "Barbell_Shoulder_Press",
  "seed:dumbbell-shoulder-press": "Dumbbell_Shoulder_Press",
  "seed:arnold-press": "Arnold_Dumbbell_Press",
  "seed:lateral-raise": "Side_Lateral_Raise",
  "seed:cable-lateral-raise": "Cable_Seated_Lateral_Raise",
  "seed:front-raise": "Front_Dumbbell_Raise",
  "seed:reverse-pec-deck": "Reverse_Machine_Flyes",
  "seed:machine-shoulder-press": "Machine_Shoulder_Military_Press",
  "seed:upright-row": "Upright_Barbell_Row",
  "seed:barbell-curl": "Barbell_Curl",
  "seed:ez-bar-curl": "EZ-Bar_Curl",
  "seed:dumbbell-curl": "Dumbbell_Bicep_Curl",
  "seed:hammer-curl": "Hammer_Curls",
  "seed:incline-curl": "Incline_Dumbbell_Curl",
  "seed:preacher-curl": "Preacher_Curl",
  "seed:cable-curl": "Standing_Biceps_Cable_Curl",
  "seed:concentration-curl": "Concentration_Curls",
  "seed:close-grip-bench": "Close-Grip_Barbell_Bench_Press",
  "seed:skull-crusher": "EZ-Bar_Skullcrusher",
  "seed:overhead-triceps-extension": "Standing_Dumbbell_Triceps_Extension",
  "seed:cable-pushdown": "Triceps_Pushdown",
  "seed:triceps-kickback": "Tricep_Dumbbell_Kickback",
  "seed:bench-dip": "Bench_Dips",
  "seed:back-squat": "Barbell_Squat",
  "seed:front-squat": "Front_Barbell_Squat",
  "seed:hack-squat": "Hack_Squat",
  "seed:leg-press": "Leg_Press",
  "seed:leg-extension": "Leg_Extensions",
  "seed:walking-lunge": "Dumbbell_Lunges",
  "seed:bulgarian-split-squat": "Split_Squat_with_Dumbbells",
  "seed:goblet-squat": "Goblet_Squat",
  "seed:smith-squat": "Smith_Machine_Squat",
  "seed:step-up": "Dumbbell_Step_Ups",
  "seed:bodyweight-squat": "Bodyweight_Squat",
  "seed:romanian-deadlift": "Romanian_Deadlift",
  "seed:lying-leg-curl": "Lying_Leg_Curls",
  "seed:seated-leg-curl": "Seated_Leg_Curl",
  "seed:barbell-hip-thrust": "Barbell_Hip_Thrust",
  "seed:glute-bridge": "Butt_Lift_Bridge",
  "seed:cable-glute-kickback": "One-Legged_Cable_Kickback",
  "seed:sumo-deadlift": "Sumo_Deadlift",
  "seed:glute-ham-raise": "Glute_Ham_Raise",
  "seed:standing-calf-raise": "Standing_Calf_Raises",
  "seed:seated-calf-raise": "Seated_Calf_Raise",
  "seed:leg-press-calf-raise": "Calf_Press_On_The_Leg_Press_Machine",
  "seed:plank": "Plank",
  "seed:side-plank": "Side_Bridge",
  "seed:hanging-leg-raise": "Hanging_Leg_Raise",
  "seed:cable-crunch": "Cable_Crunch",
  "seed:ab-wheel-rollout": "Ab_Roller",
  "seed:russian-twist": "Russian_Twist",
  "seed:dead-bug": "Dead_Bug",
  "seed:pallof-press": "Pallof_Press",
  "seed:bicycle-crunch": "Air_Bike",
  "seed:clean-and-jerk": "Clean_and_Jerk",
  "seed:snatch": "Snatch",
  "seed:push-press": "Push_Press",
  "seed:kettlebell-swing": "One-Arm_Kettlebell_Swings",
  "seed:farmers-carry": "Farmers_Walk",
  "seed:jump-rope": "Rope_Jumping",
  "seed:rowing-machine": "Rowing_Stationary",
  "seed:treadmill-run": "Running_Treadmill",
  "seed:stationary-bike": "Bicycling_Stationary",
  "seed:elliptical-trainer": "Elliptical_Trainer",
  "seed:stair-climber": "Stairmaster",
  "seed:battle-ropes": "Battling_Ropes",
};

export function exerciseImageFolder(key: string): string | null {
  return EXERCISE_IMAGE_FOLDERS[key] ?? null;
}

/** Primary demo image. jsDelivr CDN keeps the GitHub repo out of the hot path. */
export function exerciseImageUrl(key: string): string | null {
  const folder = EXERCISE_IMAGE_FOLDERS[key];
  if (!folder) return null;
  return `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/${folder}/0.jpg`;
}

/** Fallback if jsDelivr is unavailable. */
export function exerciseImageFallback(key: string): string | null {
  const folder = EXERCISE_IMAGE_FOLDERS[key];
  if (!folder) return null;
  return `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${folder}/0.jpg`;
}
