-- Make SYP the customer-facing price while retaining the USD base snapshot used
-- by the existing order accounting flow. SYP values have no decimals and are
-- rounded to the nearest 50 pounds.
update public.currency_settings set is_default_display = false where code = 'USD';

update public.currency_settings
set display_label_ar = 'ليرة سورية', decimal_places = 0, enabled = true, is_default_display = true
where code = 'NEW_SYP';

do $$
declare
  v_rate numeric(20,8);
begin
  select rate into v_rate
  from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'NEW_SYP' and active
  order by effective_at desc limit 1;

  if v_rate is not null then
    insert into public.product_prices(product_id, currency, amount_minor, decimal_places)
    select usd.product_id, 'NEW_SYP',
      (ceil(((usd.amount_minor / 100.0) * v_rate) / 50.0) * 50)::bigint,
      0
    from public.product_prices usd
    where usd.currency = 'USD' and usd.active
      and not exists (
        select 1 from public.product_prices syp
        where syp.product_id = usd.product_id and syp.currency = 'NEW_SYP' and syp.active
      );

    insert into public.product_costs(product_id, currency, amount_minor, decimal_places)
    select usd.product_id, 'NEW_SYP',
      (ceil(((usd.amount_minor / 100.0) * v_rate) / 50.0) * 50)::bigint,
      0
    from public.product_costs usd
    where usd.currency = 'USD' and usd.active
      and not exists (
        select 1 from public.product_costs syp
        where syp.product_id = usd.product_id and syp.currency = 'NEW_SYP' and syp.active
      );
  end if;
end;
$$;

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
declare
  v_rate numeric(20,8);
  v_usd_sell bigint;
  v_usd_cost bigint;
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
  if p_currency <> 'NEW_SYP' or p_decimal_places <> 0
    or (p_sell_price_minor is not null and p_sell_price_minor % 50 <> 0)
    or (p_cost_minor is not null and p_cost_minor % 50 <> 0) then
    raise exception 'SYP_PRICE_MUST_BE_ROUNDED_TO_50' using errcode = '22023';
  end if;

  update public.products set
    manufacturer = nullif(trim(coalesce(p_manufacturer, '')), ''),
    unit_label_ar = trim(p_unit_label_ar),
    package_label_ar = nullif(trim(coalesce(p_package_label_ar, '')), ''),
    specifications_ar = nullif(trim(coalesce(p_specifications_ar, '')), '')
  where id = p_product_id;

  perform public.operations_update_product(
    p_product_id, p_name_ar, p_description_ar, p_availability,
    p_low_stock_threshold, p_sell_price_minor, p_cost_minor, p_currency,
    p_decimal_places, p_on_hand, p_inventory_notes, p_image_object_key,
    p_image_mime_type, p_image_width, p_image_height
  );

  -- Keep an active USD base price for the current accounting/order RPC.
  select rate into v_rate from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'NEW_SYP' and active
  order by effective_at desc limit 1;
  if v_rate is null and (p_sell_price_minor is not null or p_cost_minor is not null) then
    raise exception 'EXCHANGE_RATE_NOT_CONFIGURED' using errcode = '22023';
  end if;

  v_usd_sell := case when p_sell_price_minor is null then null else round((p_sell_price_minor / v_rate) * 100)::bigint end;
  v_usd_cost := case when p_cost_minor is null then null else round((p_cost_minor / v_rate) * 100)::bigint end;

  update public.product_prices set active = false, valid_to = greatest(clock_timestamp(), valid_from + interval '1 microsecond')
  where product_id = p_product_id and currency = 'USD' and active;
  if v_usd_sell is not null then
    insert into public.product_prices(product_id, currency, amount_minor, decimal_places)
    values(p_product_id, 'USD', v_usd_sell, 2);
  end if;

  update public.product_costs set active = false, valid_to = greatest(clock_timestamp(), valid_from + interval '1 microsecond')
  where product_id = p_product_id and currency = 'USD' and active;
  if v_usd_cost is not null then
    insert into public.product_costs(product_id, currency, amount_minor, decimal_places)
    values(p_product_id, 'USD', v_usd_cost, 2);
  end if;
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
