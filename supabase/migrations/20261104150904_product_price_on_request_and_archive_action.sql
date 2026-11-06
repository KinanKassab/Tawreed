-- Products whose final price is determined after the customer requests a quote.
-- This is separate from a missing price so unfinished products stay hidden.
alter table public.products
add column price_on_request boolean not null default false;

create or replace function public.operations_set_price_on_request(
  p_product_id uuid,
  p_price_on_request boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_operations_staff();
  update public.products
  set price_on_request = p_price_on_request
  where id = p_product_id;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- A newly configured price always wins over the quote-only state.
create or replace function private.clear_price_on_request_when_priced()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.active then
    update public.products
    set price_on_request = false
    where id = new.product_id and price_on_request;
  end if;
  return new;
end;
$$;

create trigger clear_price_on_request_when_priced
after insert or update of active on public.product_prices
for each row execute function private.clear_price_on_request_when_priced();

-- The UI calls this "delete", but it performs one atomic soft-delete for a
-- standalone product or every option in a product group.
create or replace function public.operations_archive_products(
  p_product_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_requested integer;
  v_count integer;
begin
  perform private.require_operations_staff();
  v_requested := coalesce((select count(distinct id) from unnest(p_product_ids) requested(id)), 0);
  if v_requested = 0 then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1
  from public.products
  where id = any(p_product_ids)
  for update;
  if (select count(*) from public.products where id = any(p_product_ids)) <> v_requested then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists(
    select 1
    from public.inventory_balances
    where product_id = any(p_product_ids) and reserved > 0
  ) then
    raise exception 'PRODUCT_HAS_RESERVATIONS' using errcode = '55000';
  end if;

  update public.products
  set active = false
  where id = any(p_product_ids) and active;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.operations_set_price_on_request(uuid, boolean) from public, anon;
grant execute on function public.operations_set_price_on_request(uuid, boolean) to authenticated;
revoke all on function public.operations_archive_products(uuid[]) from public, anon;
grant execute on function public.operations_archive_products(uuid[]) to authenticated;
revoke all on function private.clear_price_on_request_when_priced() from public, anon, authenticated;
