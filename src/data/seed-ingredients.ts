/**
 * India-first ingredient master data. Per-100g values are IFCT 2017-informed
 * for Indian staples and USDA otherwise, rounded to plausible packaging
 * values. cost_per_100g is a rough 2025 Indian retail average in ₹ — used for
 * budget-aware planning, not accounting.
 *
 * Names are canonical lowercase keys; recipes reference them by name.
 * Seeding is idempotent on (lower(name)) for global rows.
 */

export interface SeedIngredient {
  name: string;
  name_hi: string;
  category: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  cost: number;
}

export const SEED_INGREDIENTS: SeedIngredient[] = [
  // ── Grains & flours ─────────────────────────────────────────────────────────
  { name: "rice (white, raw)", name_hi: "चावल", category: "grain", kcal: 345, protein: 6.8, carbs: 78.2, fat: 0.7, fiber: 1.0, cost: 6 },
  { name: "brown rice (raw)", name_hi: "ब्राउन राइस", category: "grain", kcal: 354, protein: 7.5, carbs: 74, fat: 2.7, fiber: 3.2, cost: 10 },
  { name: "atta (whole wheat flour)", name_hi: "आटा", category: "grain", kcal: 341, protein: 12.1, carbs: 68, fat: 1.7, fiber: 11.0, cost: 5 },
  { name: "maida (refined flour)", name_hi: "मैदा", category: "grain", kcal: 348, protein: 9.4, carbs: 74, fat: 1.2, fiber: 2.7, cost: 5 },
  { name: "rava (semolina)", name_hi: "सूजी", category: "grain", kcal: 351, protein: 12.1, carbs: 73, fat: 1.0, fiber: 3.6, cost: 7 },
  { name: "rice flour", name_hi: "चावल का आटा", category: "grain", kcal: 359, protein: 6.5, carbs: 80, fat: 1.0, fiber: 2.4, cost: 8 },
  { name: "besan (gram flour)", name_hi: "बेसन", category: "grain", kcal: 372, protein: 21.9, carbs: 57.8, fat: 5.6, fiber: 7.3, cost: 11 },
  { name: "poha (flattened rice)", name_hi: "पोहा", category: "grain", kcal: 346, protein: 6.6, carbs: 77.3, fat: 1.2, fiber: 2.0, cost: 7 },
  { name: "oats (rolled)", name_hi: "ओट्स", category: "grain", kcal: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6, cost: 13 },
  { name: "sabudana (sago)", name_hi: "साबूदाना", category: "grain", kcal: 337, protein: 0.2, carbs: 83.9, fat: 0.1, fiber: 0.5, cost: 12 },
  { name: "vermicelli (semiya)", name_hi: "सेवई", category: "grain", kcal: 350, protein: 10, carbs: 73, fat: 1.5, fiber: 2.5, cost: 9 },
  { name: "ragi flour (finger millet)", name_hi: "रागी आटा", category: "grain", kcal: 328, protein: 7.7, carbs: 72.6, fat: 1.5, fiber: 11.5, cost: 8 },
  { name: "bajra flour (pearl millet)", name_hi: "बाजरा आटा", category: "grain", kcal: 361, protein: 12.4, carbs: 67.5, fat: 5.4, fiber: 11.0, cost: 8 },
  { name: "bread (white)", name_hi: "ब्रेड", category: "grain", kcal: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7, cost: 6 },
  { name: "quinoa (raw)", name_hi: "क्विनोआ", category: "grain", kcal: 368, protein: 14.1, carbs: 64.2, fat: 6.1, fiber: 7.0, cost: 30 },

  // ── Dals & legumes ──────────────────────────────────────────────────────────
  { name: "toor dal (split pigeon pea)", name_hi: "तूअर दाल", category: "dal", kcal: 343, protein: 21.7, carbs: 58.1, fat: 1.7, fiber: 8.0, cost: 14 },
  { name: "moong dal (split yellow)", name_hi: "मूंग दाल", category: "dal", kcal: 347, protein: 24.0, carbs: 56.8, fat: 1.2, fiber: 8.0, cost: 14 },
  { name: "masoor dal (split red lentil)", name_hi: "मसूर दाल", category: "dal", kcal: 343, protein: 24.6, carbs: 56.2, fat: 0.9, fiber: 7.9, cost: 13 },
  { name: "urad dal (split black gram)", name_hi: "उड़द दाल", category: "dal", kcal: 347, protein: 23.6, carbs: 56.1, fat: 1.4, fiber: 8.5, cost: 15 },
  { name: "chana dal (split bengal gram)", name_hi: "चना दाल", category: "dal", kcal: 360, protein: 19.8, carbs: 60.4, fat: 5.5, fiber: 10.2, cost: 12 },
  { name: "rajma (kidney beans, raw)", name_hi: "राजमा", category: "dal", kcal: 333, protein: 22.9, carbs: 60.0, fat: 0.8, fiber: 15.0, cost: 14 },
  { name: "kabuli chana (chickpeas, raw)", name_hi: "काबुली चना", category: "dal", kcal: 364, protein: 19.0, carbs: 61.2, fat: 6.0, fiber: 12.4, cost: 12 },
  { name: "soy chunks", name_hi: "सोया चंक्स", category: "dal", kcal: 345, protein: 52.0, carbs: 33.0, fat: 0.5, fiber: 13.0, cost: 9 },
  { name: "green moong (whole)", name_hi: "सब्ज़ी मूंग", category: "dal", kcal: 334, protein: 24.1, carbs: 56.8, fat: 1.2, fiber: 12.0, cost: 13 },
  { name: "kala chana (black chickpeas)", name_hi: "काला चना", category: "dal", kcal: 372, protein: 20.5, carbs: 61.0, fat: 5.9, fiber: 12.0, cost: 12 },
  { name: "sprouted moong", name_hi: "अंकुरित मूंग", category: "dal", kcal: 30, protein: 3.0, carbs: 5.9, fat: 0.2, fiber: 1.8, cost: 4 },

  // ── Vegetables ──────────────────────────────────────────────────────────────
  { name: "onion", name_hi: "प्याज़", category: "vegetable", kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.2, fiber: 1.7, cost: 0.5 },
  { name: "tomato", name_hi: "टमाटर", category: "vegetable", kcal: 20, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, cost: 0.6 },
  { name: "potato", name_hi: "आलू", category: "vegetable", kcal: 77, protein: 2.0, carbs: 17.5, fat: 0.1, fiber: 2.2, cost: 0.5 },
  { name: "sweet potato", name_hi: "शकरकंद", category: "vegetable", kcal: 86, protein: 1.6, carbs: 20.1, fat: 0.1, fiber: 3.0, cost: 1.0 },
  { name: "cauliflower", name_hi: "फूलगोभी", category: "vegetable", kcal: 25, protein: 1.9, carbs: 5.0, fat: 0.3, fiber: 2.0, cost: 0.8 },
  { name: "cabbage", name_hi: "पत्ता गोभी", category: "vegetable", kcal: 25, protein: 1.3, carbs: 5.8, fat: 0.1, fiber: 2.5, cost: 0.5 },
  { name: "carrot", name_hi: "गाजर", category: "vegetable", kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, cost: 0.8 },
  { name: "green peas", name_hi: "मटर", category: "vegetable", kcal: 81, protein: 5.4, carbs: 14.5, fat: 0.4, fiber: 5.1, cost: 2.5 },
  { name: "french beans", name_hi: "फ्रेंच बीन्स", category: "vegetable", kcal: 35, protein: 1.8, carbs: 7.9, fat: 0.1, fiber: 2.7, cost: 1.5 },
  { name: "bhindi (okra)", name_hi: "भिंडी", category: "vegetable", kcal: 33, protein: 1.9, carbs: 7.5, fat: 0.2, fiber: 3.2, cost: 2.0 },
  { name: "brinjal (eggplant)", name_hi: "बैंगन", category: "vegetable", kcal: 24, protein: 1.1, carbs: 6.0, fat: 0.2, fiber: 3.0, cost: 1.2 },
  { name: "capsicum (bell pepper)", name_hi: "शिमला मिर्च", category: "vegetable", kcal: 27, protein: 1.0, carbs: 6.4, fat: 0.2, fiber: 2.1, cost: 2.0 },
  { name: "palak (spinach)", name_hi: "पालक", category: "vegetable", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, cost: 1.0 },
  { name: "methi leaves (fenugreek)", name_hi: "मेथी", category: "vegetable", kcal: 50, protein: 4.4, carbs: 6.5, fat: 0.9, fiber: 3.0, cost: 1.5 },
  { name: "bottle gourd (lauki)", name_hi: "लौकी", category: "vegetable", kcal: 14, protein: 0.6, carbs: 3.2, fat: 0.1, fiber: 1.4, cost: 0.6 },
  { name: "ridge gourd (turiya)", name_hi: "तुरई", category: "vegetable", kcal: 17, protein: 1.2, carbs: 3.7, fat: 0.2, fiber: 1.8, cost: 0.8 },
  { name: "pumpkin", name_hi: "कद्दू", category: "vegetable", kcal: 26, protein: 1.0, carbs: 6.5, fat: 0.1, fiber: 0.5, cost: 0.5 },
  { name: "cucumber", name_hi: "खीरा", category: "vegetable", kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.6, cost: 0.5 },
  { name: "beetroot", name_hi: "चुकंदर", category: "vegetable", kcal: 43, protein: 1.6, carbs: 9.6, fat: 0.2, fiber: 2.8, cost: 1.0 },
  { name: "mushroom (button)", name_hi: "मशरूम", category: "vegetable", kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiber: 1.0, cost: 4.0 },
  { name: "sweet corn kernels", name_hi: "स्वीट कॉर्न", category: "vegetable", kcal: 86, protein: 3.3, carbs: 19.0, fat: 1.4, fiber: 2.7, cost: 2.5 },
  { name: "spring onion", name_hi: "हरे प्याज़", category: "vegetable", kcal: 32, protein: 1.8, carbs: 7.3, fat: 0.2, fiber: 2.6, cost: 1.5 },
  { name: "coriander leaves", name_hi: "धनिया", category: "vegetable", kcal: 23, protein: 2.1, carbs: 3.7, fat: 0.5, fiber: 2.8, cost: 3.0 },
  { name: "pudina (mint)", name_hi: "पुदीना", category: "vegetable", kcal: 70, protein: 3.8, carbs: 14.9, fat: 0.9, fiber: 8.0, cost: 3.0 },
  { name: "curry leaves", name_hi: "करी पत्ता", category: "vegetable", kcal: 100, protein: 6.0, carbs: 18.8, fat: 1.0, fiber: 6.4, cost: 2.0 },
  { name: "ginger", name_hi: "अदरक", category: "vegetable", kcal: 80, protein: 1.8, carbs: 17.8, fat: 0.8, fiber: 2.0, cost: 3.0 },
  { name: "garlic", name_hi: "लहसुन", category: "vegetable", kcal: 149, protein: 6.4, carbs: 33.1, fat: 0.5, fiber: 2.1, cost: 5.0 },
  { name: "green chilli", name_hi: "हरी मिर्च", category: "vegetable", kcal: 29, protein: 2.4, carbs: 5.5, fat: 0.4, fiber: 1.5, cost: 2.0 },
  { name: "lemon", name_hi: "नींबू", category: "vegetable", kcal: 29, protein: 1.1, carbs: 9.3, fat: 0.3, fiber: 2.8, cost: 1.5 },

  // ── Dairy & eggs ────────────────────────────────────────────────────────────
  { name: "milk (cow, full cream)", name_hi: "दूध", category: "dairy", kcal: 65, protein: 3.3, carbs: 4.9, fat: 3.6, fiber: 0, cost: 0.8 },
  { name: "milk (toned)", name_hi: "टोन्ड दूध", category: "dairy", kcal: 49, protein: 3.1, carbs: 4.9, fat: 2.0, fiber: 0, cost: 0.7 },
  { name: "curd (dahi)", name_hi: "दही", category: "dairy", kcal: 60, protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0, cost: 1.5 },
  { name: "paneer", name_hi: "पनीर", category: "dairy", kcal: 265, protein: 18.0, carbs: 1.2, fat: 20.5, fiber: 0, cost: 6.0 },
  { name: "khoya (mawa)", name_hi: "खोया", category: "dairy", kcal: 400, protein: 12.0, carbs: 15.0, fat: 32.0, fiber: 0, cost: 7.0 },
  { name: "butter", name_hi: "मक्खन", category: "dairy", kcal: 717, protein: 0.9, carbs: 0.1, fat: 81.1, fiber: 0, cost: 10.0 },
  { name: "fresh cream", name_hi: "फ्रेश क्रीम", category: "dairy", kcal: 290, protein: 2.5, carbs: 3.0, fat: 30.0, fiber: 0, cost: 8.0 },
  { name: "processed cheese", name_hi: "चीज़", category: "dairy", kcal: 350, protein: 20.0, carbs: 2.0, fat: 29.0, fiber: 0, cost: 12.0 },
  { name: "egg (whole)", name_hi: "अंडा", category: "protein", kcal: 155, protein: 12.6, carbs: 1.1, fat: 10.6, fiber: 0, cost: 1.5 },

  // ── Meat & fish ─────────────────────────────────────────────────────────────
  { name: "chicken breast (boneless, raw)", name_hi: "चिकन", category: "protein", kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0, cost: 6.5 },
  { name: "chicken mince (keema, raw)", name_hi: "चिकन कीमा", category: "protein", kcal: 143, protein: 21.0, carbs: 0, fat: 6.0, fiber: 0, cost: 6.0 },
  { name: "chicken (curry cut, raw)", name_hi: "चिकन", category: "protein", kcal: 165, protein: 19.0, carbs: 0, fat: 9.0, fiber: 0, cost: 4.5 },
  { name: "mutton (raw)", name_hi: "मटन", category: "protein", kcal: 250, protein: 16.5, carbs: 0, fat: 20.0, fiber: 0, cost: 15.0 },
  { name: "fish (rohu/rawas, raw)", name_hi: "मछली", category: "protein", kcal: 97, protein: 17.0, carbs: 0, fat: 2.5, fiber: 0, cost: 8.0 },
  { name: "prawns (raw)", name_hi: "झींगा", category: "protein", kcal: 99, protein: 24.0, carbs: 0.2, fat: 0.3, fiber: 0, cost: 15.0 },

  // ── Oils & fats ─────────────────────────────────────────────────────────────
  { name: "ghee", name_hi: "घी", category: "oil", kcal: 900, protein: 0, carbs: 0, fat: 100.0, fiber: 0, cost: 12.0 },
  { name: "cooking oil (refined)", name_hi: "तेल", category: "oil", kcal: 884, protein: 0, carbs: 0, fat: 100.0, fiber: 0, cost: 2.2 },
  { name: "mustard oil", name_hi: "सरसों तेल", category: "oil", kcal: 884, protein: 0, carbs: 0, fat: 100.0, fiber: 0, cost: 2.4 },
  { name: "coconut oil", name_hi: "नारियल तेल", category: "oil", kcal: 884, protein: 0, carbs: 0, fat: 100.0, fiber: 0, cost: 4.0 },
  { name: "groundnut (raw)", name_hi: "मूंगफली", category: "oil", kcal: 567, protein: 25.8, carbs: 16.1, fat: 49.2, fiber: 8.5, cost: 3.0 },

  // ── Nuts & seeds ────────────────────────────────────────────────────────────
  { name: "cashew", name_hi: "काजू", category: "nut", kcal: 553, protein: 18.2, carbs: 30.2, fat: 43.9, fiber: 3.3, cost: 16.0 },
  { name: "almond", name_hi: "बादाम", category: "nut", kcal: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5, cost: 15.0 },
  { name: "walnut", name_hi: "अखरोट", category: "nut", kcal: 654, protein: 15.2, carbs: 13.7, fat: 65.2, fiber: 6.7, cost: 18.0 },
  { name: "til (sesame seeds)", name_hi: "तिल", category: "nut", kcal: 573, protein: 17.7, carbs: 23.4, fat: 49.7, fiber: 11.8, cost: 6.0 },
  { name: "raisins (kishmish)", name_hi: "किशमिश", category: "nut", kcal: 299, protein: 3.2, carbs: 79.2, fat: 0.4, fiber: 4.5, cost: 12.0 },
  { name: "dates (khajur)", name_hi: "खजूर", category: "nut", kcal: 282, protein: 2.5, carbs: 75.0, fat: 0.4, fiber: 8.0, cost: 12.0 },
  { name: "pumpkin seeds", name_hi: "कद्दू के बीज", category: "nut", kcal: 559, protein: 30.2, carbs: 10.7, fat: 49.0, fiber: 6.0, cost: 15.0 },

  // ── Sweeteners ──────────────────────────────────────────────────────────────
  { name: "sugar", name_hi: "चीनी", category: "sweetener", kcal: 387, protein: 0, carbs: 99.6, fat: 0, fiber: 0, cost: 0.9 },
  { name: "jaggery (gur)", name_hi: "गुड़", category: "sweetener", kcal: 383, protein: 0.4, carbs: 97.0, fat: 0.1, fiber: 0, cost: 1.5 },
  { name: "honey", name_hi: "शहद", category: "sweetener", kcal: 304, protein: 0.3, carbs: 82.4, fat: 0, fiber: 0, cost: 12.0 },

  // ── Spices & flavourings (small quantities; kcal mostly negligible) ────────
  { name: "salt", name_hi: "नमक", category: "spice", kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, cost: 0.1 },
  { name: "turmeric powder", name_hi: "हल्दी", category: "spice", kcal: 312, protein: 9.7, carbs: 67.0, fat: 3.2, fiber: 22.0, cost: 3.0 },
  { name: "red chilli powder", name_hi: "लाल मिर्च", category: "spice", kcal: 286, protein: 13.5, carbs: 49.0, fat: 14.3, fiber: 30.0, cost: 4.0 },
  { name: "coriander powder", name_hi: "धनिया पाउडर", category: "spice", kcal: 299, protein: 12.4, carbs: 55.0, fat: 13.0, fiber: 32.0, cost: 3.0 },
  { name: "cumin seeds", name_hi: "जीरा", category: "spice", kcal: 375, protein: 17.8, carbs: 44.2, fat: 22.3, fiber: 10.5, cost: 8.0 },
  { name: "mustard seeds", name_hi: "सरसों", category: "spice", kcal: 508, protein: 26.1, carbs: 28.1, fat: 36.2, fiber: 12.2, cost: 5.0 },
  { name: "garam masala", name_hi: "गरम मसाला", category: "spice", kcal: 379, protein: 14.0, carbs: 45.0, fat: 15.0, fiber: 24.0, cost: 10.0 },
  { name: "sambhar masala", name_hi: "सांभर मसाला", category: "spice", kcal: 350, protein: 14.0, carbs: 48.0, fat: 11.0, fiber: 22.0, cost: 8.0 },
  { name: "chaat masala", name_hi: "चाट मसाला", category: "spice", kcal: 300, protein: 12.0, carbs: 50.0, fat: 8.0, fiber: 20.0, cost: 8.0 },
  { name: "pav bhaji masala", name_hi: "पाव भाजी मसाला", category: "spice", kcal: 360, protein: 13.0, carbs: 50.0, fat: 12.0, fiber: 21.0, cost: 8.0 },
  { name: "black pepper", name_hi: "काली मिर्च", category: "spice", kcal: 251, protein: 10.4, carbs: 63.9, fat: 3.3, fiber: 25.0, cost: 12.0 },
  { name: "asafoetida (hing)", name_hi: "हींग", category: "spice", kcal: 297, protein: 4.0, carbs: 68.0, fat: 1.1, fiber: 4.0, cost: 30.0 },
  { name: "kasuri methi (dried)", name_hi: "कसूरी मेथी", category: "spice", kcal: 320, protein: 20.0, carbs: 45.0, fat: 8.0, fiber: 25.0, cost: 10.0 },
  { name: "tamarind (imli)", name_hi: "इमली", category: "spice", kcal: 239, protein: 2.8, carbs: 62.5, fat: 0.6, fiber: 5.1, cost: 4.0 },
  { name: "green cardamom", name_hi: "इलायची", category: "spice", kcal: 311, protein: 10.8, carbs: 68.5, fat: 6.7, fiber: 28.0, cost: 60.0 },
  { name: "baking soda", name_hi: "खाने का सोडा", category: "spice", kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, cost: 0.5 },
  { name: "fruit salt (eno)", name_hi: "फ्रूट सॉल्ट", category: "spice", kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, cost: 2.0 },
  { name: "soy sauce", name_hi: "सोया सॉस", category: "spice", kcal: 53, protein: 8.1, carbs: 4.9, fat: 0.6, fiber: 0.8, cost: 3.0 },
  { name: "vinegar", name_hi: "सिरका", category: "spice", kcal: 19, protein: 0, carbs: 0.9, fat: 0, fiber: 0, cost: 1.0 },

  // ── Fruits ──────────────────────────────────────────────────────────────────
  { name: "banana", name_hi: "केला", category: "fruit", kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, cost: 0.4 },
  { name: "apple", name_hi: "सेब", category: "fruit", kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, cost: 4.0 },
  { name: "papaya", name_hi: "पपीता", category: "fruit", kcal: 43, protein: 0.5, carbs: 11.0, fat: 0.3, fiber: 1.7, cost: 1.2 },
  { name: "orange", name_hi: "संतरा", category: "fruit", kcal: 47, protein: 0.9, carbs: 11.8, fat: 0.1, fiber: 2.4, cost: 1.5 },
  { name: "mango", name_hi: "आम", category: "fruit", kcal: 60, protein: 0.8, carbs: 15.0, fat: 0.4, fiber: 1.6, cost: 2.5 },
  { name: "guava", name_hi: "अमरूद", category: "fruit", kcal: 68, protein: 2.6, carbs: 14.3, fat: 1.0, fiber: 5.4, cost: 1.5 },
  { name: "grapes", name_hi: "अंगूर", category: "fruit", kcal: 69, protein: 0.7, carbs: 18.1, fat: 0.2, fiber: 0.9, cost: 3.0 },

  // ── Coconut & regional staples ─────────────────────────────────────────────
  { name: "coconut (fresh, grated)", name_hi: "नारियल", category: "other", kcal: 354, protein: 3.3, carbs: 15.2, fat: 33.5, fiber: 9.0, cost: 3.0 },
  { name: "coconut milk", name_hi: "नारियल का दूध", category: "other", kcal: 197, protein: 2.0, carbs: 2.8, fat: 21.3, fiber: 0, cost: 4.0 },
  { name: "urad dal (skinless, for batter)", name_hi: "उड़द दाल", category: "dal", kcal: 341, protein: 25.0, carbs: 55.0, fat: 1.3, fiber: 6.0, cost: 15 },
  { name: "idli rava (cream of rice)", name_hi: "इडली रवा", category: "grain", kcal: 348, protein: 7.0, carbs: 78.0, fat: 0.8, fiber: 1.5, cost: 7 },
  { name: "poha (thick)", name_hi: "पोहा", category: "grain", kcal: 346, protein: 6.6, carbs: 77.3, fat: 1.2, fiber: 2.0, cost: 7 },
  { name: "papad (urad)", name_hi: "पापड़", category: "other", kcal: 300, protein: 20.0, carbs: 50.0, fat: 2.0, fiber: 5.0, cost: 5.0 },
  { name: "sev (besan, for topping)", name_hi: "सेव", category: "other", kcal: 500, protein: 18.0, carbs: 55.0, fat: 24.0, fiber: 4.0, cost: 6.0 },
  { name: "puffed rice (murmura)", name_hi: "मुरमुरा", category: "grain", kcal: 330, protein: 7.5, carbs: 78.0, fat: 0.5, fiber: 3.0, cost: 5.0 },
];
