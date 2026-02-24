-- Fix won-deal -> finance sync trigger for status updates
-- Run this after 011_deals_won_to_finance.sql

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
  updated_rows integer;
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

  update public.transactions t
  set
    user_id = target_user_id,
    account_id = target_account_id,
    category_id = target_category_id,
    amount = target_amount,
    date = target_date,
    note = target_note
  where t.deal_id = new.id;

  get diagnostics updated_rows = row_count;

  if updated_rows = 0 then
    insert into public.transactions (user_id, account_id, category_id, amount, date, note, deal_id)
    values (
      target_user_id,
      target_account_id,
      target_category_id,
      target_amount,
      target_date,
      target_note,
      new.id
    );
  end if;

  return new;
end;
$$;
