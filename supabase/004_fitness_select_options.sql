-- Fitness option tables for select fields
-- Run this after 003_fitness_rls.sql

create table if not exists public.fitness_muscle_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);

create unique index if not exists idx_fitness_muscle_groups_name_lower
on public.fitness_muscle_groups (lower(name));

create table if not exists public.fitness_equipments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);

create unique index if not exists idx_fitness_equipments_name_lower
on public.fitness_equipments (lower(name));

alter table public.fitness_muscle_groups enable row level security;
alter table public.fitness_equipments enable row level security;

drop policy if exists "Authenticated can read muscle groups" on public.fitness_muscle_groups;
create policy "Authenticated can read muscle groups"
on public.fitness_muscle_groups
for select
to authenticated
using (true);

drop policy if exists "Authenticated can read equipments" on public.fitness_equipments;
create policy "Authenticated can read equipments"
on public.fitness_equipments
for select
to authenticated
using (true);

insert into public.fitness_muscle_groups (name)
values
  ('Back'),
  ('Biceps'),
  ('Chest'),
  ('Core'),
  ('Forearms'),
  ('Full Body'),
  ('Glutes'),
  ('Hamstrings'),
  ('Legs'),
  ('Shoulders'),
  ('Triceps')
on conflict do nothing;

insert into public.fitness_equipments (name)
values
  ('Barbell'),
  ('Bodyweight'),
  ('Cable'),
  ('Dumbbells'),
  ('EZ Bar'),
  ('Kettlebell'),
  ('Machine'),
  ('Resistance Band'),
  ('Smith Machine')
on conflict do nothing;

alter table public.exercises
  add column if not exists muscle_group_id uuid,
  add column if not exists equipment_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'exercises'
      and constraint_name = 'exercises_muscle_group_id_fkey'
  ) then
    alter table public.exercises
      add constraint exercises_muscle_group_id_fkey
      foreign key (muscle_group_id)
      references public.fitness_muscle_groups(id);
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'exercises'
      and constraint_name = 'exercises_equipment_id_fkey'
  ) then
    alter table public.exercises
      add constraint exercises_equipment_id_fkey
      foreign key (equipment_id)
      references public.fitness_equipments(id);
  end if;
end $$;

update public.exercises e
set muscle_group_id = mg.id
from public.fitness_muscle_groups mg
where e.muscle_group_id is null
  and e.muscle_group is not null
  and lower(trim(e.muscle_group)) = lower(trim(mg.name));

update public.exercises e
set equipment_id = fe.id
from public.fitness_equipments fe
where e.equipment_id is null
  and e.equipment is not null
  and lower(trim(e.equipment)) = lower(trim(fe.name));

create index if not exists idx_exercises_muscle_group_id
on public.exercises (muscle_group_id);

create index if not exists idx_exercises_equipment_id
on public.exercises (equipment_id);
