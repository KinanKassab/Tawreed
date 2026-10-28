alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists preferred_contact text not null default 'phone',
  add column if not exists default_latitude double precision,
  add column if not exists default_longitude double precision,
  add column if not exists default_google_place_id text;

alter table public.profiles
  add constraint profiles_first_name_length check (first_name is null or char_length(trim(first_name)) between 2 and 50),
  add constraint profiles_last_name_length check (last_name is null or char_length(trim(last_name)) between 2 and 50),
  add constraint profiles_preferred_contact_valid check (preferred_contact in ('phone', 'whatsapp', 'email')),
  add constraint profiles_default_latitude_valid check (default_latitude is null or default_latitude between -90 and 90),
  add constraint profiles_default_longitude_valid check (default_longitude is null or default_longitude between -180 and 180),
  add constraint profiles_default_coordinates_complete check ((default_latitude is null) = (default_longitude is null));

alter table public.addresses
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists google_place_id text;

alter table public.addresses
  add constraint addresses_latitude_valid check (latitude is null or latitude between -90 and 90),
  add constraint addresses_longitude_valid check (longitude is null or longitude between -180 and 180),
  add constraint addresses_coordinates_complete check ((latitude is null) = (longitude is null));

alter table public.orders
  add column if not exists delivery_latitude_snapshot double precision,
  add column if not exists delivery_longitude_snapshot double precision,
  add column if not exists delivery_google_place_id_snapshot text;

alter table public.orders
  add constraint orders_delivery_latitude_valid check (delivery_latitude_snapshot is null or delivery_latitude_snapshot between -90 and 90),
  add constraint orders_delivery_longitude_valid check (delivery_longitude_snapshot is null or delivery_longitude_snapshot between -180 and 180),
  add constraint orders_delivery_coordinates_complete check ((delivery_latitude_snapshot is null) = (delivery_longitude_snapshot is null));

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_first_name text := nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
  v_last_name text := nullif(trim(new.raw_user_meta_data ->> 'last_name'), '');
  v_full_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), concat_ws(' ', v_first_name, v_last_name), 'مستخدم توريد');
  v_phone text := coalesce(new.phone, nullif(trim(new.raw_user_meta_data ->> 'phone'), ''));
  v_address text := nullif(trim(new.raw_user_meta_data ->> 'default_address'), '');
  v_latitude double precision := nullif(new.raw_user_meta_data ->> 'default_latitude', '')::double precision;
  v_longitude double precision := nullif(new.raw_user_meta_data ->> 'default_longitude', '')::double precision;
  v_place_id text := nullif(trim(new.raw_user_meta_data ->> 'default_google_place_id'), '');
begin
  insert into public.profiles (
    id, first_name, last_name, full_name, clinic_name, phone, email, preferred_contact,
    default_address, default_latitude, default_longitude, default_google_place_id
  ) values (
    new.id,
    v_first_name,
    v_last_name,
    v_full_name,
    nullif(trim(new.raw_user_meta_data ->> 'clinic_name'), ''),
    v_phone,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'preferred_contact', ''), 'phone'),
    v_address,
    v_latitude,
    v_longitude,
    v_place_id
  ) on conflict (id) do nothing;

  if v_address is not null and v_phone is not null then
    insert into public.addresses (
      user_id, label, recipient_name, recipient_phone, address_text,
      latitude, longitude, google_place_id, is_default
    ) values (
      new.id, 'العنوان الرئيسي', v_full_name, v_phone, v_address,
      v_latitude, v_longitude, v_place_id, true
    ) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop policy if exists categories_read_public on public.categories;
create policy categories_read_public on public.categories for select to anon using (active);

drop policy if exists products_read_public on public.products;
create policy products_read_public on public.products for select to anon using (active);

drop policy if exists product_prices_read_public on public.product_prices;
create policy product_prices_read_public on public.product_prices for select to anon
using (active and exists(select 1 from public.products p where p.id = product_prices.product_id and p.active));

drop policy if exists product_media_read_public on public.product_media;
create policy product_media_read_public on public.product_media for select to anon
using (exists(select 1 from public.products p where p.id = product_media.product_id and p.active));

drop policy if exists media_assets_read_public on public.media_assets;
create policy media_assets_read_public on public.media_assets for select to anon
using (exists(
  select 1 from public.product_media pm
  join public.products p on p.id = pm.product_id
  where pm.media_asset_id = media_assets.id and p.active
));

grant select on public.categories, public.products, public.product_prices, public.product_media, public.media_assets to anon;

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
  p_delivery_google_place_id text
)
returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_number text;
begin
  if (p_delivery_latitude is null) <> (p_delivery_longitude is null) then
    raise exception 'INCOMPLETE_DELIVERY_COORDINATES' using errcode = '22023';
  end if;
  if p_delivery_latitude is not null and (p_delivery_latitude not between -90 and 90 or p_delivery_longitude not between -180 and 180) then
    raise exception 'INVALID_DELIVERY_COORDINATES' using errcode = '22023';
  end if;

  select result.order_id, result.order_number into v_order_id, v_order_number
  from public.create_doctor_order(
    p_idempotency_key, p_display_currency, p_delivery_address, p_recipient_name,
    p_recipient_phone, p_delivery_notes, p_items
  ) result;

  update public.orders
  set delivery_latitude_snapshot = p_delivery_latitude,
      delivery_longitude_snapshot = p_delivery_longitude,
      delivery_google_place_id_snapshot = nullif(trim(p_delivery_google_place_id), '')
  where id = v_order_id and user_id = (select auth.uid());

  return query select v_order_id, v_order_number;
end;
$$;

revoke execute on function public.create_doctor_order(uuid, public.currency_code, text, text, text, text, jsonb) from authenticated;
revoke all on function public.create_doctor_order(uuid, public.currency_code, text, text, text, text, jsonb, double precision, double precision, text) from public, anon;
grant execute on function public.create_doctor_order(uuid, public.currency_code, text, text, text, text, jsonb, double precision, double precision, text) to authenticated;
