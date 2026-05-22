-- Migration 007: Quality scores, sharing, webhooks, review reminders, community

-- Rule enhancements
alter table public.rules
  add column if not exists is_public        boolean   default false,
  add column if not exists quality_score    integer,
  add column if not exists quality_details  jsonb,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists review_notes     text;

-- Webhook + GitHub settings on profiles  
alter table public.profiles
  add column if not exists webhook_url  text,
  add column if not exists webhook_type text default 'slack';

-- GitHub PAT stored in user_api_keys (provider = 'github')
-- Already exists, just needs 'github' as a valid provider value

-- Public rules index for community page
create index if not exists idx_rules_public on public.rules(is_public, created_at desc)
  where is_public = true;

-- Community page RLS: anyone can read public rules
drop policy if exists "rules_public_read" on public.rules;
create policy "rules_public_read" on public.rules
  for select using (is_public = true);

-- Review reminder: rules not reviewed in 90 days
create index if not exists idx_rules_reviewed on public.rules(user_id, last_reviewed_at);
