/**
 * India-first seed recipe library. Each recipe lists RAW ingredient weights
 * in grams for the stated servings; per-serving nutrition is computed from
 * the master ingredient table at seed time (never hand-entered), so values
 * stay consistent with the ingredient data.
 *
 * Frying oil is modeled as an explicit absorbed-quantity item.
 * Item tuples: [ingredientName, grams, note?]
 */

export interface SeedRecipe {
  title: string;
  description: string;
  cuisine: string;
  is_veg: boolean;
  servings: number;
  prep_minutes: number;
  items: [string, number, string?][];
  steps: string[];
}

export const SEED_RECIPES: SeedRecipe[] = [
  // ── Breakfast ───────────────────────────────────────────────────────────────
  {
    title: "Kanda Poha",
    description: "Maharashtrian flattened-rice breakfast with potato, peanuts and lemon.",
    cuisine: "maharashtrian", is_veg: true, servings: 2, prep_minutes: 20,
    items: [
      ["poha (thick)", 100], ["onion", 50], ["potato", 60], ["groundnut (raw)", 20],
      ["cooking oil (refined)", 10], ["mustard seeds", 3], ["curry leaves", 3],
      ["green chilli", 5], ["turmeric powder", 1], ["lemon", 15], ["sugar", 3], ["salt", 3],
    ],
    steps: [
      "Rinse poha, drain and rest 5 minutes until soft.",
      "Fry peanuts in oil, set aside. Splutter mustard seeds and curry leaves.",
      "Saute onion, green chilli and potato cubes until cooked.",
      "Add turmeric, salt, sugar, then fold in poha gently.",
      "Finish with peanuts and lemon juice.",
    ],
  },
  {
    title: "Rava Upma",
    description: "South Indian semolina upma with vegetables and cashews.",
    cuisine: "south-indian", is_veg: true, servings: 2, prep_minutes: 20,
    items: [
      ["rava (semolina)", 100], ["cooking oil (refined)", 12], ["mustard seeds", 3],
      ["urad dal (split black gram)", 8], ["onion", 50], ["green chilli", 5],
      ["ginger", 5], ["curry leaves", 3], ["carrot", 30], ["green peas", 20],
      ["cashew", 8], ["salt", 3],
    ],
    steps: [
      "Dry-roast rava until aromatic; set aside.",
      "Heat oil, splutter mustard, urad dal, curry leaves and cashews.",
      "Saute onion, chilli, ginger; add carrot and peas.",
      "Pour 2 cups boiling water, add salt, then rain in rava stirring.",
      "Cover 3 minutes and fluff.",
    ],
  },
  {
    title: "Idli (8 pieces)",
    description: "Steamed fermented rice-and-urad cakes, the classic South Indian breakfast.",
    cuisine: "south-indian", is_veg: true, servings: 4, prep_minutes: 15,
    items: [
      ["idli rava (cream of rice)", 160], ["urad dal (skinless, for batter)", 60], ["salt", 4],
    ],
    steps: [
      "Soak urad dal and idli rava 4 hours; grind dal fluffy, combine with rava.",
      "Ferment batter overnight.",
      "Mix salt, ladle into greased idli plates.",
      "Steam 10–12 minutes; rest 2 minutes before unmoulding.",
    ],
  },
  {
    title: "Plain Dosa (4 pieces)",
    description: "Crisp fermented rice-lentil crepes.",
    cuisine: "south-indian", is_veg: true, servings: 2, prep_minutes: 15,
    items: [
      ["rice (white, raw)", 100], ["urad dal (skinless, for batter)", 40],
      ["cooking oil (refined)", 12], ["salt", 3],
    ],
    steps: [
      "Soak rice and dal 4–6 hours; grind to a smooth batter and ferment overnight.",
      "Add salt and thin the batter with water.",
      "Spread a ladle thin on a hot tawa; drizzle oil.",
      "Cook to golden crisp and fold.",
    ],
  },
  {
    title: "Masala Dosa (2 pieces)",
    description: "Dosa with the classic spiced potato filling.",
    cuisine: "south-indian", is_veg: true, servings: 2, prep_minutes: 25,
    items: [
      ["rice (white, raw)", 100], ["urad dal (skinless, for batter)", 40],
      ["cooking oil (refined)", 14], ["salt", 3],
      ["potato", 150], ["onion", 50], ["mustard seeds", 3], ["curry leaves", 3],
      ["turmeric powder", 1], ["green chilli", 5], ["ginger", 5],
    ],
    steps: [
      "Ferment dosa batter (see Plain Dosa).",
      "Boil and roughly mash potatoes.",
      "Temper mustard, curry leaves; saute onion, chilli, ginger.",
      "Add turmeric, potatoes, salt; splash water for a soft bharta.",
      "Spread dosa thin, add filling, fold and serve.",
    ],
  },
  {
    title: "Moong Dal Chilla",
    description: "Protein-rich savoury crepes from soaked yellow moong.",
    cuisine: "north-indian", is_veg: true, servings: 2, prep_minutes: 25,
    items: [
      ["moong dal (split yellow)", 120], ["onion", 40], ["green chilli", 5],
      ["ginger", 5], ["coriander leaves", 10], ["cooking oil (refined)", 10], ["salt", 3],
    ],
    steps: [
      "Soak moong dal 3–4 hours; grind to a smooth thick batter.",
      "Mix in onion, chilli, ginger, coriander, salt.",
      "Spread on a medium-hot tawa; drizzle oil around edges.",
      "Cook both sides to golden.",
    ],
  },
  {
    title: "Besan Chilla",
    description: "Quick gram-flour pancakes with onion and tomato.",
    cuisine: "north-indian", is_veg: true, servings: 2, prep_minutes: 15,
    items: [
      ["besan (gram flour)", 100], ["onion", 40], ["tomato", 40], ["green chilli", 5],
      ["coriander leaves", 10], ["cooking oil (refined)", 10], ["salt", 3],
    ],
    steps: [
      "Whisk besan with water to a pouring consistency; rest 10 minutes.",
      "Add onion, tomato, chilli, coriander, salt.",
      "Pour and spread on a hot tawa; drizzle oil.",
      "Cook both sides until spotted brown.",
    ],
  },
  {
    title: "Aloo Paratha (3 pieces)",
    description: "Whole-wheat flatbreads stuffed with spiced potato.",
    cuisine: "punjabi", is_veg: true, servings: 2, prep_minutes: 30,
    items: [
      ["atta (whole wheat flour)", 120], ["potato", 120], ["onion", 30],
      ["green chilli", 5], ["coriander leaves", 10], ["ghee", 15], ["salt", 3],
    ],
    steps: [
      "Knead a soft dough with water; rest 15 minutes.",
      "Mix mashed potato, onion, chilli, coriander, salt.",
      "Roll dough, stuff, seal and roll gently.",
      "Roast on a hot tawa with ghee until golden on both sides.",
    ],
  },
  {
    title: "Plain Paratha (3 pieces)",
    description: "Layered whole-wheat flatbread roasted in ghee.",
    cuisine: "north-indian", is_veg: true, servings: 2, prep_minutes: 20,
    items: [["atta (whole wheat flour)", 120], ["ghee", 12], ["salt", 2]],
    steps: [
      "Knead dough; rest 15 minutes.",
      "Roll, brush ghee, fold into layers, roll again.",
      "Roast on a hot tawa with ghee until crisp and browned.",
    ],
  },
  {
    title: "Methi Thepla (4 pieces)",
    description: "Gujarati fenugreek flatbreads with curd.",
    cuisine: "gujarati", is_veg: true, servings: 3, prep_minutes: 25,
    items: [
      ["atta (whole wheat flour)", 120], ["methi leaves (fenugreek)", 40],
      ["curd (dahi)", 30], ["cooking oil (refined)", 12], ["turmeric powder", 1],
      ["red chilli powder", 2], ["salt", 3],
    ],
    steps: [
      "Mix chopped methi, curd, oil, spices and salt.",
      "Knead into a dough with the flour; rest 10 minutes.",
      "Roll thin and roast on a tawa with a little oil.",
    ],
  },
  {
    title: "Oats Porridge",
    description: "Warm milk oats with almonds — a light, high-fibre breakfast.",
    cuisine: "continental", is_veg: true, servings: 1, prep_minutes: 10,
    items: [["oats (rolled)", 50], ["milk (cow, full cream)", 250], ["sugar", 8], ["almond", 5]],
    steps: ["Simmer oats in milk 5 minutes.", "Sweeten, top with sliced almonds."],
  },
  {
    title: "Sabudana Khichdi",
    description: "Sago pearls tossed with potato and peanuts — a fasting favourite.",
    cuisine: "maharashtrian", is_veg: true, servings: 2, prep_minutes: 25,
    items: [
      ["sabudana (sago)", 100], ["potato", 80], ["groundnut (raw)", 25],
      ["green chilli", 5], ["cumin seeds", 3], ["ghee", 12], ["salt", 3], ["lemon", 10],
    ],
    steps: [
      "Soak sabudana until soft; roast and crush peanuts.",
      "Fry potato cubes in ghee with cumin and chilli.",
      "Fold in sabudana and peanuts; toss 3–4 minutes.",
      "Finish with lemon juice.",
    ],
  },
  {
    title: "Egg Bhurji (4 eggs)",
    description: "Indian-style spiced scrambled eggs.",
    cuisine: "north-indian", is_veg: false, servings: 2, prep_minutes: 15,
    items: [
      ["egg (whole)", 200], ["onion", 50], ["tomato", 50], ["green chilli", 5],
      ["cooking oil (refined)", 10], ["turmeric powder", 1], ["salt", 3],
      ["coriander leaves", 10],
    ],
    steps: [
      "Saute onion, chilli; add tomato and cook soft.",
      "Add turmeric and salt.",
      "Pour beaten eggs, scramble on low heat.",
      "Finish with coriander.",
    ],
  },
  {
    title: "Sprouts Chaat",
    description: "No-cook moong sprout salad with lemon and chaat masala.",
    cuisine: "north-indian", is_veg: true, servings: 2, prep_minutes: 10,
    items: [
      ["sprouted moong", 200], ["onion", 30], ["tomato", 40], ["cucumber", 50],
      ["chaat masala", 2], ["lemon", 15], ["coriander leaves", 10],
    ],
    steps: ["Steam sprouts 5 minutes (optional).", "Toss everything together and serve."],
  },

  // ── Dals & vegetarian mains ────────────────────────────────────────────────
  {
    title: "Dal Tadka",
    description: "Yellow dal with a ghee-cumin-garlic tempering.",
    cuisine: "north-indian", is_veg: true, servings: 3, prep_minutes: 30,
    items: [
      ["toor dal (split pigeon pea)", 150], ["onion", 50], ["tomato", 60], ["ghee", 10],
      ["cumin seeds", 3], ["turmeric powder", 1], ["red chilli powder", 2], ["garlic", 8],
      ["green chilli", 5], ["salt", 4], ["coriander leaves", 10],
    ],
    steps: [
      "Pressure-cook dal with turmeric and salt.",
      "Temper cumin and garlic in ghee; add onion, chilli, tomato.",
      "Cook masala soft, combine with dal and simmer 5 minutes.",
    ],
  },
  {
    title: "Dal Fry",
    description: "Mixed dal cooked soft and finished with a butter masala.",
    cuisine: "north-indian", is_veg: true, servings: 3, prep_minutes: 35,
    items: [
      ["toor dal (split pigeon pea)", 120], ["masoor dal (split red lentil)", 60],
      ["onion", 60], ["tomato", 70], ["butter", 10], ["cumin seeds", 3],
      ["garam masala", 2], ["turmeric powder", 1], ["red chilli powder", 2],
      ["salt", 4], ["coriander leaves", 10],
    ],
    steps: [
      "Cook both dals with turmeric and salt.",
      "Fry cumin, onion, tomato in butter; add masalas.",
      "Combine and simmer 5 minutes.",
    ],
  },
  {
    title: "Moong Dal Khichdi",
    description: "One-pot rice and moong comfort food with vegetables.",
    cuisine: "north-indian", is_veg: true, servings: 2, prep_minutes: 30,
    items: [
      ["rice (white, raw)", 100], ["moong dal (split yellow)", 80], ["ghee", 12],
      ["cumin seeds", 3], ["turmeric powder", 1], ["asafoetida (hing)", 1],
      ["green peas", 30], ["carrot", 30], ["onion", 40], ["salt", 4],
    ],
    steps: [
      "Wash rice and dal together.",
      "Temper cumin and hing in ghee; saute onion and vegetables.",
      "Add rice-dal, turmeric, salt and 3 cups water.",
      "Pressure-cook 3 whistles; rest and fluff.",
    ],
  },
  {
    title: "Punjabi Rajma",
    description: "Kidney beans simmered in an onion-tomato masala.",
    cuisine: "punjabi", is_veg: true, servings: 3, prep_minutes: 50,
    items: [
      ["rajma (kidney beans, raw)", 150], ["onion", 70], ["tomato", 90],
      ["cooking oil (refined)", 12], ["ginger", 8], ["garlic", 8], ["garam masala", 2],
      ["coriander powder", 3], ["red chilli powder", 2], ["salt", 5],
      ["coriander leaves", 10],
    ],
    steps: [
      "Soak rajma overnight; pressure-cook until tender.",
      "Brown onion; add ginger-garlic, tomato and dry masalas.",
      "Cook masala until oil separates; add beans and cooking liquid.",
      "Simmer 15 minutes to thicken.",
    ],
  },
  {
    title: "Chole (Chana Masala)",
    description: "Chickpeas in a dark, tangy Punjabi gravy.",
    cuisine: "punjabi", is_veg: true, servings: 3, prep_minutes: 50,
    items: [
      ["kabuli chana (chickpeas, raw)", 150], ["onion", 70], ["tomato", 90],
      ["cooking oil (refined)", 12], ["ginger", 8], ["garlic", 8], ["garam masala", 2],
      ["coriander powder", 3], ["red chilli powder", 2], ["salt", 5],
      ["coriander leaves", 10],
    ],
    steps: [
      "Soak and pressure-cook chickpeas with salt.",
      "Fry onion, ginger-garlic, tomato and masalas.",
      "Add chickpeas with liquid; simmer 15 minutes.",
      "Mash a few chickpeas to thicken.",
    ],
  },
  {
    title: "Palak Paneer",
    description: "Cottage cheese cubes in a smooth spinach gravy.",
    cuisine: "punjabi", is_veg: true, servings: 3, prep_minutes: 35,
    items: [
      ["palak (spinach)", 250], ["paneer", 150], ["onion", 50], ["tomato", 60],
      ["garlic", 8], ["green chilli", 5], ["fresh cream", 15], ["cooking oil (refined)", 10],
      ["cumin seeds", 2], ["salt", 4], ["kasuri methi (dried)", 2],
    ],
    steps: [
      "Blanch spinach 2 minutes; blend coarse with chilli.",
      "Fry cumin, garlic, onion; add tomato and cook soft.",
      "Add spinach puree and simmer 5 minutes.",
      "Fold in paneer cubes, cream, kasuri methi, salt.",
    ],
  },
  {
    title: "Matar Paneer",
    description: "Paneer and peas in an onion-tomato-cashew gravy.",
    cuisine: "punjabi", is_veg: true, servings: 3, prep_minutes: 35,
    items: [
      ["paneer", 150], ["green peas", 100], ["onion", 60], ["tomato", 80],
      ["cashew", 15], ["cooking oil (refined)", 12], ["garam masala", 2],
      ["turmeric powder", 1], ["red chilli powder", 2], ["salt", 4],
      ["kasuri methi (dried)", 2], ["fresh cream", 10],
    ],
    steps: [
      "Blend fried onion, tomato, cashew into a smooth paste.",
      "Fry the paste in oil with dry masalas.",
      "Add peas and water; simmer 8 minutes.",
      "Fold in paneer, cream, kasuri methi.",
    ],
  },
  {
    title: "Shahi Paneer",
    description: "Rich, mildly sweet paneer in a cashew-milk gravy.",
    cuisine: "punjabi", is_veg: true, servings: 3, prep_minutes: 35,
    items: [
      ["paneer", 150], ["cashew", 25], ["onion", 60], ["tomato", 60],
      ["milk (cow, full cream)", 100], ["butter", 15], ["garam masala", 2],
      ["green cardamom", 1], ["salt", 4], ["fresh cream", 15],
    ],
    steps: [
      "Soak cashews; blend with fried onion and tomato.",
      "Cook the paste in butter with cardamom and garam masala.",
      "Add milk and simmer to a thick gravy.",
      "Fold in paneer and cream.",
    ],
  },
  {
    title: "Aloo Gobi",
    description: "Dry potato-cauliflower sabzi with ginger.",
    cuisine: "north-indian", is_veg: true, servings: 3, prep_minutes: 30,
    items: [
      ["potato", 200], ["cauliflower", 250], ["onion", 60], ["tomato", 60],
      ["cooking oil (refined)", 12], ["turmeric powder", 1], ["coriander powder", 3],
      ["red chilli powder", 2], ["garam masala", 2], ["ginger", 8], ["salt", 4],
      ["coriander leaves", 10],
    ],
    steps: [
      "Fry onion and ginger in oil; add tomato and masalas.",
      "Add potato and cauliflower florets; toss to coat.",
      "Cover and cook on low 15 minutes, stirring once.",
    ],
  },
  {
    title: "Aloo Mutter",
    description: "Potatoes and peas in a home-style tomato gravy.",
    cuisine: "north-indian", is_veg: true, servings: 3, prep_minutes: 30,
    items: [
      ["potato", 250], ["green peas", 80], ["onion", 60], ["tomato", 70],
      ["cooking oil (refined)", 12], ["cumin seeds", 3], ["turmeric powder", 1],
      ["coriander powder", 3], ["red chilli powder", 2], ["garam masala", 2],
      ["salt", 4], ["coriander leaves", 10],
    ],
    steps: [
      "Temper cumin; brown onion, cook tomato with masalas.",
      "Add potatoes, peas and 1.5 cups water.",
      "Simmer covered 15 minutes until gravy thickens.",
    ],
  },
  {
    title: "Bhindi Masala",
    description: "Dry okra sabzi with onion — no sliminess, all crisp.",
    cuisine: "north-indian", is_veg: true, servings: 2, prep_minutes: 25,
    items: [
      ["bhindi (okra)", 250], ["onion", 60], ["tomato", 50], ["cooking oil (refined)", 15],
      ["coriander powder", 3], ["red chilli powder", 2], ["turmeric powder", 1],
      ["garam masala", 2], ["salt", 3], ["lemon", 10],
    ],
    steps: [
      "Fry okra in hot oil until edges brown; remove.",
      "Saute onion and tomato with masalas.",
      "Return okra; toss 3 minutes; finish with lemon.",
    ],
  },
  {
    title: "Jeera Aloo",
    description: "Cumin-crusted boiled potatoes — a 15-minute sabzi.",
    cuisine: "north-indian", is_veg: true, servings: 2, prep_minutes: 15,
    items: [
      ["potato", 250], ["cooking oil (refined)", 10], ["cumin seeds", 4],
      ["green chilli", 5], ["turmeric powder", 1], ["salt", 3],
      ["coriander leaves", 10], ["lemon", 10],
    ],
    steps: [
      "Boil and cube potatoes.",
      "Crackle cumin in oil; add chilli and potatoes.",
      "Toss with turmeric and salt until lightly crisped; finish with lemon.",
    ],
  },
  {
    title: "Baingan Bharta",
    description: "Smoky roasted eggplant mash cooked with tomato and garlic.",
    cuisine: "punjabi", is_veg: true, servings: 3, prep_minutes: 45,
    items: [
      ["brinjal (eggplant)", 300], ["onion", 70], ["tomato", 80],
      ["cooking oil (refined)", 15], ["garlic", 8], ["green chilli", 5],
      ["cumin seeds", 3], ["turmeric powder", 1], ["red chilli powder", 2],
      ["salt", 4], ["coriander leaves", 10],
    ],
    steps: [
      "Roast brinjal over flame until charred; peel and mash.",
      "Fry cumin, garlic, onion; add tomato and masalas.",
      "Add mashed brinjal and cook 10 minutes on medium.",
    ],
  },
  {
    title: "Cabbage Poriyal",
    description: "South Indian dry cabbage stir-fry with coconut.",
    cuisine: "south-indian", is_veg: true, servings: 2, prep_minutes: 20,
    items: [
      ["cabbage", 300], ["green peas", 50], ["cooking oil (refined)", 10],
      ["mustard seeds", 3], ["turmeric powder", 1], ["salt", 3],
      ["coconut (fresh, grated)", 15], ["curry leaves", 3],
    ],
    steps: [
      "Temper mustard and curry leaves in oil.",
      "Add cabbage, peas, turmeric, salt; cover-cook 10 minutes.",
      "Finish with grated coconut.",
    ],
  },
  {
    title: "Mixed Vegetable Sabzi",
    description: "Everyday dry sabzi with whatever the pantry has.",
    cuisine: "north-indian", is_veg: true, servings: 3, prep_minutes: 30,
    items: [
      ["cauliflower", 120], ["carrot", 60], ["french beans", 60], ["potato", 100],
      ["green peas", 50], ["cooking oil (refined)", 12], ["cumin seeds", 3],
      ["turmeric powder", 1], ["coriander powder", 3], ["red chilli powder", 2],
      ["salt", 4],
    ],
    steps: [
      "Temper cumin in oil; add all vegetables.",
      "Add salt and turmeric; toss.",
      "Cover-cook on low 15 minutes; finish with dry masalas.",
    ],
  },
  {
    title: "Lauki Chana Dal",
    description: "Bottle gourd cooked with Bengal gram — light and homely.",
    cuisine: "north-indian", is_veg: true, servings: 3, prep_minutes: 35,
    items: [
      ["chana dal (split bengal gram)", 120], ["bottle gourd (lauki)", 150],
      ["tomato", 50], ["ghee", 8], ["cumin seeds", 2], ["asafoetida (hing)", 1],
      ["green chilli", 5], ["turmeric powder", 1], ["salt", 4],
    ],
    steps: [
      "Pressure-cook dal, lauki, tomato, turmeric and salt.",
      "Temper cumin and hing in ghee; pour over dal.",
      "Simmer 5 minutes to blend.",
    ],
  },
  {
    title: "Soy Chunk Curry",
    description: "High-protein meal-maker chunks in a curd-tomato gravy.",
    cuisine: "north-indian", is_veg: true, servings: 3, prep_minutes: 35,
    items: [
      ["soy chunks", 100], ["onion", 60], ["tomato", 80], ["cooking oil (refined)", 12],
      ["ginger", 5], ["garlic", 5], ["garam masala", 2], ["coriander powder", 3],
      ["red chilli powder", 2], ["turmeric powder", 1], ["curd (dahi)", 50],
      ["salt", 4], ["coriander leaves", 10],
    ],
    steps: [
      "Boil soy chunks 8 minutes, squeeze dry.",
      "Fry onion, ginger-garlic, tomato; blend smooth and cook back with masalas.",
      "Whisk curd in; add chunks and simmer 10 minutes.",
    ],
  },
  {
    title: "Gujarati Dhokla",
    description: "Steamed, spongy besan squares with mustard-sugar tempering.",
    cuisine: "gujarati", is_veg: true, servings: 4, prep_minutes: 30,
    items: [
      ["besan (gram flour)", 150], ["curd (dahi)", 60], ["fruit salt (eno)", 5],
      ["sugar", 10], ["cooking oil (refined)", 10], ["mustard seeds", 3],
      ["green chilli", 5], ["curry leaves", 3], ["coconut (fresh, grated)", 15],
      ["coriander leaves", 10], ["salt", 3], ["lemon", 15],
    ],
    steps: [
      "Whisk besan, curd, salt, sugar, lemon and water to a thick batter; rest 15 min.",
      "Fold in Eno; pour immediately into a greased steamer.",
      "Steam 18–20 minutes; cool and cut.",
      "Temper mustard, chilli, curry leaves with water and sugar; pour over.",
    ],
  },

  // ── Rice dishes ─────────────────────────────────────────────────────────────
  {
    title: "Steamed Rice",
    description: "Plain steamed rice — the everyday base.",
    cuisine: "all-india", is_veg: true, servings: 2, prep_minutes: 15,
    items: [["rice (white, raw)", 200]],
    steps: ["Wash rice; pressure-cook with 2.5 cups water for 2 whistles.", "Fluff and serve."],
  },
  {
    title: "Jeera Rice",
    description: "Basmati tossed with ghee-roasted cumin.",
    cuisine: "north-indian", is_veg: true, servings: 2, prep_minutes: 20,
    items: [["rice (white, raw)", 180], ["ghee", 10], ["cumin seeds", 4], ["salt", 3]],
    steps: [
      "Cook rice with salt; keep grains separate.",
      "Crackle cumin in ghee; pour over rice and toss gently.",
    ],
  },
  {
    title: "Vegetable Pulao",
    description: "Fragrant one-pot rice with mixed vegetables and whole spices.",
    cuisine: "north-indian", is_veg: true, servings: 3, prep_minutes: 35,
    items: [
      ["rice (white, raw)", 210], ["carrot", 50], ["french beans", 50], ["green peas", 50],
      ["potato", 60], ["cauliflower", 50], ["onion", 60], ["cooking oil (refined)", 15],
      ["cumin seeds", 3], ["green cardamom", 1], ["salt", 5], ["pudina (mint)", 10],
    ],
    steps: [
      "Fry cumin and cardamom in oil; brown onion.",
      "Add vegetables and mint; saute 3 minutes.",
      "Add washed rice, salt and 2 cups hot water.",
      "Cook covered on low 15 minutes; rest 5 minutes.",
    ],
  },
  {
    title: "Lemon Rice",
    description: "South Indian leftover-rice classic with peanuts and lemon.",
    cuisine: "south-indian", is_veg: true, servings: 2, prep_minutes: 20,
    items: [
      ["rice (white, raw)", 200], ["lemon", 30], ["cooking oil (refined)", 12],
      ["mustard seeds", 3], ["urad dal (split black gram)", 8], ["groundnut (raw)", 20],
      ["curry leaves", 3], ["green chilli", 5], ["turmeric powder", 1], ["salt", 3],
    ],
    steps: [
      "Cook rice and cool slightly.",
      "Temper mustard, urad dal, peanuts, curry leaves, chilli.",
      "Toss rice with turmeric, salt and lemon juice.",
    ],
  },
  {
    title: "Curd Rice (Thayir Sadam)",
    description: "Cooling yogurt rice with a mustard tempering.",
    cuisine: "south-indian", is_veg: true, servings: 2, prep_minutes: 20,
    items: [
      ["rice (white, raw)", 160], ["curd (dahi)", 250], ["milk (cow, full cream)", 60],
      ["cooking oil (refined)", 8], ["mustard seeds", 3], ["urad dal (split black gram)", 6],
      ["ginger", 5], ["curry leaves", 3], ["green chilli", 5], ["salt", 3],
    ],
    steps: [
      "Cook rice soft; mash slightly and cool to lukewarm.",
      "Mix curd, milk, salt.",
      "Temper mustard, urad, ginger, chilli, curry leaves; fold through.",
    ],
  },
  {
    title: "Sambar",
    description: "Toor dal and vegetables in a tamarind-sambar masala broth.",
    cuisine: "south-indian", is_veg: true, servings: 4, prep_minutes: 40,
    items: [
      ["toor dal (split pigeon pea)", 120], ["brinjal (eggplant)", 60], ["pumpkin", 60],
      ["onion", 40], ["tomato", 60], ["tamarind (imli)", 25], ["sambhar masala", 12],
      ["turmeric powder", 1], ["salt", 5], ["cooking oil (refined)", 10],
      ["mustard seeds", 3], ["curry leaves", 3], ["coriander leaves", 10],
    ],
    steps: [
      "Pressure-cook dal with turmeric; mash smooth.",
      "Boil vegetables with tamarind extract and salt.",
      "Add sambar masala and dal; simmer 10 minutes.",
      "Temper mustard and curry leaves; pour over.",
    ],
  },
  {
    title: "Rasam",
    description: "Thin, peppery tamarind soup — the South Indian pick-me-up.",
    cuisine: "south-indian", is_veg: true, servings: 4, prep_minutes: 25,
    items: [
      ["toor dal (split pigeon pea)", 40], ["tomato", 120], ["tamarind (imli)", 20],
      ["sambhar masala", 8], ["black pepper", 2], ["cumin seeds", 3], ["garlic", 6],
      ["curry leaves", 3], ["salt", 5], ["cooking oil (refined)", 8],
      ["mustard seeds", 3], ["coriander leaves", 10],
    ],
    steps: [
      "Extract tamarind water; add chopped tomato, crushed pepper-cumin-garlic.",
      "Add cooked dal water and salt; simmer until frothy (don't boil hard).",
      "Temper mustard and curry leaves; garnish with coriander.",
    ],
  },
  {
    title: "Vegetable Biryani",
    description: "Layered fragrant rice with vegetables, curd and mint.",
    cuisine: "hyderabadi", is_veg: true, servings: 3, prep_minutes: 60,
    items: [
      ["rice (white, raw)", 210], ["carrot", 50], ["french beans", 50], ["green peas", 40],
      ["potato", 60], ["cauliflower", 50], ["onion", 80], ["curd (dahi)", 60],
      ["cooking oil (refined)", 20], ["garam masala", 3], ["turmeric powder", 1],
      ["red chilli powder", 2], ["pudina (mint)", 15], ["coriander leaves", 15],
      ["salt", 5], ["milk (cow, full cream)", 60], ["cashew", 15],
    ],
    steps: [
      "Parboil rice to 70% with salt; drain.",
      "Fry onion crisp; cook vegetables with curd and masalas.",
      "Layer rice and vegetable masala; top with mint, coriander, fried cashews, warm milk.",
      "Seal and dum on low 20 minutes.",
    ],
  },
  {
    title: "Coconut Chutney",
    description: "The essential idli-dosa side — fresh coconut, green chilli, curd.",
    cuisine: "south-indian", is_veg: true, servings: 4, prep_minutes: 10,
    items: [
      ["coconut (fresh, grated)", 100], ["chana dal (split bengal gram)", 10],
      ["green chilli", 10], ["ginger", 5], ["curd (dahi)", 40], ["salt", 3],
      ["cooking oil (refined)", 5], ["mustard seeds", 2], ["curry leaves", 2],
      ["urad dal (split black gram)", 5],
    ],
    steps: [
      "Grind coconut, roasted chana dal, chilli, ginger, curd, salt with a little water.",
      "Temper mustard, urad and curry leaves; pour over.",
    ],
  },

  // ── Breads ──────────────────────────────────────────────────────────────────
  {
    title: "Roti / Chapati (4 pieces)",
    description: "Everyday whole-wheat flatbread.",
    cuisine: "all-india", is_veg: true, servings: 2, prep_minutes: 20,
    items: [["atta (whole wheat flour)", 120], ["salt", 1]],
    steps: ["Knead dough; rest 15 minutes.", "Roll thin rounds.", "Roast on hot tawa; puff on flame."],
  },
  {
    title: "Puri (6 pieces)",
    description: "Fried puffed wheat bread for festive breakfasts.",
    cuisine: "north-indian", is_veg: true, servings: 2, prep_minutes: 25,
    items: [
      ["atta (whole wheat flour)", 100], ["cooking oil (refined)", 30, "frying oil, absorbed"],
      ["salt", 1],
    ],
    steps: [
      "Knead a stiff dough with 2 tsp oil; rest 15 minutes.",
      "Roll small rounds; deep-fry in hot oil until puffed and golden.",
    ],
  },
  {
    title: "Naan (3 pieces)",
    description: "Soft leavened tandoor-style bread with curd.",
    cuisine: "punjabi", is_veg: true, servings: 2, prep_minutes: 40,
    items: [
      ["maida (refined flour)", 150], ["curd (dahi)", 40], ["baking soda", 1],
      ["sugar", 3], ["butter", 10], ["salt", 2],
    ],
    steps: [
      "Knead maida, curd, sugar, soda, salt with warm water; rest 1 hour.",
      "Roll ovals; bake at 250°C or puff on a hot pan.",
      "Brush with butter.",
    ],
  },
  {
    title: "Missi Roti (3 pieces)",
    description: "Besan-atta flatbread with onion and coriander.",
    cuisine: "punjabi", is_veg: true, servings: 2, prep_minutes: 25,
    items: [
      ["atta (whole wheat flour)", 80], ["besan (gram flour)", 60], ["onion", 30],
      ["green chilli", 5], ["coriander leaves", 10], ["ghee", 8], ["salt", 3],
    ],
    steps: [
      "Knead everything into a soft dough; rest 10 minutes.",
      "Roll and roast on a tawa with ghee until spotted.",
    ],
  },

  // ── Snacks & street food ───────────────────────────────────────────────────
  {
    title: "Samosa (6 pieces)",
    description: "The iconic fried pastry with spiced potato-pea filling.",
    cuisine: "street-food", is_veg: true, servings: 4, prep_minutes: 60,
    items: [
      ["maida (refined flour)", 120], ["cooking oil (refined)", 20],
      ["cooking oil (refined)", 40, "frying oil, absorbed"], ["potato", 200],
      ["green peas", 60], ["cumin seeds", 3], ["garam masala", 2],
      ["red chilli powder", 2], ["ginger", 8], ["salt", 4], ["coriander leaves", 10],
    ],
    steps: [
      "Knead a stiff dough with oil; rest 20 minutes.",
      "Cook potato-pea filling with whole and ground spices.",
      "Shape cones, fill, seal the edge.",
      "Deep-fry on medium until golden and crisp.",
    ],
  },
  {
    title: "Aloo Pakora (8 pieces)",
    description: "Besan-battered potato fritters for rainy evenings.",
    cuisine: "street-food", is_veg: true, servings: 2, prep_minutes: 20,
    items: [
      ["besan (gram flour)", 80], ["potato", 150],
      ["cooking oil (refined)", 40, "frying oil, absorbed"],
      ["red chilli powder", 2], ["turmeric powder", 1], ["salt", 3], ["baking soda", 1],
    ],
    steps: [
      "Whisk besan, spices, soda and water into a thick batter.",
      "Dip thin potato slices; deep-fry until crisp.",
    ],
  },
  {
    title: "Bread Pakora (4 pieces)",
    description: "Stuffed besan-fried bread — canteen nostalgia.",
    cuisine: "street-food", is_veg: true, servings: 2, prep_minutes: 25,
    items: [
      ["bread (white)", 120], ["besan (gram flour)", 60], ["potato", 100],
      ["cooking oil (refined)", 40, "frying oil, absorbed"],
      ["red chilli powder", 2], ["salt", 3], ["green chilli", 5],
    ],
    steps: [
      "Make a thick besan batter with spices.",
      "Sandwich potato slices between bread; dip and fry.",
    ],
  },
  {
    title: "Bhel Puri",
    description: "Dry puffed-rice chaat tossed with tangy chutneys.",
    cuisine: "street-food", is_veg: true, servings: 2, prep_minutes: 15,
    items: [
      ["puffed rice (murmura)", 100], ["sev (besan, for topping)", 30], ["onion", 40],
      ["tomato", 50], ["potato", 80], ["tamarind (imli)", 15], ["jaggery (gur)", 10],
      ["chaat masala", 2], ["green chilli", 5], ["coriander leaves", 10],
    ],
    steps: [
      "Boil and cube potato; make a quick tamarind-jaggery chutney.",
      "Toss puffed rice with vegetables, chutney, chaat masala.",
      "Top with sev and serve immediately.",
    ],
  },
  {
    title: "Vegetable Cutlet (6 pieces)",
    description: "Crisp shallow-fried vegetable patties.",
    cuisine: "all-india", is_veg: true, servings: 3, prep_minutes: 40,
    items: [
      ["potato", 200], ["carrot", 60], ["french beans", 60], ["green peas", 60],
      ["onion", 40], ["besan (gram flour)", 15], ["rava (semolina)", 20],
      ["cooking oil (refined)", 25], ["red chilli powder", 2], ["garam masala", 2],
      ["salt", 3],
    ],
    steps: [
      "Boil, mash and season the vegetables with masalas.",
      "Shape patties, bind with besan, coat in rava.",
      "Shallow-fry until browned on both sides.",
    ],
  },
  {
    title: "Vada Pav (2 pieces)",
    description: "Mumbai's potato-bomb slider with garlic chilli.",
    cuisine: "maharashtrian", is_veg: true, servings: 2, prep_minutes: 40,
    items: [
      ["potato", 200], ["besan (gram flour)", 60],
      ["cooking oil (refined)", 40, "frying oil, absorbed"], ["bread (white)", 100, "as pav"],
      ["garlic", 10], ["green chilli", 10], ["mustard seeds", 3], ["curry leaves", 3],
      ["turmeric powder", 1], ["salt", 3], ["chaat masala", 2],
    ],
    steps: [
      "Temper mustard, curry leaves; mash with boiled potato, garlic-chilli paste, salt.",
      "Dip balls in besan batter; deep-fry.",
      "Split pav, sprinkle chaat masala, sandwich the vada.",
    ],
  },
  {
    title: "Pav Bhaji",
    description: "Buttery mashed-vegetable curry with toasted pav.",
    cuisine: "maharashtrian", is_veg: true, servings: 3, prep_minutes: 45,
    items: [
      ["potato", 250], ["tomato", 150], ["onion", 80], ["capsicum (bell pepper)", 80],
      ["green peas", 60], ["cauliflower", 100], ["carrot", 60], ["butter", 25],
      ["pav bhaji masala", 8], ["red chilli powder", 2], ["salt", 5],
      ["bread (white)", 180, "as pav"], ["lemon", 20], ["coriander leaves", 10],
    ],
    steps: [
      "Boil and mash all vegetables.",
      "Fry onion in butter; add tomato, capsicum, masala, chilli.",
      "Add mashed vegetables and water; simmer 20 minutes, mashing.",
      "Toast pav in butter; serve with lemon and onion.",
    ],
  },
  {
    title: "Pesarattu (2 pieces)",
    description: "Andhra green-moong crepes with ginger.",
    cuisine: "south-indian", is_veg: true, servings: 2, prep_minutes: 25,
    items: [
      ["green moong (whole)", 120], ["rice (white, raw)", 20], ["ginger", 8],
      ["green chilli", 10], ["onion", 40], ["cooking oil (refined)", 12], ["salt", 3],
    ],
    steps: [
      "Soak moong and rice 4 hours; grind coarse with ginger and chilli.",
      "Spread thin on a hot tawa with onion; drizzle oil.",
      "Cook crisp on both sides.",
    ],
  },
  {
    title: "Ven Pongal",
    description: "Peppery ghee rice-moong comfort bowl with cashews.",
    cuisine: "south-indian", is_veg: true, servings: 2, prep_minutes: 30,
    items: [
      ["rice (white, raw)", 120], ["moong dal (split yellow)", 60], ["ghee", 15],
      ["cashew", 10], ["black pepper", 2], ["cumin seeds", 3], ["ginger", 5],
      ["curry leaves", 3], ["salt", 4],
    ],
    steps: [
      "Dry-roast moong; cook with rice, pepper, ginger and salt until mushy.",
      "Fry cashews, cumin, curry leaves in ghee; fold through.",
    ],
  },
  {
    title: "Rava Dosa (3 pieces)",
    description: "Instant lacy semolina crepes with pepper and cumin.",
    cuisine: "south-indian", is_veg: true, servings: 2, prep_minutes: 25,
    items: [
      ["rava (semolina)", 60], ["rice flour", 40], ["maida (refined flour)", 20],
      ["onion", 40], ["green chilli", 5], ["ginger", 5], ["cumin seeds", 3],
      ["black pepper", 2], ["curry leaves", 3], ["cooking oil (refined)", 15], ["salt", 3],
    ],
    steps: [
      "Whisk flours thin like buttermilk; rest 15 minutes.",
      "Add onion, chilli, ginger, pepper, cumin, curry leaves, salt.",
      "Pour from the edges inward on a hot tawa; cook crisp with oil.",
    ],
  },
  {
    title: "Medu Vada (6 pieces)",
    description: "Crisp-outside, fluffy-inside urad dal doughnuts.",
    cuisine: "south-indian", is_veg: true, servings: 3, prep_minutes: 40,
    items: [
      ["urad dal (skinless, for batter)", 150], ["onion", 40], ["green chilli", 10],
      ["ginger", 8], ["curry leaves", 3], ["black pepper", 2],
      ["cooking oil (refined)", 50, "frying oil, absorbed"], ["salt", 3],
    ],
    steps: [
      "Soak urad dal 3 hours; grind thick and fluffy with minimal water.",
      "Beat the batter till light; mix onion, chilli, ginger, curry leaves, pepper, salt.",
      "Shape rings with wet hands; deep-fry till golden.",
    ],
  },

  // ── Non-vegetarian ─────────────────────────────────────────────────────────
  {
    title: "Egg Curry (6 eggs)",
    description: "Boiled eggs in an onion-tomato home gravy.",
    cuisine: "north-indian", is_veg: false, servings: 3, prep_minutes: 35,
    items: [
      ["egg (whole)", 300], ["onion", 80], ["tomato", 90], ["cooking oil (refined)", 15],
      ["ginger", 8], ["garlic", 8], ["turmeric powder", 1], ["red chilli powder", 2],
      ["coriander powder", 3], ["garam masala", 2], ["salt", 5], ["coriander leaves", 10],
    ],
    steps: [
      "Boil eggs; lightly fry and halve.",
      "Cook onion-ginger-garlic, then tomato with masalas.",
      "Add 1.5 cups water; simmer, then add eggs gently for 5 minutes.",
    ],
  },
  {
    title: "Chicken Curry",
    description: "Desi-style chicken on the bone in a robust masala.",
    cuisine: "north-indian", is_veg: false, servings: 3, prep_minutes: 50,
    items: [
      ["chicken (curry cut, raw)", 450], ["onion", 100], ["tomato", 100],
      ["cooking oil (refined)", 18], ["ginger", 10], ["garlic", 10],
      ["turmeric powder", 1], ["red chilli powder", 3], ["coriander powder", 4],
      ["garam masala", 2], ["curd (dahi)", 60], ["salt", 5], ["coriander leaves", 10],
    ],
    steps: [
      "Marinate chicken in curd, turmeric, salt 30 minutes.",
      "Brown onions well; add ginger-garlic, tomato, dry masalas.",
      "Add chicken; fry 8 minutes on high.",
      "Add hot water to cover; simmer 25 minutes until tender.",
    ],
  },
  {
    title: "Butter Chicken",
    description: "Tandoori-style chicken in a silky tomato-cashew-cream makhani.",
    cuisine: "punjabi", is_veg: false, servings: 3, prep_minutes: 60,
    items: [
      ["chicken breast (boneless, raw)", 450], ["curd (dahi)", 80], ["butter", 30],
      ["fresh cream", 60], ["tomato", 150], ["cashew", 20], ["onion", 60],
      ["garlic", 10], ["ginger", 10], ["garam masala", 3], ["red chilli powder", 2],
      ["kasuri methi (dried)", 3], ["sugar", 5], ["salt", 5], ["cooking oil (refined)", 10],
    ],
    steps: [
      "Marinate chicken in curd, ginger-garlic, spices 1 hour; sear/roast.",
      "Simmer tomato, onion, cashew; blend smooth; strain.",
      "Cook the gravy in butter 10 minutes; add chicken.",
      "Finish with cream, kasuri methi, sugar, salt.",
    ],
  },
  {
    title: "Fish Fry (2 pieces)",
    description: "Rava-crusted shallow-fried fish steaks.",
    cuisine: "south-indian", is_veg: false, servings: 2, prep_minutes: 30,
    items: [
      ["fish (rohu/rawas, raw)", 300], ["rava (semolina)", 20], ["red chilli powder", 3],
      ["turmeric powder", 1], ["black pepper", 2], ["lemon", 20],
      ["cooking oil (refined)", 25], ["salt", 3],
    ],
    steps: [
      "Marinate fish in lemon, chilli, turmeric, pepper, salt 20 minutes.",
      "Coat lightly with rava.",
      "Shallow-fry 4 minutes per side till crisp.",
    ],
  },
  {
    title: "Chicken Biryani",
    description: "Layered dum biryani — festival centrepiece.",
    cuisine: "hyderabadi", is_veg: false, servings: 4, prep_minutes: 90,
    items: [
      ["rice (white, raw)", 280], ["chicken (curry cut, raw)", 600], ["onion", 120],
      ["curd (dahi)", 100], ["cooking oil (refined)", 30], ["garam masala", 4],
      ["turmeric powder", 1], ["red chilli powder", 3], ["pudina (mint)", 20],
      ["coriander leaves", 20], ["garlic", 12], ["ginger", 12], ["salt", 7],
      ["milk (cow, full cream)", 80], ["cashew", 20], ["lemon", 20],
    ],
    steps: [
      "Marinate chicken in curd, ginger-garlic, masalas, mint, coriander 2 hours.",
      "Parboil rice to 70% with salt.",
      "Fry onions; cook chicken in the same oil till 90% done.",
      "Layer rice over chicken with fried onions, cashews, saffron milk.",
      "Seal and dum on lowest heat 25 minutes; rest 10.",
    ],
  },

  // ── Sweets & simple bowls ──────────────────────────────────────────────────
  {
    title: "Sooji Halwa",
    description: "Ghee-roasted semolina pudding for prasad and winters.",
    cuisine: "north-indian", is_veg: true, servings: 3, prep_minutes: 25,
    items: [
      ["rava (semolina)", 100], ["ghee", 40], ["sugar", 90], ["milk (cow, full cream)", 300],
      ["cashew", 10], ["raisins (kishmish)", 10], ["green cardamom", 1],
    ],
    steps: [
      "Roast rava in ghee on low till golden and nutty.",
      "Add boiling milk-water; stir out lumps.",
      "Cook till ghee separates; sweeten with sugar and cardamom.",
    ],
  },
  {
    title: "Rice Kheer",
    description: "Slow-cooked milk-rice pudding with cardamom and nuts.",
    cuisine: "all-india", is_veg: true, servings: 4, prep_minutes: 45,
    items: [
      ["rice (white, raw)", 60], ["milk (cow, full cream)", 1000], ["sugar", 80],
      ["green cardamom", 1], ["cashew", 10], ["raisins (kishmish)", 10],
    ],
    steps: [
      "Simmer milk with washed rice on low, stirring often, 30–40 minutes.",
      "Add sugar and cardamom; cook 10 more minutes.",
      "Fry cashews and raisins in ghee; top before serving.",
    ],
  },
  {
    title: "Mixed Fruit Bowl",
    description: "Fresh seasonal fruit — the simplest dessert or snack.",
    cuisine: "all-india", is_veg: true, servings: 1, prep_minutes: 5,
    items: [["banana", 100], ["apple", 100], ["papaya", 100], ["orange", 80]],
    steps: ["Chop, combine, chill and serve."],
  },

  // ── Healthier non-vegetarian (grilled / curd-marinated / lean) ─────────────
  {
    title: "Tandoori Chicken (grilled)",
    description: "Curd-and-spice marinated chicken, oven-grilled instead of fried.",
    cuisine: "punjabi", is_veg: false, servings: 3, prep_minutes: 50,
    items: [
      ["chicken (curry cut, raw)", 450], ["curd (dahi)", 120], ["ginger", 12], ["garlic", 12],
      ["garam masala", 3], ["red chilli powder", 3], ["turmeric powder", 1], ["lemon", 30],
      ["cooking oil (refined)", 8, "brushing the grill"], ["salt", 5],
    ],
    steps: [
      "Marinate chicken in curd, ginger-garlic paste, masalas, lemon and salt for 2+ hours.",
      "Arrange on a rack; brush lightly with oil.",
      "Bake at 220°C for 25–30 minutes, turning once, till charred at the edges.",
      "Rest 5 minutes; serve with lemon and onion rings.",
    ],
  },
  {
    title: "Chicken Tikka (oven-grilled)",
    description: "Boneless cubes grilled dry — high protein, low oil.",
    cuisine: "punjabi", is_veg: false, servings: 2, prep_minutes: 40,
    items: [
      ["chicken breast (boneless, raw)", 300], ["curd (dahi)", 80], ["ginger", 8], ["garlic", 8],
      ["garam masala", 2], ["red chilli powder", 2], ["turmeric powder", 1],
      ["cooking oil (refined)", 6, "brushing"], ["salt", 4], ["lemon", 20],
    ],
    steps: [
      "Cube chicken; marinate in spiced curd 1 hour.",
      "Skewer and grill at 230°C for 15–18 minutes, turning once.",
      "Finish under the broiler 2 minutes for char; squeeze lemon.",
    ],
  },
  {
    title: "Pepper Chicken Dry",
    description: "Chettinad-style dry chicken with coarse black pepper — minimal oil.",
    cuisine: "south-indian", is_veg: false, servings: 3, prep_minutes: 40,
    items: [
      ["chicken (curry cut, raw)", 450], ["onion", 80], ["tomato", 80], ["ginger", 10],
      ["garlic", 10], ["black pepper", 6], ["cooking oil (refined)", 10],
      ["turmeric powder", 1], ["curry leaves", 3], ["coriander leaves", 10], ["salt", 5],
    ],
    steps: [
      "Crush pepper coarsely.",
      "Saute onion, ginger, garlic, curry leaves in oil; add chicken and turmeric.",
      "Cover-cook in its own juices 15 minutes — no added water.",
      "Add tomato and pepper; toss dry till coated.",
    ],
  },
  {
    title: "Methi Chicken",
    description: "Lean chicken with fenugreek leaves — earthy and light.",
    cuisine: "north-indian", is_veg: false, servings: 3, prep_minutes: 45,
    items: [
      ["chicken breast (boneless, raw)", 400], ["methi leaves (fenugreek)", 100],
      ["onion", 70], ["tomato", 90], ["curd (dahi)", 60], ["ginger", 10], ["garlic", 10],
      ["garam masala", 2], ["red chilli powder", 2], ["cooking oil (refined)", 12],
      ["salt", 5], ["coriander leaves", 10],
    ],
    steps: [
      "Sauté onion, ginger-garlic; cook tomato soft.",
      "Add chicken and whisked curd; cook covered 15 minutes.",
      "Stir in chopped methi; simmer 8 minutes more.",
    ],
  },
  {
    title: "Chicken Clear Soup",
    description: "Light, protein-forward broth with shredded chicken and vegetables.",
    cuisine: "continental", is_veg: false, servings: 2, prep_minutes: 30,
    items: [
      ["chicken breast (boneless, raw)", 150], ["carrot", 40], ["french beans", 40],
      ["cabbage", 40], ["garlic", 6], ["ginger", 5], ["black pepper", 2],
      ["soy sauce", 5], ["vinegar", 5], ["salt", 3], ["spring onion", 15],
    ],
    steps: [
      "Simmer chicken with garlic, ginger and salt in 4 cups water 20 minutes; shred.",
      "Add sliced vegetables; cook 5 minutes — keep it clear.",
      "Season with pepper, soy, vinegar; top with spring onion.",
    ],
  },
  {
    title: "Chicken Pulao",
    description: "Everyday one-pot chicken rice — lighter than biryani.",
    cuisine: "north-indian", is_veg: false, servings: 3, prep_minutes: 45,
    items: [
      ["rice (white, raw)", 210], ["chicken (curry cut, raw)", 400], ["onion", 80],
      ["tomato", 70], ["curd (dahi)", 60], ["ginger", 10], ["garlic", 10],
      ["garam masala", 2], ["turmeric powder", 1], ["red chilli powder", 2],
      ["cooking oil (refined)", 12], ["pudina (mint)", 10], ["salt", 5],
    ],
    steps: [
      "Brown onion in oil; add ginger-garlic, tomato, masalas.",
      "Add chicken and curd; sear 6 minutes.",
      "Add washed rice, mint, hot water; cook covered till done.",
      "Rest 10 minutes and fluff.",
    ],
  },
  {
    title: "Egg Fried Rice",
    description: "Veggie-loaded egg rice — quick, balanced weeknight dinner.",
    cuisine: "continental", is_veg: false, servings: 2, prep_minutes: 25,
    items: [
      ["rice (white, raw)", 160], ["egg (whole)", 100], ["carrot", 40], ["cabbage", 50],
      ["capsicum (bell pepper)", 50], ["spring onion", 30], ["garlic", 6],
      ["cooking oil (refined)", 12], ["soy sauce", 8], ["vinegar", 5], ["black pepper", 2], ["salt", 3],
    ],
    steps: [
      "Cook rice and cool completely.",
      "Scramble beaten eggs; set aside.",
      "Stir-fry garlic and vegetables on high 3 minutes.",
      "Add rice, soy, vinegar, pepper, eggs; toss well. Finish with spring onion.",
    ],
  },
  {
    title: "Egg Dosa (2 pieces)",
    description: "Dosa topped with a spiced egg layer — protein-rich breakfast.",
    cuisine: "south-indian", is_veg: false, servings: 1, prep_minutes: 15,
    items: [
      ["rice (white, raw)", 100], ["urad dal (skinless, for batter)", 40],
      ["egg (whole)", 100], ["onion", 30], ["green chilli", 5], ["coriander leaves", 10],
      ["cooking oil (refined)", 10], ["salt", 3], ["black pepper", 1],
    ],
    steps: [
      "Spread dosa batter thin; crack an egg on top.",
      "Sprinkle onion, chilli, coriander, pepper, salt.",
      "Drizzle oil; cook till egg sets and base crisps. Fold and serve.",
    ],
  },
  {
    title: "Light Fish Curry",
    description: "Bengali-style fish in a thin tomato-ginger gravy — no frying.",
    cuisine: "bengali", is_veg: false, servings: 3, prep_minutes: 35,
    items: [
      ["fish (rohu/rawas, raw)", 450], ["tomato", 120], ["onion", 60], ["ginger", 12],
      ["garlic", 8], ["turmeric powder", 2], ["red chilli powder", 2], ["cumin seeds", 3],
      ["mustard oil", 10], ["green chilli", 5], ["salt", 5], ["coriander leaves", 10],
    ],
    steps: [
      "Rub fish with turmeric and salt; rest 15 minutes.",
      "Temper cumin in mustard oil; soften onion, ginger, garlic.",
      "Add tomato and chilli; cook to a loose gravy with 2 cups water.",
      "Slip in fish; simmer 8–10 minutes — never boil hard.",
    ],
  },
  {
    title: "Grilled Fish with Lemon",
    description: "Marinated fish steaks grilled dry — the leanest fish dinner.",
    cuisine: "continental", is_veg: false, servings: 2, prep_minutes: 25,
    items: [
      ["fish (rohu/rawas, raw)", 300], ["lemon", 30], ["ginger", 8], ["garlic", 8],
      ["black pepper", 2], ["cooking oil (refined)", 6, "brushing"], ["salt", 3],
      ["coriander leaves", 10],
    ],
    steps: [
      "Marinate fish in lemon, ginger-garlic, pepper, salt 20 minutes.",
      "Grill 5–6 minutes per side, brushing lightly with oil.",
      "Rest 2 minutes; shower with coriander.",
    ],
  },
  {
    title: "Prawn Masala (dry)",
    description: "Quick prawns tossed with onion-tomato masala — high protein, low fat.",
    cuisine: "south-indian", is_veg: false, servings: 2, prep_minutes: 25,
    items: [
      ["prawns (raw)", 300], ["onion", 80], ["tomato", 100], ["garlic", 8],
      ["ginger", 8], ["turmeric powder", 1], ["red chilli powder", 2],
      ["coconut (fresh, grated)", 15], ["cooking oil (refined)", 10],
      ["curry leaves", 3], ["salt", 4], ["coriander leaves", 10],
    ],
    steps: [
      "Sauté ginger-garlic, onion, curry leaves.",
      "Add tomato and masalas; cook soft.",
      "Add prawns; cook just 4–5 minutes (they turn rubbery if overdone).",
      "Finish with coconut and coriander.",
    ],
  },
  {
    title: "Chicken Keema Matar",
    description: "Lean chicken mince with peas — a lighter take on keema.",
    cuisine: "north-indian", is_veg: false, servings: 3, prep_minutes: 35,
    items: [
      ["chicken mince (keema, raw)", 400], ["green peas", 80], ["onion", 80],
      ["tomato", 90], ["ginger", 10], ["garlic", 10], ["garam masala", 2],
      ["coriander powder", 3], ["red chilli powder", 2], ["cooking oil (refined)", 12],
      ["salt", 5], ["coriander leaves", 10],
    ],
    steps: [
      "Brown onion well; add ginger-garlic.",
      "Add mince; break lumps and fry till colour changes.",
      "Add tomato, masalas, peas; cover-cook 12 minutes.",
    ],
  },
  {
    title: "Grilled Chicken Salad Bowl",
    description: "Post-workout bowl: grilled chicken, rainbow vegetables, lemon dressing.",
    cuisine: "continental", is_veg: false, servings: 2, prep_minutes: 30,
    items: [
      ["chicken breast (boneless, raw)", 250], ["cucumber", 80], ["tomato", 80],
      ["capsicum (bell pepper)", 60], ["carrot", 50], ["sprouted moong", 100],
      ["lemon", 30], ["cooking oil (refined)", 6], ["black pepper", 2], ["salt", 3],
    ],
    steps: [
      "Season chicken; grill 6 minutes per side; rest and slice.",
      "Toss vegetables and sprouts with lemon, oil, pepper, salt.",
      "Top with warm chicken slices.",
    ],
  },
  {
    title: "Chicken Seekh Kebab (oven)",
    description: "Spiced chicken-mince skewers baked, not fried.",
    cuisine: "punjabi", is_veg: false, servings: 3, prep_minutes: 45,
    items: [
      ["chicken mince (keema, raw)", 400], ["onion", 60], ["ginger", 10], ["garlic", 10],
      ["green chilli", 8], ["coriander leaves", 15], ["garam masala", 2],
      ["red chilli powder", 2], ["besan (gram flour)", 20, "binder"],
      ["cooking oil (refined)", 5, "brushing"], ["salt", 4], ["lemon", 20],
    ],
    steps: [
      "Mix mince with all ingredients; rest 30 minutes.",
      "Shape onto skewers; brush lightly with oil.",
      "Bake at 220°C for 18–20 minutes, turning once, till browned.",
    ],
  },
];
