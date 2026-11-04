-- Operations uploads product images as they are (no forced 1200×1200 crop), so
-- accept any reasonable dimensions; the path, type and 5 MB bucket limit still apply.
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
    or coalesce(p_width, 0) not between 1 and 8000
    or coalesce(p_height, 0) not between 1 and 8000 then
    raise exception 'INVALID_PRODUCT_IMAGE' using errcode = '22023';
  end if;

  insert into public.media_assets(provider, object_key, mime_type, alt_text_ar, width, height, metadata)
  values ('supabase', p_object_key, p_mime_type, v_name, p_width, p_height,
    jsonb_build_object('purpose', 'product-gallery', 'normalized', false))
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

revoke all on function public.operations_add_product_image(uuid, text, text, integer, integer, boolean) from public, anon;
grant execute on function public.operations_add_product_image(uuid, text, text, integer, integer, boolean) to authenticated;
