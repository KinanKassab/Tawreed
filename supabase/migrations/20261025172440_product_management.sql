alter table public.products
add column low_stock_threshold integer not null default 5
check (low_stock_threshold >= 0 and low_stock_threshold <= 1000000);

create table public.product_costs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  currency public.currency_code not null,
  amount_minor bigint not null check (amount_minor >= 0),
  decimal_places smallint not null check (decimal_places between 0 and 4),
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  constraint product_cost_dates_check check (valid_to is null or valid_to > valid_from)
);
create unique index product_costs_one_active
on public.product_costs(product_id, currency) where active;
create index product_costs_product_history_idx
on public.product_costs(product_id, valid_from desc);

alter table public.product_costs enable row level security;
create policy product_costs_read_by_staff on public.product_costs for select to authenticated
using ((select private.has_staff_rank('operations_manager')));
create policy product_costs_insert_by_staff on public.product_costs for insert to authenticated
with check ((select private.has_staff_rank('operations_manager')));
create policy product_costs_update_by_staff on public.product_costs for update to authenticated
using ((select private.has_staff_rank('operations_manager')))
with check ((select private.has_staff_rank('operations_manager')));

revoke all on public.product_costs from anon, authenticated;
grant select, insert, update on public.product_costs to authenticated;
grant select, insert, update, delete on public.product_costs to service_role;

create trigger audit_product_costs after insert or update or delete on public.product_costs
for each row execute function private.capture_audit_event();
create trigger audit_media_assets after insert or update or delete on public.media_assets
for each row execute function private.capture_audit_event();
create trigger audit_product_media after insert or update or delete on public.product_media
for each row execute function private.capture_audit_event();

drop policy media_assets_read_catalog on public.media_assets;
create policy media_assets_read_allowed on public.media_assets for select to authenticated
using (
  exists(
    select 1 from public.product_media pm
    join public.products p on p.id = pm.product_id
    where pm.media_asset_id = media_assets.id and p.active
  )
  or (select private.has_staff_rank('operations_manager'))
);
create policy media_assets_insert_by_staff on public.media_assets for insert to authenticated
with check ((select private.has_staff_rank('operations_manager')));

drop policy product_media_read_catalog on public.product_media;
create policy product_media_read_allowed on public.product_media for select to authenticated
using (
  exists(select 1 from public.products p where p.id = product_media.product_id and p.active)
  or (select private.has_staff_rank('operations_manager'))
);
create policy product_media_insert_by_staff on public.product_media for insert to authenticated
with check ((select private.has_staff_rank('operations_manager')));
create policy product_media_delete_by_staff on public.product_media for delete to authenticated
using ((select private.has_staff_rank('operations_manager')));

grant insert on public.media_assets to authenticated;
grant insert, delete on public.product_media to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy product_media_objects_insert_by_staff
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] = 'products'
  and (select private.has_staff_rank('operations_manager'))
);
create policy product_media_objects_delete_by_staff
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] = 'products'
  and (select private.has_staff_rank('operations_manager'))
);

create or replace function public.operations_update_product(
  p_product_id uuid,
  p_name_ar text,
  p_description_ar text,
  p_availability public.product_availability,
  p_low_stock_threshold integer,
  p_sell_price_minor bigint,
  p_cost_minor bigint,
  p_currency public.currency_code,
  p_decimal_places smallint,
  p_on_hand integer,
  p_inventory_notes text,
  p_image_object_key text default null,
  p_image_mime_type text default null,
  p_image_width integer default null,
  p_image_height integer default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_warehouse_id uuid;
  v_warehouse_count integer;
  v_current_on_hand integer;
  v_reserved integer;
  v_current_price bigint;
  v_current_cost bigint;
  v_media_id uuid;
begin
  if not (select private.has_staff_rank('operations_manager')) then
    raise exception 'STAFF_REQUIRED' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name_ar, ''))) < 2 or char_length(trim(p_name_ar)) > 200 then
    raise exception 'INVALID_PRODUCT_NAME' using errcode = '22023';
  end if;
  if char_length(coalesce(p_description_ar, '')) > 5000
    or p_low_stock_threshold not between 0 and 1000000
    or p_on_hand not between 0 and 100000000
    or p_decimal_places not between 0 and 4
    or (p_sell_price_minor is not null and p_sell_price_minor < 0)
    or (p_cost_minor is not null and p_cost_minor < 0) then
    raise exception 'INVALID_PRODUCT_VALUES' using errcode = '22023';
  end if;
  if p_image_object_key is not null and (
    p_image_object_key !~ ('^products/' || p_product_id::text || '/[0-9a-f-]+[.](webp|png|jpe?g)$')
    or p_image_mime_type not in ('image/webp', 'image/png', 'image/jpeg')
    or p_image_width <> 1200
    or p_image_height <> 1200
  ) then
    raise exception 'INVALID_PRODUCT_IMAGE' using errcode = '22023';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;

  select count(*) into v_warehouse_count from public.warehouses where active;
  select id into v_warehouse_id from public.warehouses where active order by code limit 1;
  if v_warehouse_count <> 1 then
    raise exception 'SINGLE_WAREHOUSE_REQUIRED' using errcode = '55000';
  end if;

  insert into public.inventory_balances(warehouse_id, product_id, on_hand, reserved)
  values(v_warehouse_id, p_product_id, 0, 0)
  on conflict (warehouse_id, product_id) do nothing;
  select on_hand, reserved into v_current_on_hand, v_reserved
  from public.inventory_balances
  where warehouse_id = v_warehouse_id and product_id = p_product_id
  for update;
  if p_on_hand < v_reserved then
    raise exception 'STOCK_BELOW_RESERVED' using errcode = '23514';
  end if;

  update public.products set
    name_ar = trim(p_name_ar),
    description_ar = nullif(trim(coalesce(p_description_ar, '')), ''),
    availability = p_availability,
    low_stock_threshold = p_low_stock_threshold
  where id = p_product_id;

  select amount_minor into v_current_price from public.product_prices
  where product_id = p_product_id and currency = p_currency and active;
  if v_current_price is distinct from p_sell_price_minor then
    update public.product_prices set active = false, valid_to = greatest(clock_timestamp(), valid_from + interval '1 microsecond')
    where product_id = p_product_id and currency = p_currency and active;
    if p_sell_price_minor is not null then
      insert into public.product_prices(product_id, currency, amount_minor, decimal_places)
      values(p_product_id, p_currency, p_sell_price_minor, p_decimal_places);
    end if;
  end if;

  select amount_minor into v_current_cost from public.product_costs
  where product_id = p_product_id and currency = p_currency and active;
  if v_current_cost is distinct from p_cost_minor then
    update public.product_costs set active = false, valid_to = greatest(clock_timestamp(), valid_from + interval '1 microsecond')
    where product_id = p_product_id and currency = p_currency and active;
    if p_cost_minor is not null then
      insert into public.product_costs(product_id, currency, amount_minor, decimal_places)
      values(p_product_id, p_currency, p_cost_minor, p_decimal_places);
    end if;
  end if;

  if v_current_on_hand <> p_on_hand then
    update public.inventory_balances set on_hand = p_on_hand, updated_at = now()
    where warehouse_id = v_warehouse_id and product_id = p_product_id;
    insert into public.inventory_movements(
      warehouse_id, product_id, movement_type, quantity_delta,
      reference_type, notes, created_by
    ) values (
      v_warehouse_id, p_product_id, 'adjustment', p_on_hand - v_current_on_hand,
      'product_management', coalesce(nullif(trim(p_inventory_notes), ''), 'تعديل من شاشة إدارة المنتج'),
      (select auth.uid())
    );
  end if;

  if p_image_object_key is not null then
    insert into public.media_assets(
      provider, object_key, mime_type, alt_text_ar, width, height,
      metadata
    ) values (
      'supabase', p_image_object_key, p_image_mime_type, trim(p_name_ar),
      p_image_width, p_image_height,
      jsonb_build_object('purpose', 'product-primary', 'normalized', true)
    ) returning id into v_media_id;
    delete from public.product_media where product_id = p_product_id;
    insert into public.product_media(product_id, media_asset_id, sort_order, is_primary)
    values(p_product_id, v_media_id, 0, true);
  end if;
end;
$$;

revoke all on function public.operations_update_product(
  uuid, text, text, public.product_availability, integer, bigint, bigint,
  public.currency_code, smallint, integer, text, text, text, integer, integer
) from public, anon;
grant execute on function public.operations_update_product(
  uuid, text, text, public.product_availability, integer, bigint, bigint,
  public.currency_code, smallint, integer, text, text, text, integer, integer
) to authenticated;
