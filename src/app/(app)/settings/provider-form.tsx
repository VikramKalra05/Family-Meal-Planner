"use client";

import { useActionState, useState, useTransition } from "react";
import { addAiProvider, testRawProvider } from "./actions";

const input =
  "w-full rounded-none border-2 border-neutral-900 bg-white px-3.5 py-2.5 text-sm transition focus:shadow-[3px_3px_0_#111] focus:outline-none";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500";

const PRESETS: { name: string; baseUrl: string; model: string }[] = [
  { name: "Z.ai (GLM)", baseUrl: "https://api.z.ai/api/paas/v4", model: "glm-4.6" },
  { name: "OpenCode (Zen)", baseUrl: "https://opencode.ai/zen/v1", model: "claude-sonnet-4-5" },
  { name: "OpenCode (Go)", baseUrl: "https://opencode.ai/zen/go/v1", model: "claude-sonnet-4-5" },
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash" },
  { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/auto" },
  { name: "Ollama (local)", baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
];

export function AddProviderForm() {
  const [state, action, pending] = useActionState(addAiProvider, { error: null, ok: null });
  const [preset, setPreset] = useState(0);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, startTesting] = useTransition();

  const p = PRESETS[preset];

  function runTest() {
    const form = document.getElementById("add-provider-form") as HTMLFormElement | null;
    if (!form) return;
    const fd = new FormData(form);
    setTestResult(null);
    startTesting(async () => {
      const res = await testRawProvider(String(fd.get("base_url") ?? ""), String(fd.get("api_key") ?? ""), String(fd.get("model") ?? ""));
      setTestResult(res.ok ? `✓ Connected in ${res.latencyMs}ms` : `✕ ${res.error}`);
    });
  }

  return (
    <form id="add-provider-form" action={action} className="space-y-4">
      <div>
        <label className={label} htmlFor="preset">Quick fill</label>
        <select
          id="preset"
          value={preset}
          onChange={(e) => setPreset(Number(e.target.value))}
          className={input}
        >
          {PRESETS.map((pr, i) => (
            <option key={pr.name} value={i}>{pr.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={label} htmlFor="plabel">Label</label>
          <input id="plabel" name="label" required defaultValue={p.name} key={`label-${preset}`} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="pmodel">Model</label>
          <input id="pmodel" name="model" required defaultValue={p.model} key={`model-${preset}`} className={input} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="purl">Base URL (OpenAI-compatible)</label>
        <input id="purl" name="base_url" required defaultValue={p.baseUrl} key={`url-${preset}`} className={`${input} font-mono text-xs`} />
      </div>
      <div>
        <label className={label} htmlFor="pkey">API key</label>
        <input id="pkey" name="api_key" type="password" required autoComplete="off" className={`${input} font-mono text-xs`} placeholder="sk-…" />
        <p className="mt-1 text-[10px] text-neutral-400">
          Encrypted with AES-256-GCM before storage — never returned to the browser.
        </p>
      </div>

      {testResult && (
        <p className={`rounded-none px-3 py-2 text-xs font-medium ${
          testResult.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}>
          {testResult}
        </p>
      )}
      {state.error && <p className="rounded-none bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded-none bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{state.ok}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={runTest}
          disabled={testing}
          className="rounded-none border-2 border-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-amber-50 disabled:opacity-50"
        >
          {testing ? "Testing…" : "Test connection"}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-none bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add provider"}
        </button>
      </div>
    </form>
  );
}
