-- CRM module RLS and indexes
-- Run this after 001_auth_profile_setup.sql

alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.deals enable row level security;

-- clients (direct ownership)
drop policy if exists "Users can read own clients" on public.clients;
create policy "Users can read own clients"
on public.clients
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own clients" on public.clients;
create policy "Users can insert own clients"
on public.clients
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own clients" on public.clients;
create policy "Users can update own clients"
on public.clients
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own clients" on public.clients;
create policy "Users can delete own clients"
on public.clients
for delete
to authenticated
using (auth.uid() = user_id);

-- client_contacts (ownership inherited from clients)
drop policy if exists "Users can read own client contacts" on public.client_contacts;
create policy "Users can read own client contacts"
on public.client_contacts
for select
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_contacts.client_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own client contacts" on public.client_contacts;
create policy "Users can insert own client contacts"
on public.client_contacts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.clients c
    where c.id = client_contacts.client_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own client contacts" on public.client_contacts;
create policy "Users can update own client contacts"
on public.client_contacts
for update
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_contacts.client_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = client_contacts.client_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own client contacts" on public.client_contacts;
create policy "Users can delete own client contacts"
on public.client_contacts
for delete
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_contacts.client_id
      and c.user_id = auth.uid()
  )
);

-- deals (ownership inherited from clients)
drop policy if exists "Users can read own deals" on public.deals;
create policy "Users can read own deals"
on public.deals
for select
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = deals.client_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own deals" on public.deals;
create policy "Users can insert own deals"
on public.deals
for insert
to authenticated
with check (
  exists (
    select 1
    from public.clients c
    where c.id = deals.client_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own deals" on public.deals;
create policy "Users can update own deals"
on public.deals
for update
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = deals.client_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = deals.client_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own deals" on public.deals;
create policy "Users can delete own deals"
on public.deals
for delete
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = deals.client_id
      and c.user_id = auth.uid()
  )
);

create index if not exists idx_clients_user_status_created
on public.clients (user_id, status, created_at desc);

create index if not exists idx_client_contacts_client_created
on public.client_contacts (client_id, created_at);

create index if not exists idx_deals_client_stage_created
on public.deals (client_id, stage, created_at desc);

create index if not exists idx_deals_next_step_date
on public.deals (next_step_date);
