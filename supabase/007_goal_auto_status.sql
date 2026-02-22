-- Auto-update goal status based on milestone completion
-- Run this after 005_goals_milestones_rls.sql

create or replace function public.sync_goal_status_from_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_goal_id uuid;
  total_count integer;
  done_count integer;
  current_status text;
begin
  target_goal_id := coalesce(new.goal_id, old.goal_id);

  select count(*)::int,
         count(*) filter (where done = true)::int
    into total_count, done_count
  from public.milestones
  where goal_id = target_goal_id;

  select status
    into current_status
  from public.goals
  where id = target_goal_id;

  if total_count > 0 and done_count = total_count then
    update public.goals
      set status = 'done'
    where id = target_goal_id
      and status <> 'done';
  elsif total_count > 0 and done_count < total_count and current_status = 'done' then
    update public.goals
      set status = 'active'
    where id = target_goal_id;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_goal_status_from_milestones on public.milestones;
create trigger trg_sync_goal_status_from_milestones
after insert or update or delete on public.milestones
for each row
execute procedure public.sync_goal_status_from_milestones();
