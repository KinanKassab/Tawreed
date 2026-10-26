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
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.capture_audit_event() from public, anon, authenticated;

drop policy if exists staff_accounts_read_self on public.staff_accounts;
drop policy if exists staff_accounts_read_by_admin on public.staff_accounts;
drop policy if exists staff_accounts_read_allowed on public.staff_accounts;
create policy staff_accounts_read_allowed on public.staff_accounts for select to authenticated
using ((user_id = (select auth.uid()) and active) or (select private.has_staff_rank('admin')));

drop policy if exists categories_read_active on public.categories;
drop policy if exists categories_read_by_staff on public.categories;
drop policy if exists categories_read_allowed on public.categories;
create policy categories_read_allowed on public.categories for select to authenticated
using (active or (select private.has_staff_rank('operations_manager')));

drop policy if exists products_read_active on public.products;
drop policy if exists products_read_by_staff on public.products;
drop policy if exists products_read_allowed on public.products;
create policy products_read_allowed on public.products for select to authenticated
using (active or (select private.has_staff_rank('operations_manager')));

drop policy if exists product_prices_read_active on public.product_prices;
drop policy if exists product_prices_read_by_staff on public.product_prices;
drop policy if exists product_prices_read_allowed on public.product_prices;
create policy product_prices_read_allowed on public.product_prices for select to authenticated
using (
  (active and exists(select 1 from public.products p where p.id = product_prices.product_id and p.active))
  or (select private.has_staff_rank('operations_manager'))
);

drop policy if exists exchange_rates_read_active on public.exchange_rates;
drop policy if exists exchange_rates_read_by_staff on public.exchange_rates;
drop policy if exists exchange_rates_read_allowed on public.exchange_rates;
create policy exchange_rates_read_allowed on public.exchange_rates for select to authenticated
using (active or (select private.has_staff_rank('operations_manager')));

drop policy if exists orders_select_own on public.orders;
drop policy if exists orders_read_by_staff on public.orders;
drop policy if exists orders_read_allowed on public.orders;
create policy orders_read_allowed on public.orders for select to authenticated
using ((select auth.uid()) = user_id or (select private.has_staff_rank('operations_manager')));

drop policy if exists order_items_select_own on public.order_items;
drop policy if exists order_items_read_by_staff on public.order_items;
drop policy if exists order_items_read_allowed on public.order_items;
create policy order_items_read_allowed on public.order_items for select to authenticated
using (
  exists(select 1 from public.orders o where o.id = order_items.order_id and o.user_id = (select auth.uid()))
  or (select private.has_staff_rank('operations_manager'))
);

drop policy if exists order_history_select_own on public.order_status_history;
drop policy if exists order_history_read_by_staff on public.order_status_history;
drop policy if exists order_history_read_allowed on public.order_status_history;
create policy order_history_read_allowed on public.order_status_history for select to authenticated
using (
  exists(select 1 from public.orders o where o.id = order_status_history.order_id and o.user_id = (select auth.uid()))
  or (select private.has_staff_rank('operations_manager'))
);

grant select, insert, update, delete on public.staff_accounts, public.audit_events, public.order_inventory_reservations to service_role;
grant usage, select on sequence public.audit_events_id_seq to service_role;

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
  select count(*) into v_warehouse_count from public.warehouses where active;
  select id into v_warehouse_id from public.warehouses where active order by code limit 1;
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
  select count(*) into v_warehouse_count from public.warehouses where active;
  select id into v_warehouse_id from public.warehouses where active order by code limit 1;
  if v_warehouse_count <> 1 then raise exception 'SINGLE_WAREHOUSE_REQUIRED' using errcode = '55000'; end if;

  if exists (
    select 1 from public.order_inventory_reservations
    where order_id = p_order_id and status = 'active'
  ) then
    update public.orders set status = 'preparing', updated_at = now() where id = p_order_id;
    insert into public.order_status_history(order_id, status, doctor_message_ar)
    values(p_order_id, 'preparing', coalesce(nullif(trim(p_doctor_message_ar), ''), 'تمت معالجة المشكلة واستؤنف تجهيز كامل الطلب.'));
    return 'preparing'::public.order_status;
  end if;

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
    return 'problem'::public.order_status;
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
  return 'preparing'::public.order_status;
end;
$$;
revoke all on function public.operations_confirm_order(uuid, text) from public, anon;
grant execute on function public.operations_confirm_order(uuid, text) to authenticated;

insert into public.warehouses(code, name_ar, active)
select 'MAIN', 'المستودع الرئيسي', true
where not exists (select 1 from public.warehouses where active)
on conflict (code) do update set name_ar = excluded.name_ar, active = true, updated_at = now();
