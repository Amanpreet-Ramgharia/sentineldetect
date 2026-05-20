-- Migration 003: User API keys (BYOK)
-- Safe to re-run: uses IF NOT EXISTS

create table if not exists public.user_api_keys (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  provider   text not null check (provider in ('gemini','openai','anthropic','groq')),
  api_key    text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, provider)
);

alter table public.user_api_keys enable row level security;

-- Drop existing policies if they exist, then recreate
do $$ begin
  drop policy if exists "keys_select" on public.user_api_keys;
  drop policy if exists "keys_insert" on public.user_api_keys;
  drop policy if exists "keys_update" on public.user_api_keys;
  drop policy if exists "keys_delete" on public.user_api_keys;
end $$;

create policy "keys_select" on public.user_api_keys for select using (user_id = auth.uid());
create policy "keys_insert" on public.user_api_keys for insert with check (user_id = auth.uid());
create policy "keys_update" on public.user_api_keys for update using (user_id = auth.uid());
create policy "keys_delete" on public.user_api_keys for delete using (user_id = auth.uid());

create index if not exists idx_user_api_keys_user on public.user_api_keys(user_id);
