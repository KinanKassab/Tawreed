-- REVIEW REQUIRED. DESTRUCTIVE. Do not run before independently verified backup restore.
-- Never run on any project other than Tawreed mgpgdpmjftkproivjkmd.
-- No CASCADE; dependent nonlocal objects cause automatic rollback.
BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '10min';
DO $$ BEGIN IF current_database() <> 'postgres' THEN RAISE EXCEPTION 'Unexpected database name'; END IF; END $$;
-- Remove all remote-only application tables at once to handle their internal FKs.
DROP TABLE   public."Address",
  public."AuditLog",
  public."Clinic",
  public."Delivery",
  public."DoctorOrder",
  public."DoctorOrderItem",
  public."DoctorProfile",
  public."Employee",
  public."EmployeeRole",
  public."GoodsReceipt",
  public."GoodsReceiptItem",
  public."IdempotencyKey",
  public."InventoryAllocation",
  public."InventoryBatch",
  public."InventoryItem",
  public."Notification",
  public."OrderStatusHistory",
  public."PackingTask",
  public."Payment",
  public."Permission",
  public."PickingItem",
  public."PickingTask",
  public."ProblemReport",
  public."ProcurementCoverage",
  public."ProcurementRequirement",
  public."ProcurementRequirementSource",
  public."Product",
  public."ProductCategory",
  public."ProductImage",
  public."ProductPrice",
  public."PurchaseOrder",
  public."PurchaseOrderItem",
  public."RefreshToken",
  public."Role",
  public."RolePermission",
  public."StockMovement",
  public."SystemSetting",
  public."User",
  public."Vendor",
  public."VendorProduct",
  public."Warehouse",
  public."_prisma_migrations";
-- Old remote-only enum types (nonlocal) are removed without CASCADE.
DROP TYPE   public."AllocationStatus",
  public."AvailabilityStatus",
  public."Currency",
  public."DeliveryStatus",
  public."DoctorOrderStatus",
  public."FulfillmentTaskStatus",
  public."GoodsReceiptStatus",
  public."InternalOrderStatus",
  public."NotificationAudience",
  public."PaymentMethod",
  public."PaymentStatus",
  public."Priority",
  public."ProblemStatus",
  public."ProblemType",
  public."ProcurementRequirementStatus",
  public."PurchaseOrderStatus",
  public."StockMovementType",
  public."UserStatus",
  public."UserType";

-- BEGIN LOCAL MIGRATION 20261024190644_initial_tawreed_schema.sql
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

-- END LOCAL MIGRATION 20261024190644_initial_tawreed_schema.sql

-- BEGIN LOCAL MIGRATION 20261025090000_expand_dental_product_master.sql
alter table public.products
  add column name_en text,
  add column specifications_ar text,
  add column suggested_brands text[] not null default '{}',
  add column catalog_priority text,
  add constraint products_catalog_priority_check check (
    catalog_priority is null or catalog_priority in ('عالية جداً', 'عالية', 'متوسطة', 'توسعية', 'تشغيلية')
  );

comment on column public.products.suggested_brands is
  'Unverified sourcing suggestions from the catalog master; never proof of local availability or an offer to the Doctor.';

-- END LOCAL MIGRATION 20261025090000_expand_dental_product_master.sql

-- BEGIN LOCAL MIGRATION 20261025093000_add_bilingual_catalog_search.sql
create extension if not exists pg_trgm with schema extensions;

alter table public.categories add column name_en text;

alter table public.products add column search_text text generated always as (
  lower(
    coalesce(sku, '') || ' ' ||
    coalesce(name_ar, '') || ' ' ||
    coalesce(name_en, '') || ' ' ||
    coalesce(manufacturer, '')
  )
) stored;

create index products_search_text_idx on public.products using gin (search_text extensions.gin_trgm_ops);

-- END LOCAL MIGRATION 20261025093000_add_bilingual_catalog_search.sql

-- BEGIN LOCAL MIGRATION 20261025100000_protect_product_sourcing.sql
create table public.product_sourcing_suggestions (
  product_id uuid primary key references public.products(id) on delete cascade,
  suggested_brands text[] not null default '{}',
  catalog_priority text not null,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_sourcing_suggestions enable row level security;
revoke all on public.product_sourcing_suggestions from public, anon, authenticated;
grant select on public.product_sourcing_suggestions to service_role;

alter table public.products drop column suggested_brands, drop column catalog_priority;

comment on table public.product_sourcing_suggestions is
  'Internal, unverified sourcing candidates. Never exposed to Doctor clients.';

-- END LOCAL MIGRATION 20261025100000_protect_product_sourcing.sql

-- BEGIN LOCAL MIGRATION 20261025104818_operations_mvp.sql
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
  if tg_op = 'DELETE' then return old; end if;
  return new;
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
grant select, insert, update, delete on public.staff_accounts, public.audit_events, public.order_inventory_reservations to service_role;
grant usage, select on sequence public.audit_events_id_seq to service_role;
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

-- END LOCAL MIGRATION 20261025104818_operations_mvp.sql

-- Verify the resulting public TABLE set in this very transaction.
DO $verify$
DECLARE missing text[]; extras text[];
BEGIN
  SELECT array_agg(w.name) INTO missing FROM unnest(ARRAY['addresses','audit_events','categories','currency_settings','exchange_rates','financial_settings','goods_receipts','inventory_balances','inventory_batches','inventory_movements','media_assets','order_inventory_reservations','order_items','order_status_history','orders','product_media','product_prices','product_sourcing_suggestions','products','profiles','purchase_order_items','purchase_orders','staff_accounts','support_cases','vendors','warehouses']::text[]) w(name)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema='public' AND t.table_type='BASE TABLE' AND t.table_name=w.name);
  SELECT array_agg(t.table_name) INTO extras FROM information_schema.tables t
   WHERE t.table_schema='public' AND t.table_type='BASE TABLE' AND NOT(t.table_name=ANY(ARRAY['addresses','audit_events','categories','currency_settings','exchange_rates','financial_settings','goods_receipts','inventory_balances','inventory_batches','inventory_movements','media_assets','order_inventory_reservations','order_items','order_status_history','orders','product_media','product_prices','product_sourcing_suggestions','products','profiles','purchase_order_items','purchase_orders','staff_accounts','support_cases','vendors','warehouses']::text[]));
  IF missing IS NOT NULL OR extras IS NOT NULL THEN RAISE EXCEPTION 'Mismatch: missing % extra %',missing,extras; END IF;
END
$verify$;
COMMIT;
