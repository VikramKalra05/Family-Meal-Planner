-- Assistant privacy mode: when enabled, weight and allergy details never
-- transit to the AI provider (context snapshot, query_weight, query_family).
alter table profiles add column if not exists assistant_privacy_mode boolean not null default false;
