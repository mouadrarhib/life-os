-- Add paused status support for focus sessions
-- Run this after 014_task_focus.sql

alter table public.task_focus_sessions
  drop constraint if exists task_focus_sessions_status_check;

alter table public.task_focus_sessions
  add constraint task_focus_sessions_status_check
  check (status in ('running', 'paused', 'completed', 'cancelled'));
