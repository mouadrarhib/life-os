-- Milestone ordering support for drag-and-drop/manual reordering
-- Run this after 005_goals_milestones_rls.sql

alter table public.milestones
  add column if not exists order_index integer;

with numbered as (
  select id, row_number() over (partition by goal_id order by created_at asc) as rn
  from public.milestones
)
update public.milestones m
set order_index = n.rn
from numbered n
where m.id = n.id
  and m.order_index is null;

create index if not exists idx_milestones_goal_order
on public.milestones (goal_id, order_index);
