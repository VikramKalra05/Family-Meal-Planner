-- ── Multiple models per provider ─────────────────────────────────────────────
-- A provider row keeps `model` as its default, and `models` holds the full
-- fetched list the member picked from the endpoint's /models catalog. The
-- chat model-changer offers every (provider, model) pair.

alter table ai_providers add column if not exists models jsonb not null default '[]'::jsonb;
