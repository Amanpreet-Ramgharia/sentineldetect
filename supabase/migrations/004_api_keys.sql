-- Migration 004: SentinelDetect REST API keys
-- Run in Supabase SQL Editor

create table if not exists public.sd_api_keys (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  key_hash     text not null unique,
  key_preview  text not null,
  last_used_at timestamptz,
  created_at   timestamptz default now() not null
);

alter table public.sd_api_keys enable row level security;

do $$ begin
  drop policy if exists "api_keys_select" on public.sd_api_keys;
  drop policy if exists "api_keys_insert" on public.sd_api_keys;
  drop policy if exists "api_keys_delete" on public.sd_api_keys;
end $$;

create policy "api_keys_select" on public.sd_api_keys for select using (user_id = auth.uid());
create policy "api_keys_insert" on public.sd_api_keys for insert with check (user_id = auth.uid());
create policy "api_keys_delete" on public.sd_api_keys for delete using (user_id = auth.uid());

create index if not exists idx_sd_api_keys_hash on public.sd_api_keys(key_hash);
create index if not exists idx_sd_api_keys_user on public.sd_api_keys(user_id);
