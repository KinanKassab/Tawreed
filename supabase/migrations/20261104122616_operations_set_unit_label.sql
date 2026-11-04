-- Sets the sales unit (وحدة البيع) of several products at once, e.g. every
-- option of a product group, from the Operations group editor.
create or replace function public.operations_set_unit_label(
  p_product_ids uuid[],
  p_unit_label_ar text
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
  if char_length(trim(coalesce(p_unit_label_ar, ''))) not between 1 and 80 then
    raise exception 'INVALID_UNIT_LABEL' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_product_ids), 0) = 0 or exists(
    select 1 from unnest(p_product_ids) as requested(id)
    where not exists(select 1 from public.products p where p.id = requested.id)
  ) then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.products set unit_label_ar = trim(p_unit_label_ar)
  where id = any(p_product_ids) and unit_label_ar is distinct from trim(p_unit_label_ar);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.operations_set_unit_label(uuid[], text) from public, anon;
grant execute on function public.operations_set_unit_label(uuid[], text) to authenticated;
