create extension if not exists pgcrypto with schema extensions;

create type public.product_availability as enum ('available', 'limited', 'unavailable');
create type public.order_status as enum ('received', 'sourcing', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered', 'cancelled', 'problem');
create type public.currency_code as enum ('USD', 'NEW_SYP');
create type public.media_provider as enum ('supabase', 'external', 'cdn');
create type public.purchase_order_status as enum ('draft', 'submitted', 'partially_received', 'received', 'cancelled');
create type public.inventory_movement_type as enum ('receipt', 'allocation', 'release', 'adjustment', 'dispatch', 'return');

create sequence public.order_number_seq;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  clinic_name text check (clinic_name is null or char_length(clinic_name) <= 120),
  phone text,
  email text,
  default_address text check (default_address is null or char_length(default_address) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  recipient_name text not null,
  recipient_phone text not null,
  address_text text not null,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index addresses_one_default_per_user on public.addresses(user_id) where is_default and active;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  provider public.media_provider not null,
  object_key text,
  external_url text,
  mime_type text,
  alt_text_ar text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_location_check check (
    (provider = 'external' and external_url is not null) or
    (provider in ('supabase', 'cdn') and object_key is not null)
  )
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name_ar text not null,
  category_id uuid not null references public.categories(id),
  manufacturer text,
  unit_label_ar text not null,
  package_label_ar text,
  description_ar text,
  availability public.product_availability not null default 'unavailable',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_active_idx on public.products(category_id, active);
create index products_name_ar_idx on public.products(name_ar);

create table public.product_media (
  product_id uuid not null references public.products(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  primary key (product_id, media_asset_id)
);
create unique index product_media_one_primary on public.product_media(product_id) where is_primary;

create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  currency public.currency_code not null,
  amount_minor bigint not null check (amount_minor >= 0),
  decimal_places smallint not null check (decimal_places between 0 and 4),
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  constraint price_dates_check check (valid_to is null or valid_to > valid_from)
);
create unique index product_prices_one_active on public.product_prices(product_id, currency) where active;

create table public.currency_settings (
  code public.currency_code primary key,
  display_label_ar text not null,
  decimal_places smallint not null check (decimal_places between 0 and 4),
  enabled boolean not null default true,
  is_base boolean not null default false,
  is_default_display boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index currency_one_base on public.currency_settings(is_base) where is_base;
create unique index currency_one_default on public.currency_settings(is_default_display) where is_default_display;

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency public.currency_code not null,
  quote_currency public.currency_code not null,
  rate numeric(20,8) not null check (rate > 0),
  active boolean not null default true,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (base_currency <> quote_currency)
);
create unique index exchange_rates_one_active on public.exchange_rates(base_currency, quote_currency) where active;

create table public.financial_settings (
  id boolean primary key default true check (id),
  delivery_fee_minor bigint not null default 0 check (delivery_fee_minor >= 0),
  delivery_fee_currency public.currency_code not null,
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 10000),
  updated_at timestamptz not null default now()
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_balances (
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= on_hand),
  updated_at timestamptz not null default now(),
  primary key (warehouse_id, product_id)
);

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  batch_number text,
  expires_on date,
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  order_number text not null unique,
  idempotency_key uuid not null,
  status public.order_status not null default 'received',
  payment_method text not null default 'cash_on_delivery' check (payment_method = 'cash_on_delivery'),
  delivery_address_snapshot text not null,
  recipient_name_snapshot text not null,
  recipient_phone_snapshot text not null,
  delivery_notes text,
  base_currency public.currency_code not null,
  currency public.currency_code not null,
  currency_decimal_places smallint not null,
  exchange_rate_snapshot numeric(20,8) not null check (exchange_rate_snapshot > 0),
  base_subtotal_minor bigint not null,
  base_delivery_fee_minor bigint not null,
  base_tax_minor bigint not null,
  base_total_minor bigint not null,
  subtotal_minor bigint not null,
  delivery_fee_minor bigint not null,
  tax_minor bigint not null,
  total_minor bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index orders_user_created_idx on public.orders(user_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku_snapshot text not null,
  name_ar_snapshot text not null,
  unit_label_ar_snapshot text not null,
  package_label_ar_snapshot text,
  quantity integer not null check (quantity > 0),
  base_unit_price_minor bigint not null,
  base_line_total_minor bigint not null,
  unit_price_minor bigint not null,
  line_total_minor bigint not null,
  currency public.currency_code not null,
  currency_decimal_places smallint not null,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items(order_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  doctor_message_ar text,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history(order_id, created_at);

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  warehouse_id uuid not null references public.warehouses(id),
  status public.purchase_order_status not null default 'draft',
  currency public.currency_code not null,
  ordered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_cost_minor bigint not null check (unit_cost_minor >= 0),
  created_at timestamptz not null default now()
);

create table public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id),
  warehouse_id uuid not null references public.warehouses(id),
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  batch_id uuid references public.inventory_batches(id),
  movement_type public.inventory_movement_type not null,
  quantity_delta integer not null check (quantity_delta <> 0),
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','addresses','categories','media_assets','products','currency_settings','financial_settings','warehouses','orders','support_cases','vendors','purchase_orders']
  loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, clinic_name, phone, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'مستخدم توريد'),
    nullif(trim(new.raw_user_meta_data ->> 'clinic_name'), ''),
    new.phone,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

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
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_REQUIRED' using errcode = '22023'; end if;
  if char_length(trim(p_delivery_address)) < 8 or char_length(trim(p_recipient_name)) < 2 or char_length(trim(p_recipient_phone)) < 7 then
    raise exception 'INVALID_DELIVERY_DETAILS' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;

  select o.id, o.order_number into v_order_id, v_order_number
  from public.orders o where o.user_id = v_user_id and o.idempotency_key = p_idempotency_key;
  if v_order_id is not null then return query select v_order_id, v_order_number; return; end if;

  create temporary table requested_items(product_id uuid primary key, quantity integer not null) on commit drop;
  insert into requested_items(product_id, quantity)
  select x.product_id, sum(x.quantity)::integer
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  group by x.product_id;
  if exists(select 1 from requested_items where product_id is null or quantity <= 0 or quantity > 999) then raise exception 'INVALID_QUANTITY' using errcode = '22023'; end if;
  select count(*) into v_requested_count from requested_items;

  select code, decimal_places into v_base_currency, v_base_decimals from public.currency_settings where is_base and enabled for share;
  select decimal_places into v_display_decimals from public.currency_settings where code = p_display_currency and enabled for share;
  if v_base_currency is null or v_display_decimals is null then raise exception 'CURRENCY_NOT_CONFIGURED' using errcode = '22023'; end if;
  if p_display_currency <> v_base_currency then
    select rate into v_rate from public.exchange_rates where base_currency = v_base_currency and quote_currency = p_display_currency and active order by effective_at desc limit 1 for share;
    if v_rate is null then raise exception 'EXCHANGE_RATE_NOT_CONFIGURED' using errcode = '22023'; end if;
  end if;
  select delivery_fee_minor, tax_rate_bps into v_delivery_base, v_tax_bps from public.financial_settings where id for share;
  if v_delivery_base is null then raise exception 'FINANCIAL_SETTINGS_MISSING' using errcode = '22023'; end if;

  select count(*), sum(r.quantity * pp.amount_minor)::bigint into v_valid_count, v_subtotal_base
  from requested_items r
  join public.products p on p.id = r.product_id and p.active and p.availability <> 'unavailable'
  join public.product_prices pp on pp.product_id = p.id and pp.currency = v_base_currency and pp.active;
  if v_valid_count <> v_requested_count then raise exception 'PRODUCT_UNAVAILABLE_OR_UNPRICED' using errcode = '22023'; end if;

  v_tax_base := round(v_subtotal_base * v_tax_bps / 10000.0);
  v_total_base := v_subtotal_base + v_delivery_base + v_tax_base;
  v_subtotal_display := round((v_subtotal_base / power(10::numeric, v_base_decimals)) * v_rate * power(10::numeric, v_display_decimals));
  v_delivery_display := round((v_delivery_base / power(10::numeric, v_base_decimals)) * v_rate * power(10::numeric, v_display_decimals));
  v_tax_display := round((v_tax_base / power(10::numeric, v_base_decimals)) * v_rate * power(10::numeric, v_display_decimals));
  v_total_display := v_subtotal_display + v_delivery_display + v_tax_display;
  v_order_id := gen_random_uuid();
  v_order_number := 'TWD-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');

  insert into public.orders(id, user_id, order_number, idempotency_key, delivery_address_snapshot, recipient_name_snapshot, recipient_phone_snapshot, delivery_notes, base_currency, currency, currency_decimal_places, exchange_rate_snapshot, base_subtotal_minor, base_delivery_fee_minor, base_tax_minor, base_total_minor, subtotal_minor, delivery_fee_minor, tax_minor, total_minor)
  values(v_order_id, v_user_id, v_order_number, p_idempotency_key, trim(p_delivery_address), trim(p_recipient_name), trim(p_recipient_phone), nullif(trim(p_delivery_notes), ''), v_base_currency, p_display_currency, v_display_decimals, v_rate, v_subtotal_base, v_delivery_base, v_tax_base, v_total_base, v_subtotal_display, v_delivery_display, v_tax_display, v_total_display);

  insert into public.order_items(order_id, product_id, sku_snapshot, name_ar_snapshot, unit_label_ar_snapshot, package_label_ar_snapshot, quantity, base_unit_price_minor, base_line_total_minor, unit_price_minor, line_total_minor, currency, currency_decimal_places)
  select v_order_id, p.id, p.sku, p.name_ar, p.unit_label_ar, p.package_label_ar, r.quantity, pp.amount_minor, pp.amount_minor * r.quantity,
    round((pp.amount_minor / power(10::numeric, v_base_decimals)) * v_rate * power(10::numeric, v_display_decimals)),
    round(((pp.amount_minor * r.quantity) / power(10::numeric, v_base_decimals)) * v_rate * power(10::numeric, v_display_decimals)),
    p_display_currency, v_display_decimals
  from requested_items r join public.products p on p.id = r.product_id join public.product_prices pp on pp.product_id = p.id and pp.currency = v_base_currency and pp.active;
  insert into public.order_status_history(order_id, status, doctor_message_ar) values(v_order_id, 'received', 'تم استلام طلبك بنجاح.');
  return query select v_order_id, v_order_number;
exception when unique_violation then
  return query select o.id, o.order_number from public.orders o where o.user_id = v_user_id and o.idempotency_key = p_idempotency_key;
end;
$$;
revoke all on function public.create_doctor_order(uuid, public.currency_code, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_doctor_order(uuid, public.currency_code, text, text, text, text, jsonb) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','addresses','categories','media_assets','products','product_media','product_prices','currency_settings','exchange_rates','financial_settings','warehouses','inventory_balances','inventory_batches','orders','order_items','order_status_history','support_cases','vendors','purchase_orders','purchase_order_items','goods_receipts','inventory_movements']
  loop execute format('alter table public.%I enable row level security', table_name); end loop;
end $$;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy addresses_all_own on public.addresses for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy categories_read_active on public.categories for select to authenticated using (active);
create policy products_read_active on public.products for select to authenticated using (active);
create policy media_assets_read_catalog on public.media_assets for select to authenticated using (exists(select 1 from public.product_media pm join public.products p on p.id = pm.product_id where pm.media_asset_id = media_assets.id and p.active));
create policy product_media_read_catalog on public.product_media for select to authenticated using (exists(select 1 from public.products p where p.id = product_media.product_id and p.active));
create policy product_prices_read_active on public.product_prices for select to authenticated using (active and exists(select 1 from public.products p where p.id = product_prices.product_id and p.active));
create policy currency_settings_read_enabled on public.currency_settings for select to authenticated using (enabled);
create policy exchange_rates_read_active on public.exchange_rates for select to authenticated using (active);
create policy financial_settings_read on public.financial_settings for select to authenticated using (true);
create policy orders_select_own on public.orders for select to authenticated using ((select auth.uid()) = user_id);
create policy order_items_select_own on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id = order_items.order_id and o.user_id = (select auth.uid())));
create policy order_history_select_own on public.order_status_history for select to authenticated using (exists(select 1 from public.orders o where o.id = order_status_history.order_id and o.user_id = (select auth.uid())));
create policy support_cases_select_own on public.support_cases for select to authenticated using ((select auth.uid()) = user_id);
create policy support_cases_insert_own on public.support_cases for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant select on public.categories, public.products, public.media_assets, public.product_media, public.product_prices, public.currency_settings, public.exchange_rates, public.financial_settings to authenticated;
grant select on public.orders, public.order_items, public.order_status_history to authenticated;
grant select, insert on public.support_cases to authenticated;
grant usage, select on sequence public.order_number_seq to postgres, service_role;
