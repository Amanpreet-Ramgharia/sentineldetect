-- Run in Supabase SQL Editor

-- User API keys (BYOK - Bring Your Own Key)
-- Keys are stored per user with RLS so only the owner can read them
create table if not exists public.user_api_keys (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  provider   text not null check (provider in ('gemini','openai','anthropic','groq')),
  api_key    text not null,
  label      text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, provider)
);

alter table public.user_api_keys enable row level security;

-- Only the owner can see/manage their keys
create policy "keys_select" on public.user_api_keys for select using (user_id = auth.uid());
create policy "keys_insert" on public.user_api_keys for insert with check (user_id = auth.uid());
create policy "keys_update" on public.user_api_keys for update using (user_id = auth.uid());
create policy "keys_delete" on public.user_api_keys for delete using (user_id = auth.uid());

create index idx_user_api_keys_user on public.user_api_keys(user_id);
