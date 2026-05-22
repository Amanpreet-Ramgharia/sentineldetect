-- Migration 006: Profile features
-- Run in Supabase SQL Editor

-- Notification preferences + avatar on profiles
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists notification_preferences jsonb
    default '{"weekly_digest":false,"cisa_alerts":false}'::jsonb,
  add column if not exists trusted_devices jsonb default '[]'::jsonb;

-- More detail in usage_stats
alter table public.usage_stats
  add column if not exists details jsonb;

-- Supabase Storage bucket for avatars
-- Run separately in Supabase dashboard > Storage if not exists:
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

-- RLS for avatars storage
-- Allow users to upload their own avatar
create policy if not exists "avatar_upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy if not exists "avatar_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy if not exists "avatar_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy if not exists "avatar_delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Index for faster activity lookups
create index if not exists idx_usage_stats_user_created
  on public.usage_stats(user_id, created_at desc);
