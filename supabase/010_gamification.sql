-- Gamification data model updates
-- Run this after 001_auth_profile_setup.sql

alter table public.profiles
  add column if not exists xp_total integer not null default 0,
  add column if not exists level integer not null default 1,
  add column if not exists last_level_up_at timestamp with time zone;

alter table public.tasks
  add column if not exists done_at timestamp with time zone;

update public.tasks
set done_at = coalesce(done_at, created_at)
where status = 'done'
  and done_at is null;

create index if not exists idx_tasks_user_done_at
on public.tasks (user_id, done_at);

create index if not exists idx_profiles_level_xp
on public.profiles (level, xp_total);
