-- Add phone and city fields to clients
-- Run this after 009_crm_rls.sql

alter table public.clients
  add column if not exists phone text,
  add column if not exists city text;

create index if not exists idx_clients_user_city
on public.clients (user_id, city);
