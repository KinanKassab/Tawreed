-- Production catalog data was imported without the seed-only commerce rows.
-- Restore the authoritative USD base, SYP display currency, and zero-fee
-- defaults required by checkout. Product prices remain USD-first and SYP is
-- derived from the active exchange rate.
insert into public.currency_settings(
  code, display_label_ar, decimal_places, enabled, is_base, is_default_display
) values
  ('USD', 'دولار أمريكي', 2, true, true, false),
  ('NEW_SYP', 'ليرة سورية', 0, true, false, true)
on conflict (code) do update set
  display_label_ar = excluded.display_label_ar,
  decimal_places = excluded.decimal_places,
  enabled = excluded.enabled,
  is_base = excluded.is_base,
  is_default_display = excluded.is_default_display,
  updated_at = now();

insert into public.financial_settings(
  id, delivery_fee_minor, delivery_fee_currency, tax_rate_bps
) values (true, 0, 'USD', 0)
on conflict (id) do nothing;

-- Keep checkout totals aligned with catalog prices: SYP values are rounded
-- upward to the nearest 5 at unit level, then multiplied by quantity.
create or replace function public.create_doctor_order(
  p_idempotency_key uuid,
  p_display_currency public.currency_code,
  p_delivery_address text,
  p_recipient_name text,
  p_recipient_phone text,
  p_delivery_notes text,
  p_items jsonb
)
returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_order_id uuid;
  v_order_number text;
  v_base_currency public.currency_code;
  v_base_decimals smallint;
  v_display_decimals smallint;
  v_rate numeric(20,8) := 1;
  v_delivery_base bigint;
  v_tax_bps integer;
  v_subtotal_base bigint;
  v_tax_base bigint;
  v_total_base bigint;
  v_subtotal_display bigint;
  v_delivery_display bigint;
  v_tax_display bigint;
  v_total_display bigint;
  v_requested_count integer;
  v_valid_count integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if v_session_id is null or not exists (
    select 1 from auth.sessions s
    where s.id = v_session_id
      and s.user_id = v_user_id
      and (s.not_after is null or s.not_after > now())
  ) then
    raise exception 'SESSION_INVALID' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'ACCOUNT_UNAVAILABLE' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_REQUIRED' using errcode = '22023';
  end if;
  if char_length(trim(p_delivery_address)) < 8
    or char_length(trim(p_recipient_name)) < 2
    or char_length(trim(p_recipient_phone)) < 7 then
    raise exception 'INVALID_DELIVERY_DETAILS' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;

  select o.id, o.order_number into v_order_id, v_order_number
  from public.orders o
  where o.user_id = v_user_id and o.idempotency_key = p_idempotency_key;
  if v_order_id is not null then
    return query select v_order_id, v_order_number;
    return;
  end if;

  create temporary table requested_items(
    product_id uuid primary key,
    quantity integer not null
  ) on commit drop;
  insert into requested_items(product_id, quantity)
  select x.product_id, sum(x.quantity)::integer
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  group by x.product_id;
  if exists (
    select 1 from requested_items
    where product_id is null or quantity <= 0 or quantity > 999
  ) then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;
  select count(*) into v_requested_count from requested_items;

  select code, decimal_places into v_base_currency, v_base_decimals
  from public.currency_settings
  where is_base and enabled
  for share;
  select decimal_places into v_display_decimals
  from public.currency_settings
  where code = p_display_currency and enabled
  for share;
  if v_base_currency is null or v_display_decimals is null then
    raise exception 'CURRENCY_NOT_CONFIGURED' using errcode = '22023';
  end if;
  if p_display_currency <> v_base_currency then
    select rate into v_rate
    from public.exchange_rates
    where base_currency = v_base_currency
      and quote_currency = p_display_currency
      and active
    order by effective_at desc
    limit 1
    for share;
    if v_rate is null then
      raise exception 'EXCHANGE_RATE_NOT_CONFIGURED' using errcode = '22023';
    end if;
  end if;
  select delivery_fee_minor, tax_rate_bps
  into v_delivery_base, v_tax_bps
  from public.financial_settings
  where id
  for share;
  if v_delivery_base is null then
    raise exception 'FINANCIAL_SETTINGS_MISSING' using errcode = '22023';
  end if;

  select count(*), sum(r.quantity * pp.amount_minor)::bigint
  into v_valid_count, v_subtotal_base
  from requested_items r
  join public.products p
    on p.id = r.product_id
    and p.active
    and p.availability <> 'unavailable'
  join public.product_prices pp
    on pp.product_id = p.id
    and pp.currency = v_base_currency
    and pp.active;
  if v_valid_count <> v_requested_count then
    raise exception 'PRODUCT_UNAVAILABLE_OR_UNPRICED' using errcode = '22023';
  end if;

  v_tax_base := round(v_subtotal_base * v_tax_bps / 10000.0);
  v_total_base := v_subtotal_base + v_delivery_base + v_tax_base;

  select sum(
    r.quantity * case
      when p_display_currency = 'NEW_SYP' then
        (ceil(((pp.amount_minor / power(10::numeric, v_base_decimals)) * v_rate) / 5) * 5)::bigint
      else
        round((pp.amount_minor / power(10::numeric, v_base_decimals)) * v_rate * power(10::numeric, v_display_decimals))::bigint
    end
  )::bigint
  into v_subtotal_display
  from requested_items r
  join public.product_prices pp
    on pp.product_id = r.product_id
    and pp.currency = v_base_currency
    and pp.active;

  if p_display_currency = 'NEW_SYP' then
    v_delivery_display := (ceil(((v_delivery_base / power(10::numeric, v_base_decimals)) * v_rate) / 5) * 5)::bigint;
    v_tax_display := (ceil(((v_tax_base / power(10::numeric, v_base_decimals)) * v_rate) / 5) * 5)::bigint;
  else
    v_delivery_display := round((v_delivery_base / power(10::numeric, v_base_decimals)) * v_rate * power(10::numeric, v_display_decimals));
    v_tax_display := round((v_tax_base / power(10::numeric, v_base_decimals)) * v_rate * power(10::numeric, v_display_decimals));
  end if;
  v_total_display := v_subtotal_display + v_delivery_display + v_tax_display;

  v_order_id := gen_random_uuid();
  v_order_number := 'TWD-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');

  insert into public.orders(
    id, user_id, order_number, idempotency_key,
    delivery_address_snapshot, recipient_name_snapshot,
    recipient_phone_snapshot, delivery_notes,
    base_currency, currency, currency_decimal_places,
    exchange_rate_snapshot, base_subtotal_minor,
    base_delivery_fee_minor, base_tax_minor, base_total_minor,
    subtotal_minor, delivery_fee_minor, tax_minor, total_minor
  ) values (
    v_order_id, v_user_id, v_order_number, p_idempotency_key,
    trim(p_delivery_address), trim(p_recipient_name),
    trim(p_recipient_phone), nullif(trim(p_delivery_notes), ''),
    v_base_currency, p_display_currency, v_display_decimals,
    v_rate, v_subtotal_base, v_delivery_base, v_tax_base, v_total_base,
    v_subtotal_display, v_delivery_display, v_tax_display, v_total_display
  );

  insert into public.order_items(
    order_id, product_id, sku_snapshot, name_ar_snapshot,
    unit_label_ar_snapshot, package_label_ar_snapshot, quantity,
    base_unit_price_minor, base_line_total_minor,
    unit_price_minor, line_total_minor, currency, currency_decimal_places
  )
  select
    v_order_id, p.id, p.sku, p.name_ar,
    p.unit_label_ar, p.package_label_ar, r.quantity,
    pp.amount_minor, pp.amount_minor * r.quantity,
    case
      when p_display_currency = 'NEW_SYP' then
        (ceil(((pp.amount_minor / power(10::numeric, v_base_decimals)) * v_rate) / 5) * 5)::bigint
      else
        round((pp.amount_minor / power(10::numeric, v_base_decimals)) * v_rate * power(10::numeric, v_display_decimals))::bigint
    end,
    r.quantity * case
      when p_display_currency = 'NEW_SYP' then
        (ceil(((pp.amount_minor / power(10::numeric, v_base_decimals)) * v_rate) / 5) * 5)::bigint
      else
        round((pp.amount_minor / power(10::numeric, v_base_decimals)) * v_rate * power(10::numeric, v_display_decimals))::bigint
    end,
    p_display_currency, v_display_decimals
  from requested_items r
  join public.products p on p.id = r.product_id
  join public.product_prices pp
    on pp.product_id = p.id
    and pp.currency = v_base_currency
    and pp.active;

  insert into public.order_status_history(order_id, status, doctor_message_ar)
  values (v_order_id, 'received', 'تم استلام طلبك بنجاح.');
  return query select v_order_id, v_order_number;
exception when unique_violation then
  return query
  select o.id, o.order_number
  from public.orders o
  where o.user_id = v_user_id and o.idempotency_key = p_idempotency_key;
end;
$$;

revoke all on function public.create_doctor_order(
  uuid, public.currency_code, text, text, text, text, jsonb
) from public, anon;
grant execute on function public.create_doctor_order(
  uuid, public.currency_code, text, text, text, text, jsonb
) to authenticated;
