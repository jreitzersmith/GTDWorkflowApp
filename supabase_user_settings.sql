-- Migration: user_settings table
-- Run this in the Supabase SQL editor for your project.

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locations jsonb not null default '["Home","Work","Phone","Computer"]'::jsonb,
  efforts   jsonb not null default '["2 min","5 min","10 min","30 min","1 hour","2 hours","6 hours","1 day","3 days","1 week","1 month"]'::jsonb,
  calibration_overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can manage their own settings"
  on public.user_settings
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
