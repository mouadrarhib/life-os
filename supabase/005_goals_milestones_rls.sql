-- Goals and milestones access policies
-- Run this after 001_auth_profile_setup.sql

alter table public.goals enable row level security;
alter table public.milestones enable row level security;

drop policy if exists "Users can read own goals" on public.goals;
create policy "Users can read own goals"
on public.goals
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own goals" on public.goals;
create policy "Users can insert own goals"
on public.goals
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own goals" on public.goals;
create policy "Users can update own goals"
on public.goals
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own goals" on public.goals;
create policy "Users can delete own goals"
on public.goals
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own milestones" on public.milestones;
create policy "Users can read own milestones"
on public.milestones
for select
to authenticated
using (
  exists (
    select 1
    from public.goals g
    where g.id = milestones.goal_id
      and g.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own milestones" on public.milestones;
create policy "Users can insert own milestones"
on public.milestones
for insert
to authenticated
with check (
  exists (
    select 1
    from public.goals g
    where g.id = milestones.goal_id
      and g.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own milestones" on public.milestones;
create policy "Users can update own milestones"
on public.milestones
for update
to authenticated
using (
  exists (
    select 1
    from public.goals g
    where g.id = milestones.goal_id
      and g.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.goals g
    where g.id = milestones.goal_id
      and g.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own milestones" on public.milestones;
create policy "Users can delete own milestones"
on public.milestones
for delete
to authenticated
using (
  exists (
    select 1
    from public.goals g
    where g.id = milestones.goal_id
      and g.user_id = auth.uid()
  )
);

create index if not exists idx_goals_user_status_target
on public.goals (user_id, status, target_date);

create index if not exists idx_milestones_goal_done_due
on public.milestones (goal_id, done, due_date);
