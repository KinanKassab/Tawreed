create schema if not exists private;

create type public.staff_rank as enum ('operations_manager', 'admin', 'owner');
create type public.order_reservation_status as enum ('active', 'released', 'dispatched');

create table public.staff_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rank public.staff_rank not null,
  active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index staff_accounts_active_rank_idx on public.staff_accounts(active, rank);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events(created_at desc);
create index audit_events_actor_idx on public.audit_events(actor_user_id, created_at desc);

create table public.order_inventory_reservations (
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  warehouse_id uuid not null references public.warehouses(id),
  quantity integer not null check (quantity > 0),
  status public.order_reservation_status not null default 'active',
  reserved_by uuid not null references auth.users(id),
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  dispatched_at timestamptz,
  primary key (order_id, product_id)
);
create index order_reservations_product_idx on public.order_inventory_reservations(product_id, status);

alter table public.inventory_movements add column notes text;
alter table public.inventory_movements add column created_by uuid references auth.users(id) on delete set null;

create or replace function private.has_staff_rank(p_minimum public.staff_rank)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_accounts sa
    where sa.user_id = (select auth.uid())
      and sa.active
      and sa.rank >= p_minimum
  );
$$;
revoke all on function private.has_staff_rank(public.staff_rank) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.has_staff_rank(public.staff_rank) to authenticated;

create or replace function private.capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_row jsonb := coalesce(v_new, v_old);
  v_record_id text;
begin
  v_record_id := coalesce(
    v_row ->> 'id',
    concat_ws(':', v_row ->> 'warehouse_id', v_row ->> 'product_id'),
    v_row ->> 'code'
  );
  insert into public.audit_events(actor_user_id, action, table_name, record_id, old_data, new_data)
  values ((select auth.uid()), lower(tg_op), tg_table_name, nullif(v_record_id, ''), v_old, v_new);
  return coalesce(new, old);
end;
$$;
revoke all on function private.capture_audit_event() from public, anon, authenticated;

create trigger audit_staff_accounts after insert or update or delete on public.staff_accounts
for each row execute function private.capture_audit_event();
create trigger audit_product_prices after insert or update or delete on public.product_prices
for each row execute function private.capture_audit_event();
create trigger audit_exchange_rates after insert or update or delete on public.exchange_rates
for each row execute function private.capture_audit_event();
create trigger audit_products after update on public.products
for each row execute function private.capture_audit_event();
create trigger audit_inventory_balances after insert or update or delete on public.inventory_balances
for each row execute function private.capture_audit_event();
create trigger audit_orders after update on public.orders
for each row execute function private.capture_audit_event();

create trigger set_staff_accounts_updated_at before update on public.staff_accounts
for each row execute function public.set_updated_at();

alter table public.staff_accounts enable row level security;
alter table public.audit_events enable row level security;
alter table public.order_inventory_reservations enable row level security;

create policy staff_accounts_read_self on public.staff_accounts for select to authenticated
using (user_id = (select auth.uid()) and active);
create policy staff_accounts_read_by_admin on public.staff_accounts for select to authenticated
using ((select private.has_staff_rank('admin')));
create policy audit_events_read_by_staff on public.audit_events for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy order_reservations_read_by_staff on public.order_inventory_reservations for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy order_reservations_insert_by_staff on public.order_inventory_reservations for insert to authenticated
with check ((select private.has_staff_rank('operations_manager')) and reserved_by = (select auth.uid()));
create policy order_reservations_update_by_staff on public.order_inventory_reservations for update to authenticated
using ((select private.has_staff_rank('operations_manager')))
with check ((select private.has_staff_rank('operations_manager')));

create policy categories_read_by_staff on public.categories for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy products_read_by_staff on public.products for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy products_update_by_staff on public.products for update to authenticated
using ((select private.has_staff_rank('operations_manager')))
with check ((select private.has_staff_rank('operations_manager')));
create policy product_prices_read_by_staff on public.product_prices for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy product_prices_insert_by_staff on public.product_prices for insert to authenticated
with check ((select private.has_staff_rank('operations_manager')));
create policy product_prices_update_by_staff on public.product_prices for update to authenticated
using ((select private.has_staff_rank('operations_manager')))
with check ((select private.has_staff_rank('operations_manager')));
create policy exchange_rates_read_by_staff on public.exchange_rates for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy exchange_rates_insert_by_staff on public.exchange_rates for insert to authenticated
with check ((select private.has_staff_rank('operations_manager')));
create policy exchange_rates_update_by_staff on public.exchange_rates for update to authenticated
using ((select private.has_staff_rank('operations_manager')))
with check ((select private.has_staff_rank('operations_manager')));
create policy warehouses_read_by_staff on public.warehouses for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy inventory_balances_read_by_staff on public.inventory_balances for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy inventory_balances_insert_by_staff on public.inventory_balances for insert to authenticated
with check ((select private.has_staff_rank('operations_manager')));
create policy inventory_balances_update_by_staff on public.inventory_balances for update to authenticated
using ((select private.has_staff_rank('operations_manager')))
with check ((select private.has_staff_rank('operations_manager')));
create policy inventory_batches_read_by_staff on public.inventory_batches for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy inventory_movements_read_by_staff on public.inventory_movements for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy inventory_movements_insert_by_staff on public.inventory_movements for insert to authenticated
with check ((select private.has_staff_rank('operations_manager')) and created_by = (select auth.uid()));
create policy orders_read_by_staff on public.orders for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy orders_update_by_staff on public.orders for update to authenticated
using ((select private.has_staff_rank('operations_manager')))
with check ((select private.has_staff_rank('operations_manager')));
create policy order_items_read_by_staff on public.order_items for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy order_history_read_by_staff on public.order_status_history for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy order_history_insert_by_staff on public.order_status_history for insert to authenticated
with check ((select private.has_staff_rank('operations_manager')));

revoke all on public.staff_accounts, public.audit_events, public.order_inventory_reservations from anon, authenticated;
grant select on public.staff_accounts, public.audit_events, public.order_inventory_reservations to authenticated;
grant insert, update on public.order_inventory_reservations to authenticated;
grant select on public.warehouses, public.inventory_balances, public.inventory_batches, public.inventory_movements to authenticated;
grant insert, update on public.inventory_balances to authenticated;
grant insert on public.inventory_movements to authenticated;
grant update on public.products to authenticated;
grant insert, update on public.product_prices, public.exchange_rates to authenticated;
grant update on public.orders to authenticated;
grant insert on public.order_status_history to authenticated;

create or replace function public.operations_get_my_context()
returns table(user_id uuid, rank public.staff_rank)
language sql
stable
security invoker
set search_path = ''
as $$
  select sa.user_id, sa.rank
  from public.staff_accounts sa
  where sa.user_id = (select auth.uid()) and sa.active;
$$;
revoke all on function public.operations_get_my_context() from public, anon;
grant execute on function public.operations_get_my_context() to authenticated;

create or replace function public.operations_set_product_price(
  p_product_id uuid,
  p_amount_minor bigint,
  p_currency public.currency_code,
  p_decimal_places smallint
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_price_id uuid;
begin
  if not (select private.has_staff_rank('operations_manager')) then
    raise exception 'STAFF_REQUIRED' using errcode = '42501';
  end if;
  if p_amount_minor < 0 or p_decimal_places not between 0 and 4 then
    raise exception 'INVALID_PRICE' using errcode = '22023';
  end if;
  if not exists(select 1 from public.products where id = p_product_id) then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;
  update public.product_prices
  set active = false, valid_to = now()
  where product_id = p_product_id and currency = p_currency and active;
  insert into public.product_prices(product_id, currency, amount_minor, decimal_places)
  values (p_product_id, p_currency, p_amount_minor, p_decimal_places)
  returning id into v_price_id;
  return v_price_id;
end;
$$;
revoke all on function public.operations_set_product_price(uuid, bigint, public.currency_code, smallint) from public, anon;
grant execute on function public.operations_set_product_price(uuid, bigint, public.currency_code, smallint) to authenticated;

create or replace function public.operations_set_exchange_rate(
  p_base_currency public.currency_code,
  p_quote_currency public.currency_code,
  p_rate numeric
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_rate_id uuid;
begin
  if not (select private.has_staff_rank('operations_manager')) then
    raise exception 'STAFF_REQUIRED' using errcode = '42501';
  end if;
  if p_rate <= 0 or p_base_currency = p_quote_currency then
    raise exception 'INVALID_EXCHANGE_RATE' using errcode = '22023';
  end if;
  update public.exchange_rates set active = false
  where base_currency = p_base_currency and quote_currency = p_quote_currency and active;
  insert into public.exchange_rates(base_currency, quote_currency, rate)
  values (p_base_currency, p_quote_currency, p_rate)
  returning id into v_rate_id;
  return v_rate_id;
end;
$$;
revoke all on function public.operations_set_exchange_rate(public.currency_code, public.currency_code, numeric) from public, anon;
grant execute on function public.operations_set_exchange_rate(public.currency_code, public.currency_code, numeric) to authenticated;

create or replace function public.operations_adjust_inventory(
  p_product_id uuid,
  p_quantity_delta integer,
  p_notes text
)
returns table(on_hand integer, reserved integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_warehouse_id uuid;
  v_warehouse_count integer;
  v_on_hand integer;
  v_reserved integer;
begin
  if not (select private.has_staff_rank('operations_manager')) then
    raise exception 'STAFF_REQUIRED' using errcode = '42501';
  end if;
  if p_quantity_delta = 0 or char_length(trim(coalesce(p_notes, ''))) < 3 then
    raise exception 'INVALID_INVENTORY_ADJUSTMENT' using errcode = '22023';
  end if;
  select count(*), min(id) into v_warehouse_count, v_warehouse_id from public.warehouses where active;
  if v_warehouse_count <> 1 then raise exception 'SINGLE_WAREHOUSE_REQUIRED' using errcode = '55000'; end if;

  insert into public.inventory_balances(warehouse_id, product_id, on_hand, reserved)
  values(v_warehouse_id, p_product_id, 0, 0)
  on conflict (warehouse_id, product_id) do nothing;

  select ib.on_hand, ib.reserved into v_on_hand, v_reserved
  from public.inventory_balances ib
  where ib.warehouse_id = v_warehouse_id and ib.product_id = p_product_id
  for update;
  if v_on_hand + p_quantity_delta < v_reserved then
    raise exception 'ADJUSTMENT_BELOW_RESERVED' using errcode = '23514';
  end if;
  update public.inventory_balances ib
  set on_hand = ib.on_hand + p_quantity_delta, updated_at = now()
  where ib.warehouse_id = v_warehouse_id and ib.product_id = p_product_id
  returning ib.on_hand, ib.reserved into v_on_hand, v_reserved;
  insert into public.inventory_movements(warehouse_id, product_id, movement_type, quantity_delta, reference_type, notes, created_by)
  values(v_warehouse_id, p_product_id, 'adjustment', p_quantity_delta, 'manual_adjustment', trim(p_notes), (select auth.uid()));
  return query select v_on_hand, v_reserved;
end;
$$;
revoke all on function public.operations_adjust_inventory(uuid, integer, text) from public, anon;
grant execute on function public.operations_adjust_inventory(uuid, integer, text) to authenticated;

create or replace function public.operations_confirm_order(p_order_id uuid, p_doctor_message_ar text default null)
returns public.order_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.order_status;
  v_warehouse_id uuid;
  v_warehouse_count integer;
  v_actor uuid := (select auth.uid());
  v_line record;
begin
  if not (select private.has_staff_rank('operations_manager')) then
    raise exception 'STAFF_REQUIRED' using errcode = '42501';
  end if;
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status is null then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_status not in ('received', 'problem') then raise exception 'INVALID_ORDER_STATE' using errcode = '22023'; end if;
  select count(*), min(id) into v_warehouse_count, v_warehouse_id from public.warehouses where active;
  if v_warehouse_count <> 1 then raise exception 'SINGLE_WAREHOUSE_REQUIRED' using errcode = '55000'; end if;

  if exists (
    select 1
    from (
      select oi.product_id, sum(oi.quantity)::integer quantity
      from public.order_items oi where oi.order_id = p_order_id group by oi.product_id
    ) requested
    left join public.inventory_balances ib on ib.warehouse_id = v_warehouse_id and ib.product_id = requested.product_id
    where requested.product_id is null or coalesce(ib.on_hand - ib.reserved, 0) < requested.quantity
  ) then
    update public.orders set status = 'problem', updated_at = now() where id = p_order_id;
    insert into public.order_status_history(order_id, status, doctor_message_ar)
    values(p_order_id, 'problem', coalesce(nullif(trim(p_doctor_message_ar), ''), 'نعمل على التحقق من توفر كامل الطلب وسنتواصل معك قريباً.'));
    return 'problem';
  end if;

  for v_line in
    select oi.product_id, sum(oi.quantity)::integer quantity
    from public.order_items oi where oi.order_id = p_order_id group by oi.product_id
  loop
    update public.inventory_balances
    set reserved = reserved + v_line.quantity, updated_at = now()
    where warehouse_id = v_warehouse_id and product_id = v_line.product_id;
    insert into public.order_inventory_reservations(order_id, product_id, warehouse_id, quantity, reserved_by)
    values(p_order_id, v_line.product_id, v_warehouse_id, v_line.quantity, v_actor)
    on conflict (order_id, product_id) do update
      set quantity = excluded.quantity, status = 'active', reserved_by = excluded.reserved_by,
          reserved_at = now(), released_at = null, dispatched_at = null;
  end loop;
  update public.orders set status = 'preparing', updated_at = now() where id = p_order_id;
  insert into public.order_status_history(order_id, status, doctor_message_ar)
  values(p_order_id, 'preparing', coalesce(nullif(trim(p_doctor_message_ar), ''), 'تم تأكيد توفر كامل الطلب وبدأ التجهيز.'));
  return 'preparing';
end;
$$;
revoke all on function public.operations_confirm_order(uuid, text) from public, anon;
grant execute on function public.operations_confirm_order(uuid, text) to authenticated;

create or replace function public.operations_set_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_doctor_message_ar text default null
)
returns public.order_status
language plpgsql
security invoker
set search_path = ''
as $$
declare v_current public.order_status;
begin
  if not (select private.has_staff_rank('operations_manager')) then
    raise exception 'STAFF_REQUIRED' using errcode = '42501';
  end if;
  select status into v_current from public.orders where id = p_order_id for update;
  if v_current is null then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if not (
    (v_current = 'preparing' and p_status in ('ready_for_delivery', 'problem', 'cancelled')) or
    (v_current = 'ready_for_delivery' and p_status in ('out_for_delivery', 'problem', 'cancelled')) or
    (v_current = 'out_for_delivery' and p_status in ('delivered', 'problem')) or
    (v_current = 'problem' and p_status in ('cancelled'))
  ) then raise exception 'INVALID_ORDER_TRANSITION' using errcode = '22023'; end if;

  if p_status = 'cancelled' then
    update public.inventory_balances ib
    set reserved = ib.reserved - r.quantity, updated_at = now()
    from public.order_inventory_reservations r
    where r.order_id = p_order_id and r.status = 'active'
      and ib.warehouse_id = r.warehouse_id and ib.product_id = r.product_id;
    update public.order_inventory_reservations
    set status = 'released', released_at = now()
    where order_id = p_order_id and status = 'active';
  elsif p_status = 'out_for_delivery' then
    update public.inventory_balances ib
    set on_hand = ib.on_hand - r.quantity, reserved = ib.reserved - r.quantity, updated_at = now()
    from public.order_inventory_reservations r
    where r.order_id = p_order_id and r.status = 'active'
      and ib.warehouse_id = r.warehouse_id and ib.product_id = r.product_id;
    insert into public.inventory_movements(warehouse_id, product_id, movement_type, quantity_delta, reference_type, reference_id, notes, created_by)
    select r.warehouse_id, r.product_id, 'dispatch', -r.quantity, 'order', p_order_id, 'صرف كامل الطلب للتوصيل', (select auth.uid())
    from public.order_inventory_reservations r where r.order_id = p_order_id and r.status = 'active';
    update public.order_inventory_reservations
    set status = 'dispatched', dispatched_at = now()
    where order_id = p_order_id and status = 'active';
  end if;

  update public.orders set status = p_status, updated_at = now() where id = p_order_id;
  insert into public.order_status_history(order_id, status, doctor_message_ar)
  values(p_order_id, p_status, nullif(trim(p_doctor_message_ar), ''));
  return p_status;
end;
$$;
revoke all on function public.operations_set_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.operations_set_order_status(uuid, public.order_status, text) to authenticated;
