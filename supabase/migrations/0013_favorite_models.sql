-- ── Favorite models per provider ─────────────────────────────────────────────
-- A subset of the provider's `models` catalog that the member starred; the
-- chat model-changer sorts these to the top.

alter table ai_providers add column if not exists favorite_models jsonb not null default '[]'::jsonb;
