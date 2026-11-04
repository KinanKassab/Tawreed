-- "توحيد السعر": sets the same USD selling price for several products at once
-- (every option of a group, from the Operations group editor). Writes a USD
-- product_prices row per product, same as editing one option at a time; the
-- existing sync trigger derives NEW_SYP for each.
create or replace function public.operations_set_price_for_options(
  p_product_ids uuid[],
  p_amount_minor bigint
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.require_operations_staff();
  if p_amount_minor < 0 then
    raise exception 'INVALID_PRICE' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_product_ids), 0) = 0 or exists(
    select 1 from unnest(p_product_ids) as requested(id)
    where not exists(select 1 from public.products p where p.id = requested.id)
  ) then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.product_prices set active = false, valid_to = greatest(clock_timestamp(), valid_from + interval '1 microsecond')
  where product_id = any(p_product_ids) and currency = 'USD' and active
    and amount_minor is distinct from p_amount_minor;

  insert into public.product_prices(product_id, currency, amount_minor, decimal_places)
  select requested.id, 'USD', p_amount_minor, 2
  from unnest(p_product_ids) as requested(id)
  where not exists(
    select 1 from public.product_prices pp
    where pp.product_id = requested.id and pp.currency = 'USD' and pp.active
  );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.operations_set_price_for_options(uuid[], bigint) from public, anon;
grant execute on function public.operations_set_price_for_options(uuid[], bigint) to authenticated;
