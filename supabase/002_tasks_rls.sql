-- Tasks module RLS and performance indexes
-- Run this after 001_auth_profile_setup.sql

alter table public.tasks enable row level security;

drop policy if exists "Users can read own tasks" on public.tasks;
create policy "Users can read own tasks"
on public.tasks
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own tasks" on public.tasks;
create policy "Users can insert own tasks"
on public.tasks
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own tasks" on public.tasks;
create policy "Users can update own tasks"
on public.tasks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own tasks" on public.tasks;
create policy "Users can delete own tasks"
on public.tasks
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists idx_tasks_user_status_created
on public.tasks (user_id, status, created_at desc);

create index if not exists idx_tasks_user_due
on public.tasks (user_id, due_at);
