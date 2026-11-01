# Family Meal Planner — AI Personal Nutrition Planner

India-first family meal platform: per-member nutrition targets, hybrid weekly
planning (shared dinners + personal meals), household pantry, aggregated
shopping lists, recipe ingestion from reels via AI, craving re-optimization,
and Kitchen Mode for cooks.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind 4, PWA)
- **Supabase** — Postgres, Auth (Google OAuth + Phone OTP), Row Level Security
- **Deterministic nutrition engine** (`src/lib/nutrition`) — Mifflin-St Jeor
  BMR → TDEE → goal-adjusted targets with safety floors; unit-tested, zero AI
- **BYO-key LLM layer** (M2) — any OpenAI-compatible provider (Z.ai GLM,
  OpenAI, Gemini, Groq, Ollama) configured per user

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations in `supabase/migrations/` via the SQL editor or
   `supabase db push`.
3. Enable the **Google** provider and **Phone** auth in
   Authentication → Providers.
4. Put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
   `.env.local`.

## Scripts

| Command         | What it does            |
| --------------- | ----------------------- |
| `npm run dev`   | Dev server (Turbopack)  |
| `npm run build` | Production build        |
| `npm run test`  | Vitest (engine + more)  |
| `npm run lint`  | ESLint                  |

## Roadmap

| Milestone | Scope                                                                      | Status |
| --------- | -------------------------------------------------------------------------- | ------ |
| M0        | Scaffold, schema + RLS, auth, households/invites, profiles, nutrition engine | ✅ done |
| M1        | Seed recipe pipeline, recipe CRUD, nutrition compute, pantry                 | ✅ done |
| M2        | BYO-LLM settings + adapter, reel→recipe flow, AI nutrition estimation        | ✅ built (needs user's API key to run end-to-end) |
| M3        | Hybrid weekly planner, ingredient aggregation, shopping list, WhatsApp share | ✅ done |
| M4        | Intake logging (forms + AI chat), Today dashboard, craving re-optimization   | ✅ done |
| M5        | Kitchen Mode, family suggestions/instructions feed                           | ✅ done |
| M6        | Evaluation module (E1/E4), PWA (sw + share target), attribution, neobrutalist design | ✅ done |
| M7        | Background web push (weigh-in reminders with the app closed, VAPID + server scheduler) | ✅ done |

## Background push notifications

Weigh-in reminders work in two layers:

1. **In-app** — while a tab is open, `WeighInReminder` fires browser
   notifications on the member's schedule.
2. **Background** — once notification permission is granted, the device's
   push subscription is stored (`push_subscriptions`) and the scheduler in
   `src/lib/push-scheduler.ts` (started via `src/instrumentation.ts` when the
   server boots) delivers the same reminder through Web Push — even when the
   app is closed. Cadence in both layers: only after the chosen time, max
   2/day, 4h apart, never on an already-logged day. All clock math is IST.

Required env (already in `.env.local` locally): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
+ `VAPID_PRIVATE_KEY` (generate with `npx web-push generate-vapid-keys`),
plus `SUPABASE_SERVICE_ROLE_KEY` for the scheduler. Reminder cadence logic is
pure and unit-tested in `src/lib/push.ts`. Test any device with the
"🔔 Test push" button on the Today dashboard.
