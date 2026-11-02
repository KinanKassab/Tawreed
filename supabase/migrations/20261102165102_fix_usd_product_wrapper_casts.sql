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
