/**
 * Chat reply languages. The member's pick (profiles.chat_language) is baked
 * into the assistant's system prompt; input language is always understood
 * regardless of the reply language (Hinglish/Devanagari/mixed all parse).
 */

export interface ChatLanguage {
  code: string;
  /** Native name shown in pickers. */
  native: string;
  /** English name for hints. */
  english: string;
}

export const CHAT_LANGUAGES: ChatLanguage[] = [
  { code: "en", native: "English", english: "English" },
  { code: "hi", native: "हिन्दी", english: "Hindi" },
  { code: "hinglish", native: "Hinglish", english: "Hindi in Latin script, mixed with English" },
  { code: "mr", native: "मराठी", english: "Marathi" },
  { code: "ta", native: "தமிழ்", english: "Tamil" },
  { code: "te", native: "తెలుగు", english: "Telugu" },
  { code: "bn", native: "বাংলা", english: "Bengali" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada" },
  { code: "ml", native: "മലയാളം", english: "Malayalam" },
];

export const CHAT_LANGUAGE_CODES = CHAT_LANGUAGES.map((l) => l.code);

export function chatLanguageLabel(code: string | null | undefined): string {
  const found = CHAT_LANGUAGES.find((l) => l.code === code);
  return found ? found.native : "English";
}

/** System-prompt instruction for the chosen reply language. */
export function chatLanguageInstruction(code: string | null | undefined): string {
  const found = CHAT_LANGUAGES.find((l) => l.code === code) ?? CHAT_LANGUAGES[0];
  if (found.code === "hinglish") {
    return "Reply in Hinglish (Hindi written in Latin script, naturally mixed with English) — exactly how urban Indian households text.";
  }
  return `Always reply in ${found.native} (${found.english}). Understand any input language (Hinglish, English, Hindi mixed) but write every reply in ${found.native}. Keep dish names and ingredient names in their common Indian form.`;
}
