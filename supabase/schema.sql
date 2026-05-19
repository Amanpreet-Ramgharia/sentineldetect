-- ─────────────────────────────────────────────────────────────
-- SentinelDetect — Supabase Database Schema
-- Copyright © 2026 Amanpreet Singh Matharu
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Profiles ────────────────────────────────────────────────
-- Auto-created when a user signs up via Supabase Auth
create table public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  email         text not null,
  full_name     text,
  avatar_url    text,
  active_team_id uuid,
  created_at    timestamptz default now() not null
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Teams ────────────────────────────────────────────────────
create table public.teams (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  created_by  uuid references auth.users(id) on delete set null,
  plan        text default 'free' check (plan in ('free', 'pro', 'enterprise')),
  created_at  timestamptz default now() not null
);

-- ── Team Members ─────────────────────────────────────────────
create table public.team_members (
  team_id    uuid references public.teams(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  role       text default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at  timestamptz default now() not null,
  primary key (team_id, user_id)
);

-- ── Detection Rules ──────────────────────────────────────────
create table public.rules (
  id               uuid default uuid_generate_v4() primary key,
  user_id          uuid references auth.users(id) on delete cascade not null,
  team_id          uuid references public.teams(id) on delete set null,
  title            text not null,
  mitre_id         text,
  mitre_name       text,
  tactic           text,
  severity         text check (severity in ('Critical', 'High', 'Medium', 'Low')),
  confidence       smallint check (confidence >= 0 and confidence <= 100),
  data_source      text,
  platform         text not null,
  rule             text not null,
  description      text,
  false_positives  jsonb default '[]',
  tuning_tips      jsonb default '[]',
  response_steps   jsonb default '[]',
  scenario         text,
  note             text,
  tags             text[] default '{}',
  is_favourite     boolean default false,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rules_updated_at
  before update on public.rules
  for each row execute procedure public.update_updated_at();

-- ── Row Level Security ───────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;
alter table public.rules        enable row level security;

-- Profiles: users see/edit only their own
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Teams: members can read, owners can write
create policy "teams_select" on public.teams for select
  using (
    id in (select team_id from public.team_members where user_id = auth.uid())
    or created_by = auth.uid()
  );
create policy "teams_insert" on public.teams for insert with check (auth.uid() is not null);
create policy "teams_update" on public.teams for update using (created_by = auth.uid());
create policy "teams_delete" on public.teams for delete using (created_by = auth.uid());

-- Team members: members can read their own teams
create policy "team_members_select" on public.team_members for select
  using (user_id = auth.uid() or
    team_id in (select team_id from public.team_members where user_id = auth.uid() and role in ('owner', 'admin'))
  );
create policy "team_members_insert" on public.team_members for insert
  with check (
    team_id in (select team_id from public.team_members where user_id = auth.uid() and role in ('owner', 'admin'))
  );

-- Rules: personal rules visible to owner; team rules visible to team members
create policy "rules_select" on public.rules for select
  using (
    user_id = auth.uid()
    or (team_id is not null and team_id in (
      select team_id from public.team_members where user_id = auth.uid()
    ))
  );
create policy "rules_insert" on public.rules for insert
  with check (auth.uid() = user_id);
create policy "rules_update" on public.rules for update
  using (user_id = auth.uid());
create policy "rules_delete" on public.rules for delete
  using (user_id = auth.uid());

-- ── Indexes for performance ──────────────────────────────────
create index idx_rules_user_id    on public.rules(user_id);
create index idx_rules_team_id    on public.rules(team_id);
create index idx_rules_mitre_id   on public.rules(mitre_id);
create index idx_rules_created_at on public.rules(created_at desc);
create index idx_rules_tactic     on public.rules(tactic);
create index idx_team_members_user on public.team_members(user_id);

-- ── Helpful views ────────────────────────────────────────────
-- Coverage stats per user
create or replace view public.user_coverage as
  select
    user_id,
    count(*) as total_rules,
    count(distinct mitre_id) as unique_techniques,
    count(distinct tactic) as unique_tactics,
    array_agg(distinct mitre_id) filter (where mitre_id is not null) as covered_techniques
  from public.rules
  group by user_id;

-- Coverage stats per team
create or replace view public.team_coverage as
  select
    team_id,
    count(*) as total_rules,
    count(distinct mitre_id) as unique_techniques,
    array_agg(distinct mitre_id) filter (where mitre_id is not null) as covered_techniques
  from public.rules
  where team_id is not null
  group by team_id;


-- ── Schema v2 additions ──────────────────────────────────────

-- Custom user templates
create table if not exists public.templates (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  team_id    uuid references public.teams(id) on delete set null,
  label      text not null,
  text       text not null,
  created_at timestamptz default now() not null
);

-- Rule version history
create table if not exists public.rule_history (
  id             uuid default uuid_generate_v4() primary key,
  rule_id        uuid references public.rules(id) on delete cascade not null,
  user_id        uuid references auth.users(id) on delete cascade not null,
  rule_query     text not null,
  title          text,
  change_summary text,
  created_at     timestamptz default now() not null
);

-- Team invitations
create table if not exists public.team_invitations (
  id         uuid default uuid_generate_v4() primary key,
  team_id    uuid references public.teams(id) on delete cascade not null,
  email      text not null,
  role       text default 'member' check (role in ('admin','member')),
  token      text unique not null default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at  timestamptz default now() not null
);

-- Usage logs
create table if not exists public.usage_logs (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  action     text not null,
  provider   text,
  platform   text,
  created_at timestamptz default now() not null
);

-- RLS
alter table public.templates      enable row level security;
alter table public.rule_history   enable row level security;
alter table public.team_invitations enable row level security;
alter table public.usage_logs     enable row level security;

create policy "templates_all"    on public.templates    for all using (auth.uid() = user_id);
create policy "history_select"   on public.rule_history for select using (auth.uid() = user_id);
create policy "history_insert"   on public.rule_history for insert with check (auth.uid() = user_id);
create policy "invites_select"   on public.team_invitations for select using (auth.uid() = invited_by or email = (select email from auth.users where id = auth.uid()));
create policy "invites_insert"   on public.team_invitations for insert with check (team_id in (select team_id from public.team_members where user_id = auth.uid() and role in ('owner','admin')));
create policy "usage_all"        on public.usage_logs   for all using (auth.uid() = user_id);

create index if not exists idx_templates_user  on public.templates(user_id);
create index if not exists idx_history_rule    on public.rule_history(rule_id);
create index if not exists idx_usage_user_date on public.usage_logs(user_id, created_at desc);
