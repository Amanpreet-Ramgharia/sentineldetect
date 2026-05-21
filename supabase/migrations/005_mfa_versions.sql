-- Migration 005: Version history improvements + MFA notes
-- Supabase handles MFA natively — no DB changes needed for TOTP
-- This migration adds improvements column to rule_versions

alter table public.rule_versions
  add column if not exists improvements text[] default '{}';

-- Index for faster version lookups
create index if not exists idx_rule_versions_rule_id on public.rule_versions(rule_id);
create index if not exists idx_rule_versions_created on public.rule_versions(created_at desc);
