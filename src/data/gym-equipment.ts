/**
 * Gym equipment catalogue used by the setup wizard and the exercise library.
 *
 * Images are hotlinked from Wikimedia Commons / Wikipedia (the same pattern
 * the recipe library already uses). Every entry has a local fallback so a
 * dead link never leaves an empty card. Attribution lives in
 * `src/data/gym-equipment-credits.md`.
 *
 * `popularity` sorts the picker: 1 = the machines almost every gym has.
 */

export type EquipmentCategory =
  | "free_weights"
  | "racks_benches"
  | "machines"
  | "cables"
  | "cardio"
  | "accessories";

export interface GymEquipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  popularity: number;
  image: string | null;
  /** What to look for in a gym that names things differently. */
  hint?: string;
}

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  free_weights: "Free weights",
  racks_benches: "Racks & benches",
  machines: "Machines",
  cables: "Cables",
  cardio: "Cardio",
  accessories: "Accessories",
};

const img = (path: string) => `https://upload.wikimedia.org/wikipedia/commons/${path}`;
const thumb = (path: string, file: string, width = 960) =>
  `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/${file}/${width}px-${file}`;

export const GYM_EQUIPMENT: GymEquipment[] = [
  // ── Free weights ──────────────────────────────────────────────────────────
  {
    id: "barbell",
    name: "Olympic barbell",
    category: "free_weights",
    popularity: 1,
    image: img("8/85/Olympic_barbell.jpg"),
    hint: "The long 20 kg bar with 50 mm sleeves",
  },
  {
    id: "dumbbell",
    name: "Dumbbells",
    category: "free_weights",
    popularity: 2,
    image: img("e/e3/TwoDumbbells.JPG"),
  },
  {
    id: "plates",
    name: "Weight plates",
    category: "free_weights",
    popularity: 3,
    image: thumb("0/0e", "Weightlifting.jpg"),
    hint: "Even unlabelled plates can be calibrated by colour and size",
  },
  {
    id: "ez-bar",
    name: "EZ curl bar",
    category: "free_weights",
    popularity: 12,
    image: img("6/68/Barbell-collars-olympic-range.jpg"),
    hint: "The bent bar for curls and skull crushers",
  },
  {
    id: "trap-bar",
    name: "Trap / hex bar",
    category: "free_weights",
    popularity: 18,
    image: thumb("6/60", "New_Jersey_National_Guard_-_46420386382.jpg"),
    hint: "A hexagonal bar you stand inside",
  },
  {
    id: "kettlebell",
    name: "Kettlebells",
    category: "free_weights",
    popularity: 14,
    image: thumb("1/14", "Competition_kettlebell_16_kilo.jpg"),
  },

  // ── Racks & benches ───────────────────────────────────────────────────────
  {
    id: "bench-flat",
    name: "Flat bench",
    category: "racks_benches",
    popularity: 4,
    image: thumb("f/f1", "Weight_benches.webp"),
  },
  {
    id: "squat-rack",
    name: "Squat rack / power rack",
    category: "racks_benches",
    popularity: 5,
    image: img("a/a3/Powerrack.jpg"),
    hint: "Uprights with adjustable J-hooks and safety bars",
  },
  {
    id: "bench-adjustable",
    name: "Adjustable bench",
    category: "racks_benches",
    popularity: 8,
    image: thumb("0/08", "Incline_bench_for_bench_pressing.jpg"),
  },
  {
    id: "pullup-bar",
    name: "Pull-up bar",
    category: "racks_benches",
    popularity: 11,
    image: thumb("6/67", "Marine_Pull-ups.jpg"),
  },
  {
    id: "dip-bars",
    name: "Dip bars / dip station",
    category: "racks_benches",
    popularity: 16,
    image: null,
  },
  {
    id: "preacher-bench",
    name: "Preacher curl bench",
    category: "racks_benches",
    popularity: 24,
    image: null,
  },
  {
    id: "landmine",
    name: "Landmine attachment",
    category: "racks_benches",
    popularity: 28,
    image: null,
    hint: "A pivoting sleeve on the floor for T-bar rows and presses",
  },

  // ── Machines ──────────────────────────────────────────────────────────────
  {
    id: "lat-pulldown",
    name: "Lat pulldown",
    category: "machines",
    popularity: 6,
    image: thumb("2/2a", "Diverging_Lat_Pulldown_Machine.jpg"),
  },
  {
    id: "leg-press",
    name: "Leg press",
    category: "machines",
    popularity: 7,
    image:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/Muscle_Strengthening_at_the_Gym_-_Seated_Leg_Press.webm/250px--Muscle_Strengthening_at_the_Gym_-_Seated_Leg_Press.webm.jpg",
  },
  {
    id: "leg-extension",
    name: "Leg extension",
    category: "machines",
    popularity: 9,
    image: img("3/36/LegExtensionMachineExercise.JPG"),
  },
  {
    id: "leg-curl",
    name: "Leg curl",
    category: "machines",
    popularity: 10,
    image: img("c/c6/LyingLegCurlMachineExercise.JPG"),
  },
  {
    id: "chest-press",
    name: "Chest press machine",
    category: "machines",
    popularity: 13,
    image: thumb("f/f9", "Girl_doing_chest_press_machine_exercise.jpg"),
  },
  {
    id: "shoulder-press",
    name: "Shoulder press machine",
    category: "machines",
    popularity: 15,
    image: img("6/62/Seated-military-shoulder-press-1.png"),
  },
  {
    id: "pec-deck",
    name: "Pec deck / fly machine",
    category: "machines",
    popularity: 17,
    image: thumb("d/d8", "Fly_machine.webp"),
  },
  {
    id: "seated-row",
    name: "Seated cable row",
    category: "machines",
    popularity: 19,
    image: thumb("0/0a", "Woman_using_a_seated_cable_row_machine_at_the_gym.jpg"),
  },
  {
    id: "smith",
    name: "Smith machine",
    category: "machines",
    popularity: 20,
    image: thumb("7/74", "Smith_machine.webp"),
  },
  {
    id: "hack-squat",
    name: "Hack squat",
    category: "machines",
    popularity: 21,
    image: null,
    hint: "Angled sled with shoulder pads",
  },
  {
    id: "calf-raise",
    name: "Calf raise machine",
    category: "machines",
    popularity: 22,
    image: null,
  },
  {
    id: "hip-thrust",
    name: "Hip thrust machine",
    category: "machines",
    popularity: 26,
    image: null,
  },
  {
    id: "assisted-pullup",
    name: "Assisted pull-up machine",
    category: "machines",
    popularity: 30,
    image: null,
  },
  {
    id: "back-extension",
    name: "Back extension bench",
    category: "machines",
    popularity: 32,
    image: null,
  },

  // ── Cables ────────────────────────────────────────────────────────────────
  {
    id: "crossover",
    name: "Cable crossover / functional trainer",
    category: "cables",
    popularity: 23,
    image: img("a/a1/Crossover_cable.jpg"),
    hint: "Two adjustable pulleys, usually with a stack on each side",
  },
  {
    id: "cable",
    name: "Single cable station",
    category: "cables",
    popularity: 25,
    image: img("8/82/CableMachineUprightRow.JPG"),
  },

  // ── Cardio ────────────────────────────────────────────────────────────────
  {
    id: "treadmill",
    name: "Treadmill",
    category: "cardio",
    popularity: 27,
    image: thumb("9/95", "Exercise_Treadmill_Convey_Motion.jpg"),
  },
  {
    id: "elliptical",
    name: "Elliptical",
    category: "cardio",
    popularity: 29,
    image: thumb("d/da", "Elliptical_machine.jpg"),
  },
  {
    id: "bike",
    name: "Stationary bike",
    category: "cardio",
    popularity: 31,
    image: img("0/00/Fahrrad-Ergometer_01_KMJ.jpg"),
  },
  {
    id: "rower",
    name: "Rowing machine",
    category: "cardio",
    popularity: 33,
    image: thumb("d/d8", "Rowing_Machines.jpg"),
  },
  {
    id: "stair",
    name: "Stair climber",
    category: "cardio",
    popularity: 35,
    image: thumb("2/27", "Stair_stepper.webp"),
  },

  // ── Accessories ───────────────────────────────────────────────────────────
  {
    id: "bands",
    name: "Resistance bands",
    category: "accessories",
    popularity: 34,
    image: img("0/02/Trenirovachni_lastici_set.JPG"),
  },
  {
    id: "mat",
    name: "Exercise mat",
    category: "accessories",
    popularity: 36,
    image: null,
  },
  {
    id: "medicine-ball",
    name: "Medicine ball",
    category: "accessories",
    popularity: 37,
    image: thumb("6/61", "Soldier_tosses_a_medicine_ball_while_working_out_DVIDS462753.jpg"),
  },
  {
    id: "stability-ball",
    name: "Stability ball",
    category: "accessories",
    popularity: 38,
    image: img("9/94/Fitball_Group_Fitness_Class.JPG"),
  },
  {
    id: "foam-roller",
    name: "Foam roller",
    category: "accessories",
    popularity: 39,
    image: thumb("3/31", "Wa%C5%82ek_do_masa%C5%BCu3.jpg"),
  },
  {
    id: "ab-wheel",
    name: "Ab wheel",
    category: "accessories",
    popularity: 40,
    image: null,
  },
  {
    id: "jump-rope",
    name: "Jump rope",
    category: "accessories",
    popularity: 41,
    image: thumb("2/24", "Ghanaian_kid_%28skipping_rope%29_06_%28cropped%29.jpg"),
  },
  {
    id: "battle-ropes",
    name: "Battle ropes",
    category: "accessories",
    popularity: 42,
    image: thumb("7/7c", "170331-N-ZY039-015_%2833869515046%29.jpg"),
  },
  {
    id: "punching-bag",
    name: "Punching bag",
    category: "accessories",
    popularity: 43,
    image: thumb("d/dd", "USMC-100509-M-2339L-173.jpg"),
  },
];

export function equipmentById(id: string): GymEquipment | undefined {
  return GYM_EQUIPMENT.find((e) => e.id === id);
}

/** Everything a full commercial gym would have. */
export const FULL_GYM_IDS = GYM_EQUIPMENT.filter((e) => e.id !== "punching-bag").map((e) => e.id);

/** A realistic home setup. */
export const HOME_GYM_IDS = ["dumbbell", "bench-flat", "bench-adjustable", "bands", "mat", "pullup-bar"];

export function equipmentNames(ids: string[]): string[] {
  return ids
    .map((id) => equipmentById(id)?.name)
    .filter((n): n is string => Boolean(n));
}
