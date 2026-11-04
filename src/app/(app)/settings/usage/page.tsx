import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { formatIstDate } from "@/lib/date";
import {
  formatInrApprox,
  formatTokens,
  formatUsd,
  PRICING_NOTE,
} from "@/lib/ai/pricing";

export const instant = false;

const RANGES = [7, 30, 90] as const;
type RangeDays = (typeof RANGES)[number];

const FEATURE_LABEL: Record<string, string> = {
  meal_log: "AI meal log",
  reel_draft: "Reel → recipe",
  ingredient_estimate: "Ingredient macros",
  provider_test: "Provider test",
  chat: "Other AI",
};

interface UsageRow {
  id: string;
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

interface Aggregate {
  key: string;
  providerId: string | null;
  label: string;
  model: string;
  calls: number;
  prompt: number;
  completion: number;
  reasoning: number;
  total: number;
  cost: number;
  unpriced: number;
  estimated: number;
}

function emptyAgg(key: string): Aggregate {
  return {
    key,
    providerId: null,
    label: "",
    model: "",
    calls: 0,
    prompt: 0,
    completion: 0,
    reasoning: 0,
    total: 0,
    cost: 0,
    unpriced: 0,
    estimated: 0,
  };
}

function addRow(agg: Aggregate, row: UsageRow): void {
  const cost = row.cost_usd == null ? null : Number(row.cost_usd);
  agg.calls += 1;
  agg.prompt += Number(row.prompt_tokens);
  agg.completion += Number(row.completion_tokens);
  agg.reasoning += Number(row.reasoning_tokens ?? 0);
  agg.total += Number(row.total_tokens);
  if (cost == null) agg.unpriced += 1;
  else agg.cost += cost;
  if (row.estimated) agg.estimated += 1;
}

export default async function AiUsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireFullProfile();
  const { days } = await searchParams;
  const requested = Number(typeof days === "string" ? days : 30);
  const range: RangeDays = RANGES.includes(requested as RangeDays) ? (requested as RangeDays) : 30;
  const since = new Date(new Date().getTime() - range * 86400000).toISOString();

  const supabase = await createClient();
  const [providersRes, usageRes] = await Promise.all([
    supabase
      .from("ai_providers")
      .select("id, label, model, is_default")
      .order("is_default", { ascending: false })
      .order("created_at"),
    supabase
      .from("ai_usage_events")
      .select(
        "id, provider_id, provider_label, model, feature, prompt_tokens, completion_tokens, reasoning_tokens, total_tokens, estimated, cost_usd, created_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(3000),
  ]);

  const migrationMissing = Boolean(
    usageRes.error && /ai_usage_events|schema cache|does not exist/i.test(usageRes.error.message),
  );
  const rows = (usageRes.data ?? []) as UsageRow[];
  const providers = (providersRes.data ?? []) as {
    id: string;
    label: string;
    model: string;
    is_default: boolean;
  }[];

  const totals = emptyAgg("total");
  const byProvider = new Map<string, Aggregate>();
  const byFeature = new Map<string, Aggregate>();

  for (const row of rows) {
    addRow(totals, row);

    const providerKey = `${row.provider_id ?? row.provider_label}|${row.model}`;
    const providerAgg = byProvider.get(providerKey) ?? emptyAgg(providerKey);
    if (!providerAgg.label) {
      providerAgg.label = row.provider_label;
      providerAgg.providerId = row.provider_id;
      providerAgg.model = row.model;
    }
    addRow(providerAgg, row);
    byProvider.set(providerKey, providerAgg);

    const featureKey = row.feature;
    const featureAgg = byFeature.get(featureKey) ?? emptyAgg(featureKey);
    featureAgg.label = FEATURE_LABEL[featureKey] ?? featureKey.replaceAll("_", " ");
    addRow(featureAgg, row);
    byFeature.set(featureKey, featureAgg);
  }

  const providerRows = [...byProvider.values()].sort((a, b) => b.total - a.total);
  const featureRows = [...byFeature.values()].sort((a, b) => b.total - a.total);
  const recent = rows.slice(0, 25);
  const pricedCalls = totals.calls - totals.unpriced;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <BackLink href="/settings" label="Settings" />
          <h1 className="mt-2 text-xl font-semibold tracking-tight">AI usage</h1>
          <p className="text-sm text-neutral-500">
            Tokens and estimated cost for every AI call made with your connected provider.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/settings/usage?days=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={`rounded-none border-2 border-neutral-900 px-3 py-2 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all ${
                r === range
                  ? "bg-yellow-300 text-neutral-900"
                  : "bg-white text-neutral-600 hover:bg-yellow-100"
              }`}
            >
              {r} days
            </Link>
          ))}
        </div>
      </div>

      {migrationMissing && (
        <div className="rounded-none border-2 border-neutral-900 bg-amber-200 p-5 shadow-[4px_4px_0_#111]">
          <p className="text-sm font-extrabold uppercase tracking-wide">Usage table not installed</p>
          <p className="mt-1 text-sm text-neutral-700">
            Run <code className="border-2 border-neutral-900 bg-white px-1.5 py-0.5 font-mono text-xs">supabase/migrations/0009_ai_usage.sql</code>{" "}
            in the Supabase SQL editor, then reload this page. AI calls keep working in the meantime —
            they simply aren&apos;t recorded yet.
          </p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">Total tokens</p>
          <p className="mt-1 text-3xl font-extrabold">{formatTokens(totals.total)}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {formatTokens(totals.prompt)} prompt · {formatTokens(totals.completion)} completion
          </p>
        </div>
        <div className="rounded-none border-2 border-neutral-900 bg-violet-200 p-5 shadow-[4px_4px_0_#111]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-600">Reasoning tokens</p>
          <p className="mt-1 text-3xl font-extrabold">{formatTokens(totals.reasoning)}</p>
          <p className="mt-1 text-xs text-neutral-600">
            Reported separately where the provider exposes it; billed as output.
          </p>
        </div>
        <div className="rounded-none border-2 border-neutral-900 bg-lime-200 p-5 shadow-[4px_4px_0_#111]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-700">Estimated cost</p>
          <p className="mt-1 text-3xl font-extrabold">{formatUsd(pricedCalls > 0 ? totals.cost : null)}</p>
          <p className="mt-1 text-xs text-neutral-700">
            ≈ {formatInrApprox(pricedCalls > 0 ? totals.cost : null)} at ₹88/$
            {totals.unpriced > 0 ? ` · ${totals.unpriced} unpriced` : ""}
          </p>
        </div>
        <div className="rounded-none border-2 border-neutral-900 bg-yellow-200 p-5 shadow-[4px_4px_0_#111]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-600">AI calls</p>
          <p className="mt-1 text-3xl font-extrabold">{formatTokens(totals.calls)}</p>
          <p className="mt-1 text-xs text-neutral-600">
            {totals.estimated} token-estimated · last {range} days
          </p>
        </div>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-none border-2 border-neutral-900 bg-white p-10 text-center shadow-[4px_4px_0_#111]">
          <p className="text-4xl">📊</p>
          <p className="mt-3 text-sm font-extrabold uppercase tracking-wide">No AI usage yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
            Use the AI meal log, import a reel, or estimate an ingredient — each call will show up here
            with tokens and cost.
          </p>
          {providers.length > 0 && (
            <p className="mt-2 text-xs text-neutral-400">
              Tracking: {providers.map((p) => `${p.label} (${p.model})`).join(" · ")}
            </p>
          )}
          <Link
            href="/settings"
            className="mt-4 inline-block rounded-none border-2 border-neutral-900 bg-emerald-400 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Manage providers
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">
              By provider
            </h2>
            <div className="overflow-x-auto rounded-none border-2 border-neutral-900 bg-white shadow-[4px_4px_0_#111]">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-neutral-900 bg-yellow-300 text-left text-[10px] font-extrabold uppercase tracking-widest">
                    <th className="px-4 py-3">Provider / model</th>
                    <th className="px-3 py-3 text-right">Calls</th>
                    <th className="px-3 py-3 text-right">Prompt</th>
                    <th className="px-3 py-3 text-right">Completion</th>
                    <th className="px-3 py-3 text-right">Reasoning</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {providerRows.map((p) => (
                    <tr key={p.key} className="border-b-2 border-dashed border-neutral-200 last:border-b-0">
                      <td className="px-4 py-3">
                        {p.providerId ? (
                          <Link href={`/settings/providers/${p.providerId}`} className="font-bold hover:underline">
                            {p.label}
                          </Link>
                        ) : (
                          <span className="font-bold">{p.label}</span>
                        )}
                        <span className="block font-mono text-[10px] text-neutral-400">{p.model}</span>
                      </td>
                      <td className="px-3 py-3 text-right font-bold">{p.calls}</td>
                      <td className="px-3 py-3 text-right">{formatTokens(p.prompt)}</td>
                      <td className="px-3 py-3 text-right">{formatTokens(p.completion)}</td>
                      <td className="px-3 py-3 text-right">{formatTokens(p.reasoning)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-extrabold">
                          {formatUsd(p.unpriced === p.calls ? null : p.cost)}
                        </span>
                        <span className="block text-[10px] text-neutral-400">
                          {formatInrApprox(p.unpriced === p.calls ? null : p.cost)}
                        </span>
                        {p.unpriced > 0 && (
                          <span className="block text-[9px] font-bold uppercase text-amber-700">
                            {p.unpriced} unpriced
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-neutral-900 bg-amber-50 font-extrabold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-3 py-3 text-right">{totals.calls}</td>
                    <td className="px-3 py-3 text-right">{formatTokens(totals.prompt)}</td>
                    <td className="px-3 py-3 text-right">{formatTokens(totals.completion)}</td>
                    <td className="px-3 py-3 text-right">{formatTokens(totals.reasoning)}</td>
                    <td className="px-4 py-3 text-right">
                      {formatUsd(pricedCalls > 0 ? totals.cost : null)}
                      <span className="block text-[10px] font-normal text-neutral-400">
                        {formatInrApprox(pricedCalls > 0 ? totals.cost : null)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-widest text-neutral-500">
              By feature
            </h2>
            <div className="space-y-3">
              {featureRows.map((f) => {
                const share = totals.total > 0 ? (f.total / totals.total) * 100 : 0;
                return (
                  <div key={f.key}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <span className="font-bold">{f.label}</span>
                      <span className="text-neutral-500">
                        {f.calls} call{f.calls === 1 ? "" : "s"} · {formatTokens(f.total)} tokens ·{" "}
                        <span className="font-bold text-neutral-700">
                          {formatUsd(f.unpriced === f.calls ? null : f.cost)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-3 w-full border-2 border-neutral-900 bg-white">
                      <div className="h-full bg-emerald-400" style={{ width: `${Math.max(2, share)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">
              Recent calls
            </h2>
            <div className="overflow-x-auto rounded-none border-2 border-neutral-900 bg-white shadow-[4px_4px_0_#111]">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-neutral-900 bg-yellow-300 text-left text-[10px] font-extrabold uppercase tracking-widest">
                    <th className="px-4 py-3">When</th>
                    <th className="px-3 py-3">Feature</th>
                    <th className="px-3 py-3">Provider / model</th>
                    <th className="px-3 py-3 text-right">Tokens</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id} className="border-b-2 border-dashed border-neutral-200 last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                        {formatIstDate(row.created_at, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-bold">
                          {FEATURE_LABEL[row.feature] ?? row.feature.replaceAll("_", " ")}
                        </span>
                        {row.estimated && (
                          <span className="ml-1 rounded-full border border-neutral-900 bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase">
                            est.
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="block text-xs font-bold">{row.provider_label}</span>
                        <span className="block font-mono text-[10px] text-neutral-400">{row.model}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-bold">{formatTokens(row.total_tokens)}</span>
                        <span className="block text-[9px] text-neutral-400">
                          {formatTokens(row.prompt_tokens)}p · {formatTokens(row.completion_tokens)}c
                          {row.reasoning_tokens ? ` · ${formatTokens(row.reasoning_tokens)}r` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold">{formatUsd(row.cost_usd == null ? null : Number(row.cost_usd))}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="text-[11px] leading-relaxed text-neutral-400">
        {PRICING_NOTE} Unknown models show “—” rather than a guessed price. Usage is stored in
        <code className="mx-1 border border-neutral-300 bg-white px-1 py-0.5 font-mono text-[10px]">ai_usage_events</code>
        and is scoped to your account.
      </p>
    </div>
  );
}
