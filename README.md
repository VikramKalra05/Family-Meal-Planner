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
| M8        | **Gym module** — photo-based equipment setup, equipment-aware programs, offline-first set logging, plate calculator, streak, measurements/photos, training-day carb cycling, adaptive weekly loop | ✅ built |

## Gym module (M8)

A training surface that shares the same profile, targets and planner as the
nutrition side.

- **Setup** (`/gym/setup`): tick the equipment your gym actually has (photos,
  famous machines first), set training days, calibrate unlabelled plates by
  colour/size, pick a split (full body 3×, upper/lower 4×, PPL, bro split,
  home dumbbell). The builder drops exercises your equipment can't support.
- **Logging** (`/gym/workout/[id]`): weight-first set rows, last-session
  prefill, one-tap copy, plate calculator with both directions
  (target → plates, plates → total), and an IndexedDB write queue. Sets land
  on the phone instantly; the queue flushes on reconnect, on tab focus, every
  30 s, and through the service worker's Background Sync where supported
  (Android Chrome; iOS Safari flushes on reopen).
- **Plate calculator** (`src/lib/gym/plates.ts`): bounded-knapsack solver over
  the gym's actual inventory, canonical kg storage with the display unit and a
  plate snapshot on every set.
- **Progress** (`/gym/progress`): e1RM trends, hard sets per muscle vs the
  8–20 band, body measurements, private progress photos (signed URLs), and the
  weekly adaptive check-in.
- **Streak** (`/gym/history`): scheduled days only — rest days are neutral,
  today is never "missed", one freeze per calendar month.
- **Nutrition interlock**: training days get +~6% kcal (carbs), rest days
  absorb the offset so the weekly total is unchanged. The planner generates
  against each day's target, not a flat weekly average. The weekly outcome
  loop reads weight trend + strength trend + waist and *suggests* a ±150 kcal
  adjustment; it never changes targets silently.

**Apply** `supabase/migrations/0017_gym.sql` once. It creates the gym tables,
RLS policies, the private `progress-photos` bucket and its storage policies.
The exercise library lives in `src/data/seed-exercises.ts` (no seed step).

**Design decisions**

- Seed exercises are code, referenced by stable keys (`seed:bench-press`).
  Custom exercises live in `custom_exercises` and merge at read time.
- No "calories burned" estimates. MET numbers are noisy and would double-count
  the activity multiplier; training only redistributes the weekly calories.
- The adaptive loop is deterministic, explainable, and suggest-only.
- Gym maths (`src/lib/gym/*`) is isomorphic pure functions, unit-tested in
  `src/lib/gym/gym.test.ts`, so the offline client, the server and the
  assistant share one implementation.

## Deploying to Vercel

1. Import the GitHub repo in Vercel (framework auto-detects Next.js).
2. Add these environment variables (Project → Settings → Environment Variables):

   | Variable | Source |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (anon, public by design) |
   | `API_KEY_ENCRYPTION_KEY` | 32-byte hex — same value as local `.env.local` (decrypts stored provider keys) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Same as local (public key, inlined client-side) |
   | `VAPID_PRIVATE_KEY` | Same as local (server-only) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only — needed by the push cron tick |
   | `CRON_SECRET` | Any long random string — protects `/api/push/tick` (Vercel sends it as a bearer token) |

3. Deploy, then in **Supabase → Authentication → URL Configuration** set the Site URL to the
   Vercel URL (e.g. `https://family-meal-planner.vercel.app`) and add it to the Redirect URLs
   list — otherwise Google OAuth login redirects back to localhost.
4. Push notifications on Vercel run through **Vercel Cron** (`vercel.json`: daily 09:00 IST nudge
   via `/api/push/tick`, bearer-protected by `CRON_SECRET`). The free Hobby plan allows only
   once-daily crons — for the full 60s cadence run the app from a long-lived host instead.

## AI usage & cost

Every AI call made through the BYO-key layer — AI meal logging, reel→recipe
drafts, ingredient macro estimates and provider connection tests — is recorded
in `ai_usage_events` with prompt/completion/reasoning tokens, the provider and
model, and an estimated USD cost. Open **Settings → AI usage** to see totals,
per-provider and per-feature breakdowns, and the latest calls. Providers can be
edited in place (label, endpoint, model, or a rotated key) from
**Settings → AI providers → Edit**.

Apply `supabase/migrations/0009_ai_usage.sql` once in the Supabase SQL editor to
create the ledger. Costs are estimates from public list prices; OpenRouter's
reported cost and local/free endpoints are used as-is, and unknown models show
“—” rather than a guessed number.

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

## Rasoi AI — in-app assistant (✨ header button)

A Gemini-style side panel that can answer questions about your data **and operate the app**.
Every mutation (log meal/weight, add a recipe from a text description, regenerate the week, swap
a dish, pantry, shopping list, family messages, reminders) shows a confirmation card first; the
confirmed action is re-validated server-side against the same zod whitelist before it executes.
Reads (plan, intake, recipes, pantry, weight, usage…) run automatically to ground answers.

- Architecture: closed action-enum protocol over `chatJson` (portable to any BYO OpenAI-compatible
  provider), tool loop in `src/lib/ai/assistant/`, endpoints `POST /api/ai/chat` + `/api/ai/chat/act`.
- History persists in `ai_chat_messages` (migration `0010_ai_chat.sql`, append-only RLS).
- Every model call lands in the usage ledger with feature `assistant` (see `/settings/usage`).
- Rate limit: 20 questions/hour, 30 confirmations/hour. Requires an AI provider key in Settings.
