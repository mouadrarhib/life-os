-- Auto-sync won deals into finance transactions
-- Run this after 008_finance_rls.sql and 009_crm_rls.sql

alter table public.transactions
  add column if not exists deal_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'transactions'
      and constraint_name = 'transactions_deal_id_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_deal_id_fkey
      foreign key (deal_id)
      references public.deals(id)
      on delete cascade;
  end if;
end $$;

create unique index if not exists idx_transactions_deal_unique
on public.transactions (deal_id)
where deal_id is not null;

create index if not exists idx_transactions_deal_id
on public.transactions (deal_id);

create or replace function public.sync_won_deal_to_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  target_account_id uuid;
  target_category_id uuid;
  target_currency text;
  target_date date;
  target_note text;
  target_amount numeric;
begin
  if tg_op = 'DELETE' then
    delete from public.transactions where deal_id = old.id;
    return old;
  end if;

  select c.user_id into target_user_id
  from public.clients c
  where c.id = new.client_id;

  if target_user_id is null then
    return new;
  end if;

  if new.stage <> 'won' then
    delete from public.transactions where deal_id = new.id;
    return new;
  end if;

  target_amount := coalesce(new.value_amount, 0);
  if target_amount <= 0 then
    delete from public.transactions where deal_id = new.id;
    return new;
  end if;

  target_currency := coalesce(nullif(trim(new.currency), ''), 'USD');
  target_date := coalesce(new.next_step_date, current_date);
  target_note := coalesce(nullif(trim(new.note), ''), 'Auto from won deal: ' || new.title);

  select a.id into target_account_id
  from public.accounts a
  where a.user_id = target_user_id
    and lower(a.name) = lower('Business Revenue')
  limit 1;

  if target_account_id is null then
    insert into public.accounts (user_id, name, type, currency)
    values (target_user_id, 'Business Revenue', 'bank', target_currency)
    returning id into target_account_id;
  end if;

  select cat.id into target_category_id
  from public.categories cat
  where cat.user_id = target_user_id
    and lower(cat.name) = lower('Won Deals')
    and cat.type = 'income'
  limit 1;

  if target_category_id is null then
    insert into public.categories (user_id, name, type)
    values (target_user_id, 'Won Deals', 'income')
    returning id into target_category_id;
  end if;

  insert into public.transactions (user_id, account_id, category_id, amount, date, note, deal_id)
  values (
    target_user_id,
    target_account_id,
    target_category_id,
    target_amount,
    target_date,
    target_note,
    new.id
  )
  on conflict (deal_id) do update
  set
    amount = excluded.amount,
    date = excluded.date,
    note = excluded.note,
    account_id = excluded.account_id,
    category_id = excluded.category_id,
    user_id = excluded.user_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_won_deal_to_transaction on public.deals;
create trigger trg_sync_won_deal_to_transaction
after insert or update or delete on public.deals
for each row
execute procedure public.sync_won_deal_to_transaction();
