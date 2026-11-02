-- USD is the operational source of truth. Customer-facing NEW_SYP prices are
-- derived from the latest active USD -> NEW_SYP rate and rounded upward to 5.

create or replace function private.sync_product_price_to_syp(p_product_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usd_amount bigint;
  v_usd_decimals smallint;
  v_rate numeric(20,8);
  v_syp_amount bigint;
  v_current_syp bigint;
begin
  select amount_minor, decimal_places
  into v_usd_amount, v_usd_decimals
  from public.product_prices
  where product_id = p_product_id and currency = 'USD' and active
  order by valid_from desc
  limit 1;

  if not found then
    update public.product_prices
    set active = false,
        valid_to = greatest(clock_timestamp(), valid_from + interval '1 microsecond')
    where product_id = p_product_id and currency = 'NEW_SYP' and active;
    return;
  end if;

  select rate into v_rate
  from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'NEW_SYP' and active
  order by effective_at desc
  limit 1;

  if v_rate is null then
    raise exception 'EXCHANGE_RATE_NOT_CONFIGURED' using errcode = '22023';
  end if;

  v_syp_amount := (
    ceil(((v_usd_amount / power(10::numeric, v_usd_decimals)) * v_rate) / 5) * 5
  )::bigint;

  select amount_minor into v_current_syp
  from public.product_prices
  where product_id = p_product_id and currency = 'NEW_SYP' and active
  order by valid_from desc
  limit 1;

  if found and v_current_syp = v_syp_amount then
    return;
  end if;

  update public.product_prices
  set active = false,
      valid_to = greatest(clock_timestamp(), valid_from + interval '1 microsecond')
  where product_id = p_product_id and currency = 'NEW_SYP' and active;

  insert into public.product_prices(product_id, currency, amount_minor, decimal_places)
  values (p_product_id, 'NEW_SYP', v_syp_amount, 0);
end;
$$;

create or replace function private.sync_product_cost_to_syp(p_product_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usd_amount bigint;
  v_usd_decimals smallint;
  v_rate numeric(20,8);
  v_syp_amount bigint;
  v_current_syp bigint;
begin
  select amount_minor, decimal_places
  into v_usd_amount, v_usd_decimals
  from public.product_costs
  where product_id = p_product_id and currency = 'USD' and active
  order by valid_from desc
  limit 1;

  if not found then
    update public.product_costs
    set active = false,
        valid_to = greatest(clock_timestamp(), valid_from + interval '1 microsecond')
    where product_id = p_product_id and currency = 'NEW_SYP' and active;
    return;
  end if;

  select rate into v_rate
  from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'NEW_SYP' and active
  order by effective_at desc
  limit 1;

  if v_rate is null then
    raise exception 'EXCHANGE_RATE_NOT_CONFIGURED' using errcode = '22023';
  end if;

  v_syp_amount := (
    ceil(((v_usd_amount / power(10::numeric, v_usd_decimals)) * v_rate) / 5) * 5
  )::bigint;

  select amount_minor into v_current_syp
  from public.product_costs
  where product_id = p_product_id and currency = 'NEW_SYP' and active
  order by valid_from desc
  limit 1;

  if found and v_current_syp = v_syp_amount then
    return;
  end if;

  update public.product_costs
  set active = false,
      valid_to = greatest(clock_timestamp(), valid_from + interval '1 microsecond')
  where product_id = p_product_id and currency = 'NEW_SYP' and active;

  insert into public.product_costs(product_id, currency, amount_minor, decimal_places)
  values (p_product_id, 'NEW_SYP', v_syp_amount, 0);
end;
$$;

create or replace function private.sync_product_price_to_syp_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_currency public.currency_code;
begin
  if tg_op = 'DELETE' then
    v_product_id := old.product_id;
    v_currency := old.currency;
  else
    v_product_id := new.product_id;
    v_currency := new.currency;
  end if;

  if v_currency = 'USD' then
    perform private.sync_product_price_to_syp(v_product_id);
  end if;
  return null;
end;
$$;

create or replace function private.sync_product_cost_to_syp_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_currency public.currency_code;
begin
  if tg_op = 'DELETE' then
    v_product_id := old.product_id;
    v_currency := old.currency;
  else
    v_product_id := new.product_id;
    v_currency := new.currency;
  end if;

  if v_currency = 'USD' then
    perform private.sync_product_cost_to_syp(v_product_id);
  end if;
  return null;
end;
$$;

drop trigger if exists sync_product_price_to_syp on public.product_prices;
create trigger sync_product_price_to_syp
after insert or update or delete on public.product_prices
for each row execute function private.sync_product_price_to_syp_trigger();

drop trigger if exists sync_product_cost_to_syp on public.product_costs;
create trigger sync_product_cost_to_syp
after insert or update or delete on public.product_costs
for each row execute function private.sync_product_cost_to_syp_trigger();

create or replace function private.sync_all_usd_values_to_syp_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product_id uuid;
begin
  if new.active
    and new.base_currency = 'USD'
    and new.quote_currency = 'NEW_SYP' then
    for v_product_id in
      select distinct product_id from public.product_prices
      where currency = 'USD' and active
    loop
      perform private.sync_product_price_to_syp(v_product_id);
    end loop;

    for v_product_id in
      select distinct product_id from public.product_costs
      where currency = 'USD' and active
    loop
      perform private.sync_product_cost_to_syp(v_product_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_all_usd_values_to_syp on public.exchange_rates;
create trigger sync_all_usd_values_to_syp
after insert or update of rate, active on public.exchange_rates
for each row execute function private.sync_all_usd_values_to_syp_trigger();

-- The Operations editor accepts USD (minor units, two decimals). The base
-- updater writes USD, and the triggers above publish the derived SYP price.
create or replace function public.operations_update_product(
  p_product_id uuid,
  p_name_ar text,
  p_manufacturer text,
  p_unit_label_ar text,
  p_package_label_ar text,
  p_description_ar text,
  p_specifications_ar text,
  p_availability public.product_availability,
  p_low_stock_threshold integer,
  p_sell_price_minor bigint,
  p_cost_minor bigint,
  p_currency public.currency_code,
  p_decimal_places smallint,
  p_on_hand integer,
  p_inventory_notes text,
  p_image_object_key text,
  p_image_mime_type text,
  p_image_width integer,
  p_image_height integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.has_staff_rank('operations_manager')) then
    raise exception 'STAFF_REQUIRED' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_unit_label_ar, ''))) < 1
    or char_length(coalesce(p_manufacturer, '')) > 200
    or char_length(coalesce(p_package_label_ar, '')) > 120
    or char_length(coalesce(p_specifications_ar, '')) > 5000 then
    raise exception 'INVALID_PRODUCT_DETAILS' using errcode = '22023';
  end if;
  if p_currency <> 'USD' or p_decimal_places <> 2 then
    raise exception 'USD_PRICE_REQUIRED' using errcode = '22023';
  end if;

  update public.products set
    manufacturer = nullif(trim(coalesce(p_manufacturer, '')), ''),
    unit_label_ar = trim(p_unit_label_ar),
    package_label_ar = nullif(trim(coalesce(p_package_label_ar, '')), ''),
    specifications_ar = nullif(trim(coalesce(p_specifications_ar, '')), '')
  where id = p_product_id;

  perform public.operations_update_product(
    p_product_id, p_name_ar, p_description_ar, p_availability,
    p_low_stock_threshold, p_sell_price_minor, p_cost_minor, 'USD'::public.currency_code,
    2::smallint, p_on_hand, p_inventory_notes, p_image_object_key,
    p_image_mime_type, p_image_width, p_image_height
  );
end;
$$;

revoke all on function public.operations_update_product(
  uuid, text, text, text, text, text, text, public.product_availability,
  integer, bigint, bigint, public.currency_code, smallint, integer, text,
  text, text, integer, integer
) from public, anon;
grant execute on function public.operations_update_product(
  uuid, text, text, text, text, text, text, public.product_availability,
  integer, bigint, bigint, public.currency_code, smallint, integer, text,
  text, text, integer, integer
) to authenticated;

-- Backfill every current USD price/cost immediately using the active rate.
do $$
declare
  v_product_id uuid;
begin
  for v_product_id in
    select distinct product_id from public.product_prices
    where currency = 'USD' and active
  loop
    perform private.sync_product_price_to_syp(v_product_id);
  end loop;

  for v_product_id in
    select distinct product_id from public.product_costs
    where currency = 'USD' and active
  loop
    perform private.sync_product_cost_to_syp(v_product_id);
  end loop;
end;
$$;

revoke all on function private.sync_product_price_to_syp(uuid) from public, anon;
revoke all on function private.sync_product_cost_to_syp(uuid) from public, anon;
grant execute on function private.sync_product_price_to_syp(uuid) to authenticated;
grant execute on function private.sync_product_cost_to_syp(uuid) to authenticated;
revoke all on function private.sync_product_price_to_syp_trigger() from public, anon, authenticated;
revoke all on function private.sync_product_cost_to_syp_trigger() from public, anon, authenticated;
revoke all on function private.sync_all_usd_values_to_syp_trigger() from public, anon, authenticated;
