"use client";

import { useActionState, useState, useTransition } from "react";
import { updateAiProvider, testProviderUpdate, type ProviderActionState } from "@/app/(app)/settings/actions";
import { ModelPicker } from "../../model-picker";
import { AiWorking } from "@/components/ai-working";

const input =
  "w-full rounded-none border-2 border-neutral-900 bg-white px-3.5 py-2.5 text-sm transition focus:shadow-[3px_3px_0_#111] focus:outline-none disabled:bg-neutral-100";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500";

export function EditProviderForm({
  provider,
}: {
  provider: { id: string; label: string; base_url: string; model: string; is_default: boolean; models: string[] | null };
}) {
  const [state, action, pending] = useActionState<ProviderActionState, FormData>(updateAiProvider, {
    error: null,
    ok: null,
  });
  const [modelsJson, setModelsJson] = useState(JSON.stringify(provider.models ?? []));
  const [baseUrl, setBaseUrl] = useState(provider.base_url);
  const [model, setModel] = useState(provider.model);
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, startTesting] = useTransition();

  function runTest() {
    setTestResult(null);
    startTesting(async () => {
      const res = await testProviderUpdate(provider.id, baseUrl, model, apiKey);
      setTestResult(res.ok ? `✓ Connected in ${res.latencyMs}ms` : `✕ ${res.error}`);
    });
  }

  return (
    <form action={action} aria-busy={pending || testing} className="space-y-4">
      <input type="hidden" name="id" value={provider.id} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={label} htmlFor="label">Label</label>
          <input
            id="label"
            name="label"
            required
            defaultValue={provider.label}
            disabled={pending}
            className={input}
          />
        </div>
        <div>
          <label className={label} htmlFor="model">Model</label>
          <input
            id="model"
            name="model"
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={pending}
            className={input}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="base_url">Base URL (OpenAI-compatible)</label>
        <input
          id="base_url"
          name="base_url"
          required
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          disabled={pending}
          className={`${input} font-mono text-xs`}
        />
      </div>

      <ModelPicker
        getCredentials={() => ({ base_url: baseUrl, api_key: apiKey, provider_id: provider.id })}
        initialModels={provider.models ?? []}
        onModelsChange={(models: string[]) => setModelsJson(JSON.stringify(models))}
      />
      <input type="hidden" name="models_json" value={modelsJson} />

      <div>
        <label className={label} htmlFor="api_key">Replace API key (optional)</label>
        <input
          id="api_key"
          name="api_key"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={pending}
          className={`${input} font-mono text-xs`}
          placeholder="Leave blank to keep the current key"
        />
        <p className="mt-1 text-[10px] text-neutral-400">
          Keys are encrypted with AES-256-GCM before storage and never sent back to the browser.
          {provider.is_default ? " This is your default provider." : ""}
        </p>
      </div>

      {testResult && (
        <p
          role="status"
          aria-live="polite"
          className={`rounded-none px-3 py-2 text-xs font-medium ${
            testResult.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {testResult}
        </p>
      )}
      {testing && (
        <AiWorking
          label="Testing the endpoint…"
          hint="A tiny completion checks the URL, model and key. Leave the key blank to test with the stored one."
        />
      )}
      {state.error && (
        <p className="rounded-none bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{state.error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t-2 border-neutral-900 pt-4">
        <button
          type="button"
          onClick={runTest}
          disabled={testing || pending || !baseUrl.trim() || !model.trim()}
          className={`rounded-none border-2 border-neutral-900 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-amber-50 disabled:opacity-60 ${
            testing ? "nb-loading cursor-wait" : ""
          }`}
        >
          {testing ? "◌ Testing…" : "Test connection"}
        </button>
        <button
          type="submit"
          disabled={pending || testing}
          className={`flex-1 rounded-none bg-emerald-400 text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide disabled:opacity-60 ${
            pending ? "nb-loading cursor-wait" : ""
          }`}
        >
          {pending ? "◌ Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
