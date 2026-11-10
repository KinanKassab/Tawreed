-- A bundle offer sells at a fixed USD price chosen by staff, not at the sum of its products.
-- The SYP column is derived from the active rate, like product prices, so visitors can read it.
alter table public.promo_banners
  add column bundle_price_usd_minor bigint check (bundle_price_usd_minor is null or bundle_price_usd_minor > 0),
  add column bundle_price_syp_minor bigint;

comment on column public.promo_banners.bundle_price_usd_minor is
  'Fixed price of the whole bundle in USD cents. An offer without a price is not sold.';
comment on column public.promo_banners.bundle_price_syp_minor is
  'Derived from bundle_price_usd_minor and the active USD to NEW_SYP rate, rounded up to 5.';

alter table public.orders add column applied_bundle_ids uuid[];

comment on column public.orders.applied_bundle_ids is
  'Bundle offers whose fixed price was applied to this order. Also guards against applying them twice on a replay.';

create or replace function private.bundle_usd_to_syp(p_usd_minor bigint)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select (ceil(((p_usd_minor / 100::numeric) * rate) / 5) * 5)::bigint
  from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'NEW_SYP' and active
  order by effective_at desc
  limit 1;
$$;

create or replace function private.sync_banner_price_to_syp_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.bundle_price_syp_minor := private.bundle_usd_to_syp(new.bundle_price_usd_minor);
  return new;
end;
$$;

create trigger sync_banner_price_to_syp
before insert or update of bundle_price_usd_minor on public.promo_banners
for each row execute function private.sync_banner_price_to_syp_trigger();

create or replace function private.sync_all_banner_prices_to_syp_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active and new.base_currency = 'USD' and new.quote_currency = 'NEW_SYP' then
    update public.promo_banners
    set bundle_price_syp_minor = private.bundle_usd_to_syp(bundle_price_usd_minor)
    where bundle_price_usd_minor is not null;
  end if;
  return new;
end;
$$;

create trigger sync_all_banner_prices_to_syp
after insert or update of rate, active on public.exchange_rates
for each row execute function private.sync_all_banner_prices_to_syp_trigger();

revoke all on function private.bundle_usd_to_syp(bigint) from public, anon, authenticated;
revoke all on function private.sync_banner_price_to_syp_trigger() from public, anon, authenticated;
revoke all on function private.sync_all_banner_prices_to_syp_trigger() from public, anon, authenticated;

-- Creates the order at list prices, then spreads each offer's fixed price over its
-- lines in proportion to their list value. Line totals keep summing to the order
-- subtotal, so every existing order and invoice view stays correct.
create or replace function public.create_doctor_order(
  p_idempotency_key uuid,
  p_display_currency public.currency_code,
  p_delivery_address text,
  p_recipient_name text,
  p_recipient_phone text,
  p_delivery_notes text,
  p_items jsonb,
  p_delivery_latitude double precision,
  p_delivery_longitude double precision,
  p_delivery_google_place_id text,
  p_bundle_ids uuid[]
)
returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_order public.orders%rowtype;
  v_banner public.promo_banners%rowtype;
  v_bundle_ids uuid[];
  v_reserved jsonb := '{}';
  v_line record;
  v_expected integer;
  v_matched integer;
  v_list_base bigint;
  v_list_display bigint;
  v_left_base bigint;
  v_left_display bigint;
  v_share_base bigint;
  v_share_display bigint;
  v_tax_bps integer;
  v_subtotal_base bigint;
  v_subtotal_display bigint;
  v_tax_base bigint;
  v_tax_display bigint;
begin
  select result.order_id, result.order_number into v_order_id, v_order_number
  from public.create_doctor_order(
    p_idempotency_key, p_display_currency, p_delivery_address, p_recipient_name,
    p_recipient_phone, p_delivery_notes, p_items,
    p_delivery_latitude, p_delivery_longitude, p_delivery_google_place_id
  ) result;

  select coalesce(array_agg(distinct id), '{}') into v_bundle_ids from unnest(p_bundle_ids) as id;
  if cardinality(v_bundle_ids) = 0 then
    return query select v_order_id, v_order_number;
    return;
  end if;
  if cardinality(v_bundle_ids) > 20 then
    raise exception 'INVALID_BUNDLES' using errcode = '22023';
  end if;

  update public.orders o set applied_bundle_ids = v_bundle_ids
  where o.id = v_order_id and o.user_id = (select auth.uid()) and o.applied_bundle_ids is null
  returning o.* into v_order;
  if not found then
    -- A replay of an order whose offers were already applied.
    return query select v_order_id, v_order_number;
    return;
  end if;
  if v_order.base_currency <> 'USD' then
    raise exception 'CURRENCY_NOT_CONFIGURED' using errcode = '22023';
  end if;

  for v_banner in
    select b.* from public.promo_banners b
    where b.id = any(v_bundle_ids) and b.active and (b.expires_at is null or b.expires_at > now())
      and b.bundle_price_usd_minor is not null and jsonb_typeof(b.bundle_items) = 'array'
  loop
    create temporary table if not exists bundle_lines(
      item_id uuid, product_id uuid, bundle_quantity integer, ordered_quantity integer,
      list_base bigint, list_display bigint
    ) on commit drop;
    truncate bundle_lines;

    insert into bundle_lines
    select oi.id, i.product_id, i.quantity, oi.quantity,
      i.quantity * oi.base_unit_price_minor, i.quantity * oi.unit_price_minor
    from (
      select x.product_id, sum(x.quantity)::integer as quantity
      from jsonb_to_recordset(v_banner.bundle_items) as x(product_id uuid, quantity integer)
      group by x.product_id
    ) i
    left join public.order_items oi on oi.order_id = v_order_id and oi.product_id = i.product_id;

    select count(*), count(item_id), coalesce(sum(list_base), 0), coalesce(sum(list_display), 0)
    into v_expected, v_matched, v_list_base, v_list_display
    from bundle_lines;
    if v_expected = 0 or v_matched <> v_expected or v_list_base <= 0 or v_list_display <= 0 then
      raise exception 'BUNDLE_ITEMS_MISSING' using errcode = '22023';
    end if;

    v_left_base := v_banner.bundle_price_usd_minor;
    v_left_display := case
      when v_order.currency = 'NEW_SYP' then
        (ceil(((v_banner.bundle_price_usd_minor / 100::numeric) * v_order.exchange_rate_snapshot) / 5) * 5)::bigint
      else
        round((v_banner.bundle_price_usd_minor / 100::numeric) * v_order.exchange_rate_snapshot * power(10::numeric, v_order.currency_decimal_places))::bigint
    end;

    for v_line in select * from bundle_lines order by list_base, product_id loop
      v_reserved := jsonb_set(v_reserved, array[v_line.product_id::text],
        to_jsonb(coalesce((v_reserved ->> v_line.product_id::text)::integer, 0) + v_line.bundle_quantity));
      if (v_reserved ->> v_line.product_id::text)::integer > v_line.ordered_quantity then
        raise exception 'BUNDLE_ITEMS_MISSING' using errcode = '22023';
      end if;

      -- Dividing what is left by the list value left means the last line absorbs all rounding.
      v_share_base := round(v_left_base * v_line.list_base / v_list_base::numeric);
      v_share_display := round(v_left_display * v_line.list_display / v_list_display::numeric);
      update public.order_items oi set
        base_line_total_minor = oi.base_line_total_minor - v_line.list_base + v_share_base,
        line_total_minor = oi.line_total_minor - v_line.list_display + v_share_display
      where oi.id = v_line.item_id;
      v_left_base := v_left_base - v_share_base;
      v_left_display := v_left_display - v_share_display;
      v_list_base := v_list_base - v_line.list_base;
      v_list_display := v_list_display - v_line.list_display;
    end loop;

    v_bundle_ids := array_remove(v_bundle_ids, v_banner.id);
  end loop;

  if cardinality(v_bundle_ids) > 0 then
    raise exception 'BUNDLE_UNAVAILABLE' using errcode = '22023';
  end if;

  -- Unit prices are only rewritten now, so offers sharing a product both see the list price.
  update public.order_items oi set
    base_unit_price_minor = round(oi.base_line_total_minor / oi.quantity::numeric),
    unit_price_minor = round(oi.line_total_minor / oi.quantity::numeric)
  where oi.order_id = v_order_id and oi.product_id in (select jsonb_object_keys(v_reserved)::uuid);

  select sum(oi.base_line_total_minor)::bigint, sum(oi.line_total_minor)::bigint
  into v_subtotal_base, v_subtotal_display
  from public.order_items oi where oi.order_id = v_order_id;

  select tax_rate_bps into v_tax_bps from public.financial_settings where id;
  v_tax_base := round(v_subtotal_base * v_tax_bps / 10000.0);
  v_tax_display := case
    when v_order.currency = 'NEW_SYP' then
      (ceil(((v_tax_base / 100::numeric) * v_order.exchange_rate_snapshot) / 5) * 5)::bigint
    else
      round((v_tax_base / 100::numeric) * v_order.exchange_rate_snapshot * power(10::numeric, v_order.currency_decimal_places))::bigint
  end;

  update public.orders o set
    base_subtotal_minor = v_subtotal_base,
    base_tax_minor = v_tax_base,
    base_total_minor = v_subtotal_base + o.base_delivery_fee_minor + v_tax_base,
    subtotal_minor = v_subtotal_display,
    tax_minor = v_tax_display,
    total_minor = v_subtotal_display + o.delivery_fee_minor + v_tax_display
  where o.id = v_order_id;

  return query select v_order_id, v_order_number;
end;
$$;

revoke all on function public.create_doctor_order(
  uuid, public.currency_code, text, text, text, text, jsonb, double precision, double precision, text, uuid[]
) from public, anon;
grant execute on function public.create_doctor_order(
  uuid, public.currency_code, text, text, text, text, jsonb, double precision, double precision, text, uuid[]
) to authenticated;
