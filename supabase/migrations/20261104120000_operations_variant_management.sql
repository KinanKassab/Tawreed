-- Operations control over product options (variants), standalone products,
-- archiving and product galleries. Options stay separate product rows linked by
-- variant_group_key so checkout keeps one server-authoritative price per row.

alter table public.products
  add column if not exists variant_sort_order integer not null default 0
  check (variant_sort_order between 0 and 10000);

with ordered as (
  select id, (row_number() over (partition by variant_group_key order by variant_label_ar, sku) - 1)::integer as position
  from public.products
  where variant_group_key is not null
)
update public.products p set variant_sort_order = ordered.position
from ordered where ordered.id = p.id;

create index if not exists products_variant_group_sort_idx
  on public.products(variant_group_key, variant_sort_order)
  where variant_group_key is not null;

comment on column public.products.variant_sort_order is
  'Display order of an option inside its variant group (ascending).';

create sequence if not exists private.operations_product_sku_seq;

drop policy if exists products_insert_by_staff on public.products;
create policy products_insert_by_staff on public.products for insert to authenticated
with check ((select private.has_staff_rank('operations_manager')));
grant insert on public.products to authenticated;

drop policy if exists product_media_update_by_staff on public.product_media;
create policy product_media_update_by_staff on public.product_media for update to authenticated
using ((select private.has_staff_rank('operations_manager')))
with check ((select private.has_staff_rank('operations_manager')));
grant update on public.product_media to authenticated;

drop trigger if exists audit_products_insert on public.products;
create trigger audit_products_insert after insert on public.products
for each row execute function private.capture_audit_event();

create or replace function private.require_operations_staff()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.has_staff_rank('operations_manager')) then
    raise exception 'STAFF_REQUIRED' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.next_operations_sku()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sku text;
begin
  loop
    v_sku := 'TWD-OPS-' || lpad(nextval('private.operations_product_sku_seq')::text, 5, '0');
    exit when not exists(select 1 from public.products where sku = v_sku);
  end loop;
  return v_sku;
end;
$$;

create or replace function private.validate_option_label(p_label text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if char_length(trim(coalesce(p_label, ''))) not between 1 and 80 then
    raise exception 'INVALID_OPTION_LABEL' using errcode = '22023';
  end if;
  return trim(p_label);
end;
$$;

create or replace function private.ensure_unique_option_label(p_group_key text, p_label text, p_except_product_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists(
    select 1 from public.products
    where variant_group_key = p_group_key
      and active
      and id is distinct from p_except_product_id
      and lower(trim(variant_label_ar)) = lower(trim(p_label))
  ) then
    raise exception 'DUPLICATE_OPTION_LABEL' using errcode = '23505';
  end if;
end;
$$;

-- Creates a standalone product (no price, no stock). It stays invisible to
-- Doctors until a USD selling price is set, because the catalog requires one.
create or replace function public.operations_create_product(
  p_category_id uuid,
  p_name_ar text,
  p_unit_label_ar text default 'قطعة'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_operations_staff();
  if char_length(trim(coalesce(p_name_ar, ''))) not between 2 and 200 then
    raise exception 'INVALID_PRODUCT_NAME' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_unit_label_ar, ''))) not between 1 and 80 then
    raise exception 'INVALID_PRODUCT_DETAILS' using errcode = '22023';
  end if;
  if not exists(select 1 from public.categories where id = p_category_id) then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.products(sku, name_ar, category_id, unit_label_ar, availability, active)
  values (private.next_operations_sku(), trim(p_name_ar), p_category_id, trim(p_unit_label_ar), 'unavailable', true)
  returning id into v_id;
  return v_id;
end;
$$;

-- Adds an option next to p_source_product_id. A standalone source becomes the
-- first option of a new group and needs p_source_label_ar.
create or replace function public.operations_add_product_option(
  p_source_product_id uuid,
  p_label_ar text,
  p_source_label_ar text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.products%rowtype;
  v_group text;
  v_label text := private.validate_option_label(p_label_ar);
  v_id uuid;
begin
  perform private.require_operations_staff();
  select * into v_source from public.products where id = p_source_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;

  v_group := v_source.variant_group_key;
  if v_group is null then
    v_group := 'ops-' || replace(gen_random_uuid()::text, '-', '');
    update public.products set
      variant_group_key = v_group,
      variant_label_ar = private.validate_option_label(coalesce(p_source_label_ar, v_source.package_label_ar)),
      variant_sort_order = 0
    where id = v_source.id;
  end if;
  perform private.ensure_unique_option_label(v_group, v_label, null);

  insert into public.products(
    sku, name_ar, name_en, category_id, manufacturer, unit_label_ar, package_label_ar,
    description_ar, specifications_ar, availability, active, low_stock_threshold,
    variant_group_key, variant_label_ar, variant_sort_order
  ) values (
    private.next_operations_sku(), v_source.name_ar, v_source.name_en, v_source.category_id,
    v_source.manufacturer, v_source.unit_label_ar, v_label, v_source.description_ar,
    v_source.specifications_ar, 'unavailable', true, v_source.low_stock_threshold,
    v_group, v_label,
    coalesce((select max(variant_sort_order) + 1 from public.products where variant_group_key = v_group), 0)
  ) returning id into v_id;

  insert into public.product_media(product_id, media_asset_id, sort_order, is_primary)
  select v_id, media_asset_id, sort_order, is_primary
  from public.product_media where product_id = v_source.id;

  return v_id;
end;
$$;

-- Renames an option, moves it to another group, or detaches it (p_group_key null).
create or replace function public.operations_set_product_option(
  p_product_id uuid,
  p_group_key text,
  p_label_ar text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_label text;
  v_current_group text;
begin
  perform private.require_operations_staff();
  select variant_group_key into v_current_group from public.products where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;

  if p_group_key is null then
    update public.products set variant_group_key = null, variant_label_ar = null, variant_sort_order = 0
    where id = p_product_id;
    return;
  end if;

  if p_group_key is distinct from v_current_group
    and not exists(select 1 from public.products where variant_group_key = p_group_key) then
    raise exception 'VARIANT_GROUP_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_label := private.validate_option_label(p_label_ar);
  perform private.ensure_unique_option_label(p_group_key, v_label, p_product_id);

  update public.products set
    variant_group_key = p_group_key,
    variant_label_ar = v_label,
    variant_sort_order = case when p_group_key is distinct from v_current_group
      then coalesce((select max(variant_sort_order) + 1 from public.products where variant_group_key = p_group_key), 0)
      else variant_sort_order end
  where id = p_product_id;
end;
$$;

create or replace function public.operations_reorder_product_options(
  p_group_key text,
  p_product_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_operations_staff();
  if exists(
    select 1 from unnest(p_product_ids) as requested(id)
    where not exists(select 1 from public.products p where p.id = requested.id and p.variant_group_key = p_group_key)
  ) then
    raise exception 'OPTION_NOT_IN_GROUP' using errcode = '22023';
  end if;

  update public.products p set variant_sort_order = ordered.position - 1
  from unnest(p_product_ids) with ordinality as ordered(id, position)
  where p.id = ordered.id and p.variant_sort_order is distinct from ordered.position - 1;
end;
$$;

-- Shared details edited once for every option of a group.
create or replace function public.operations_update_group_details(
  p_group_key text,
  p_name_ar text,
  p_manufacturer text,
  p_description_ar text,
  p_specifications_ar text,
  p_category_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_operations_staff();
  if char_length(trim(coalesce(p_name_ar, ''))) not between 2 and 200 then
    raise exception 'INVALID_PRODUCT_NAME' using errcode = '22023';
  end if;
  if char_length(coalesce(p_manufacturer, '')) > 200
    or char_length(coalesce(p_description_ar, '')) > 5000
    or char_length(coalesce(p_specifications_ar, '')) > 5000 then
    raise exception 'INVALID_PRODUCT_DETAILS' using errcode = '22023';
  end if;
  if not exists(select 1 from public.categories where id = p_category_id) then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.products set
    name_ar = trim(p_name_ar),
    manufacturer = nullif(trim(coalesce(p_manufacturer, '')), ''),
    description_ar = nullif(trim(coalesce(p_description_ar, '')), ''),
    specifications_ar = nullif(trim(coalesce(p_specifications_ar, '')), ''),
    category_id = p_category_id
  where variant_group_key = p_group_key;
  if not found then raise exception 'VARIANT_GROUP_NOT_FOUND' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.operations_set_product_active(
  p_product_id uuid,
  p_active boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
begin
  perform private.require_operations_staff();
  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not p_active and exists(
    select 1 from public.inventory_balances where product_id = p_product_id and reserved > 0
  ) then
    raise exception 'PRODUCT_HAS_RESERVATIONS' using errcode = '55000';
  end if;
  if p_active and v_product.variant_group_key is not null then
    perform private.ensure_unique_option_label(v_product.variant_group_key, v_product.variant_label_ar, p_product_id);
  end if;
  update public.products set active = p_active where id = p_product_id and active is distinct from p_active;
end;
$$;

-- Gallery management. Media assets may be shared by several options.
create or replace function public.operations_add_product_image(
  p_product_id uuid,
  p_object_key text,
  p_mime_type text,
  p_width integer,
  p_height integer,
  p_make_primary boolean default true
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
  v_media_id uuid;
begin
  perform private.require_operations_staff();
  select name_ar into v_name from public.products where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_object_key !~ ('^products/' || p_product_id::text || '/[0-9a-f-]+[.](webp|png|jpe?g)$')
    or p_mime_type not in ('image/webp', 'image/png', 'image/jpeg')
    or p_width <> 1200 or p_height <> 1200 then
    raise exception 'INVALID_PRODUCT_IMAGE' using errcode = '22023';
  end if;

  insert into public.media_assets(provider, object_key, mime_type, alt_text_ar, width, height, metadata)
  values ('supabase', p_object_key, p_mime_type, v_name, p_width, p_height,
    jsonb_build_object('purpose', 'product-gallery', 'normalized', true))
  returning id into v_media_id;

  p_make_primary := p_make_primary or not exists(select 1 from public.product_media where product_id = p_product_id);
  if p_make_primary then
    update public.product_media set is_primary = false where product_id = p_product_id and is_primary;
    update public.product_media set sort_order = sort_order + 1 where product_id = p_product_id;
  end if;
  insert into public.product_media(product_id, media_asset_id, sort_order, is_primary)
  values (
    p_product_id, v_media_id,
    case when p_make_primary then 0
      else coalesce((select max(sort_order) + 1 from public.product_media where product_id = p_product_id), 0) end,
    p_make_primary
  );
  return v_media_id;
end;
$$;

create or replace function public.operations_set_primary_product_image(
  p_product_id uuid,
  p_media_asset_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_operations_staff();
  if not exists(select 1 from public.product_media where product_id = p_product_id and media_asset_id = p_media_asset_id) then
    raise exception 'PRODUCT_IMAGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  update public.product_media set is_primary = false where product_id = p_product_id and is_primary;
  update public.product_media set is_primary = true where product_id = p_product_id and media_asset_id = p_media_asset_id;
end;
$$;

create or replace function public.operations_reorder_product_images(
  p_product_id uuid,
  p_media_asset_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_operations_staff();
  update public.product_media pm set sort_order = ordered.position - 1
  from unnest(p_media_asset_ids) with ordinality as ordered(id, position)
  where pm.product_id = p_product_id and pm.media_asset_id = ordered.id;
end;
$$;

-- Unlinks an image from one product. The asset and storage object are kept
-- because other options may still use them.
create or replace function public.operations_remove_product_image(
  p_product_id uuid,
  p_media_asset_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_was_primary boolean;
begin
  perform private.require_operations_staff();
  delete from public.product_media
  where product_id = p_product_id and media_asset_id = p_media_asset_id
  returning is_primary into v_was_primary;
  if not found then raise exception 'PRODUCT_IMAGE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_was_primary then
    update public.product_media set is_primary = true
    where product_id = p_product_id and media_asset_id = (
      select media_asset_id from public.product_media where product_id = p_product_id order by sort_order limit 1
    );
  end if;
end;
$$;

-- Replaces the gallery of every other option in the group with the source gallery.
create or replace function public.operations_copy_product_images_to_group(
  p_product_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group text;
  v_count integer;
begin
  perform private.require_operations_staff();
  select variant_group_key into v_group from public.products where id = p_product_id;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_group is null then raise exception 'VARIANT_GROUP_NOT_FOUND' using errcode = 'P0002'; end if;

  delete from public.product_media pm using public.products p
  where pm.product_id = p.id and p.variant_group_key = v_group and p.id <> p_product_id;

  insert into public.product_media(product_id, media_asset_id, sort_order, is_primary)
  select p.id, source.media_asset_id, source.sort_order, source.is_primary
  from public.products p
  cross join public.product_media source
  where p.variant_group_key = v_group and p.id <> p_product_id and source.product_id = p_product_id;

  select count(*)::integer into v_count from public.products where variant_group_key = v_group and id <> p_product_id;
  return v_count;
end;
$$;

-- The 19-argument editor wrapper now adds an uploaded image as the new primary
-- gallery image instead of replacing the whole gallery.
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
    2::smallint, p_on_hand, p_inventory_notes, null, null, null, null
  );

  if p_image_object_key is not null then
    perform public.operations_add_product_image(
      p_product_id, p_image_object_key, p_image_mime_type, p_image_width, p_image_height, true
    );
  end if;
end;
$$;

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.operations_create_product(uuid, text, text)',
    'public.operations_add_product_option(uuid, text, text)',
    'public.operations_set_product_option(uuid, text, text)',
    'public.operations_reorder_product_options(text, uuid[])',
    'public.operations_update_group_details(text, text, text, text, text, uuid)',
    'public.operations_set_product_active(uuid, boolean)',
    'public.operations_add_product_image(uuid, text, text, integer, integer, boolean)',
    'public.operations_set_primary_product_image(uuid, uuid)',
    'public.operations_reorder_product_images(uuid, uuid[])',
    'public.operations_remove_product_image(uuid, uuid)',
    'public.operations_copy_product_images_to_group(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated', v_signature);
  end loop;
end;
$$;

revoke all on function private.require_operations_staff() from public, anon;
grant execute on function private.require_operations_staff() to authenticated;
revoke all on function private.next_operations_sku() from public, anon;
grant execute on function private.next_operations_sku() to authenticated;
revoke all on function private.validate_option_label(text) from public, anon;
grant execute on function private.validate_option_label(text) to authenticated;
revoke all on function private.ensure_unique_option_label(text, text, uuid) from public, anon;
grant execute on function private.ensure_unique_option_label(text, text, uuid) to authenticated;
