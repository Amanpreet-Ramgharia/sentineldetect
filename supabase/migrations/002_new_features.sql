-- Migration 002: Rule versions, custom templates, usage stats
-- Safe to re-run

create table if not exists public.rule_versions (
  id         uuid default uuid_generate_v4() primary key,
  rule_id    uuid references public.rules(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  rule_data  jsonb not null,
  version    integer not null default 1,
  created_at timestamptz default now() not null
);
alter table public.rule_versions enable row level security;
do $$ begin
  drop policy if exists "versions_select" on public.rule_versions;
  drop policy if exists "versions_insert" on public.rule_versions;
end $$;
create policy "versions_select" on public.rule_versions for select using (user_id = auth.uid());
create policy "versions_insert" on public.rule_versions for insert with check (user_id = auth.uid());

create table if not exists public.custom_templates (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  label      text not null,
  text       text not null,
  created_at timestamptz default now() not null
);
alter table public.custom_templates enable row level security;
do $$ begin
  drop policy if exists "templates_all" on public.custom_templates;
end $$;
create policy "templates_all" on public.custom_templates for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.usage_stats (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  action     text not null,
  provider   text,
  created_at timestamptz default now() not null
);
alter table public.usage_stats enable row level security;
do $$ begin
  drop policy if exists "usage_insert" on public.usage_stats;
  drop policy if exists "usage_select" on public.usage_stats;
end $$;
create policy "usage_insert" on public.usage_stats for insert with check (user_id = auth.uid());
create policy "usage_select" on public.usage_stats for select using (user_id = auth.uid());
