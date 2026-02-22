-- Finance module RLS and indexes
-- Run this after 001_auth_profile_setup.sql

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "Users can read own accounts" on public.accounts;
create policy "Users can read own accounts"
on public.accounts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own accounts" on public.accounts;
create policy "Users can insert own accounts"
on public.accounts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own accounts" on public.accounts;
create policy "Users can update own accounts"
on public.accounts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own accounts" on public.accounts;
create policy "Users can delete own accounts"
on public.accounts
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own categories" on public.categories;
create policy "Users can read own categories"
on public.categories
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own categories" on public.categories;
create policy "Users can insert own categories"
on public.categories
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own categories" on public.categories;
create policy "Users can update own categories"
on public.categories
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own categories" on public.categories;
create policy "Users can delete own categories"
on public.categories
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions"
on public.transactions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
on public.transactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
on public.transactions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
on public.transactions
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists idx_accounts_user_created
on public.accounts (user_id, created_at desc);

create index if not exists idx_categories_user_type
on public.categories (user_id, type);

create index if not exists idx_transactions_user_date
on public.transactions (user_id, date desc);

create index if not exists idx_transactions_account_category
on public.transactions (account_id, category_id);
