"use client";

import { useState, useTransition } from "react";
import { saveChatLanguage } from "./actions";
import { CHAT_LANGUAGES, chatLanguageLabel } from "@/lib/ai/assistant/languages";

/** Assistant reply-language selector, shown in Settings → AI providers. */
export function LanguageForm({ initial }: { initial: string | null }) {
  const [lang, setLang] = useState(initial ?? "en");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startSaving] = useTransition();

  function save() {
    setError(null);
    setSaved(null);
    startSaving(async () => {
      const res = await saveChatLanguage(lang);
      if (res.ok) setSaved(`Replies will now be in ${chatLanguageLabel(lang)}.`);
      else setError(res.error ?? "Could not save — try again.");
    });
  }

  return (
    <div className="border-t-2 border-neutral-900 p-6">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500" htmlFor="chat-language">
        Assistant language
      </label>
      <div className="flex items-end gap-2">
        <select
          id="chat-language"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="w-full max-w-xs rounded-none border-2 border-neutral-900 bg-white px-3 py-2.5 text-sm font-bold focus:shadow-[3px_3px_0_#111] focus:outline-none"
        >
          {CHAT_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native} — {l.english}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className={`rounded-none border-2 border-neutral-900 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-amber-50 disabled:opacity-60 ${
            pending ? "nb-loading cursor-wait" : ""
          }`}
        >
          {pending ? "◌ Saving…" : "Save language"}
        </button>
      </div>
      <p className="mt-1 text-[10px] text-neutral-400">
        The ✨ assistant always replies in this language, whatever language you type in.
      </p>
      {saved && <p className="nb-stamp mt-2 text-xs font-extrabold text-emerald-700">{saved}</p>}
      {error && <p className="nb-shake mt-2 text-xs font-bold text-red-700">{error}</p>}
    </div>
  );
}
