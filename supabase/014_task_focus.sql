-- Task focus sessions and pomodoro settings
-- Run this after 010_gamification.sql

create table if not exists public.user_focus_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  focus_minutes integer not null default 25 check (focus_minutes between 10 and 120),
  break_minutes integer not null default 5 check (break_minutes between 1 and 60),
  auto_start_break boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.task_focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  mode text not null check (mode in ('pomodoro', 'manual')),
  status text not null default 'running' check (status in ('running', 'paused', 'completed', 'cancelled')),
  is_break boolean not null default false,
  planned_minutes integer,
  actual_minutes integer,
  started_at timestamp with time zone not null default now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create unique index if not exists idx_task_focus_one_running_per_user
on public.task_focus_sessions (user_id)
where status = 'running';

create index if not exists idx_task_focus_user_started
on public.task_focus_sessions (user_id, started_at desc);

create index if not exists idx_task_focus_task_started
on public.task_focus_sessions (task_id, started_at desc);

alter table public.user_focus_settings enable row level security;
alter table public.task_focus_sessions enable row level security;

drop policy if exists "Users can read own focus settings" on public.user_focus_settings;
create policy "Users can read own focus settings"
on public.user_focus_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own focus settings" on public.user_focus_settings;
create policy "Users can insert own focus settings"
on public.user_focus_settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own focus settings" on public.user_focus_settings;
create policy "Users can update own focus settings"
on public.user_focus_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own focus sessions" on public.task_focus_sessions;
create policy "Users can read own focus sessions"
on public.task_focus_sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own focus sessions" on public.task_focus_sessions;
create policy "Users can insert own focus sessions"
on public.task_focus_sessions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own focus sessions" on public.task_focus_sessions;
create policy "Users can update own focus sessions"
on public.task_focus_sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own focus sessions" on public.task_focus_sessions;
create policy "Users can delete own focus sessions"
on public.task_focus_sessions
for delete
to authenticated
using (auth.uid() = user_id);
