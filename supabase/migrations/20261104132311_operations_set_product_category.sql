-- Moves one product, or every option of a product group, to another category.
create or replace function public.operations_set_product_category(
  p_product_ids uuid[],
  p_category_id uuid
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
  if not exists(select 1 from public.categories where id = p_category_id) then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if coalesce(cardinality(p_product_ids), 0) = 0 or exists(
    select 1 from unnest(p_product_ids) as requested(id)
    where not exists(select 1 from public.products p where p.id = requested.id)
  ) then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.products set category_id = p_category_id
  where id = any(p_product_ids) and category_id is distinct from p_category_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.operations_set_product_category(uuid[], uuid) from public, anon;
grant execute on function public.operations_set_product_category(uuid[], uuid) to authenticated;
