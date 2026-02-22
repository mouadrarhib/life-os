-- Fitness module RLS and indexes
-- Run this after 001_auth_profile_setup.sql

alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets enable row level security;

-- workouts
drop policy if exists "Users can read own workouts" on public.workouts;
create policy "Users can read own workouts"
on public.workouts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own workouts" on public.workouts;
create policy "Users can insert own workouts"
on public.workouts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own workouts" on public.workouts;
create policy "Users can update own workouts"
on public.workouts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own workouts" on public.workouts;
create policy "Users can delete own workouts"
on public.workouts
for delete
to authenticated
using (auth.uid() = user_id);

-- exercises
drop policy if exists "Users can read own exercises" on public.exercises;
create policy "Users can read own exercises"
on public.exercises
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own exercises" on public.exercises;
create policy "Users can insert own exercises"
on public.exercises
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own exercises" on public.exercises;
create policy "Users can update own exercises"
on public.exercises
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own exercises" on public.exercises;
create policy "Users can delete own exercises"
on public.exercises
for delete
to authenticated
using (auth.uid() = user_id);

-- workout_exercises (ownership inherited from workouts)
drop policy if exists "Users can read own workout exercises" on public.workout_exercises;
create policy "Users can read own workout exercises"
on public.workout_exercises
for select
to authenticated
using (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own workout exercises" on public.workout_exercises;
create policy "Users can insert own workout exercises"
on public.workout_exercises
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own workout exercises" on public.workout_exercises;
create policy "Users can update own workout exercises"
on public.workout_exercises
for update
to authenticated
using (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own workout exercises" on public.workout_exercises;
create policy "Users can delete own workout exercises"
on public.workout_exercises
for delete
to authenticated
using (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
);

-- sets (ownership inherited through workout_exercises -> workouts)
drop policy if exists "Users can read own sets" on public.sets;
create policy "Users can read own sets"
on public.sets
for select
to authenticated
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = sets.workout_exercise_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own sets" on public.sets;
create policy "Users can insert own sets"
on public.sets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = sets.workout_exercise_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own sets" on public.sets;
create policy "Users can update own sets"
on public.sets
for update
to authenticated
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = sets.workout_exercise_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = sets.workout_exercise_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own sets" on public.sets;
create policy "Users can delete own sets"
on public.sets
for delete
to authenticated
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = sets.workout_exercise_id
      and w.user_id = auth.uid()
  )
);

create index if not exists idx_workouts_user_date
on public.workouts (user_id, workout_date desc);

create index if not exists idx_exercises_user_name
on public.exercises (user_id, name);

create index if not exists idx_workout_exercises_workout_order
on public.workout_exercises (workout_id, order_index);

create index if not exists idx_sets_workout_exercise_set_no
on public.sets (workout_exercise_id, set_no);
