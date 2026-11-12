-- Anonymous "add this product" requests from the doctor catalog's empty search state.
-- By design nothing about the requester is stored: no user id, contact, IP or device. Visitors can only send a
-- request through public.request_catalog_product; only operations staff can read the list.
create table public.catalog_product_requests (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  product_name_normalized text generated always as (public.normalize_catalog_search(product_name)) stored,
  search_query text,
  created_at timestamptz not null default now(),
  constraint catalog_product_requests_name_check check (length(product_name) between 2 and 120),
  constraint catalog_product_requests_query_check check (search_query is null or length(search_query) <= 120)
);

comment on table public.catalog_product_requests is
  'Anonymous requests to stock a product that catalog search did not find. Holds no requester data by design.';

create index catalog_product_requests_created_idx on public.catalog_product_requests (created_at desc);
create index catalog_product_requests_name_idx on public.catalog_product_requests (product_name_normalized);

alter table public.catalog_product_requests enable row level security;

create policy catalog_product_requests_read_by_staff on public.catalog_product_requests for select to authenticated
using ((select private.has_staff_rank('operations_manager')));

create policy catalog_product_requests_delete_by_staff on public.catalog_product_requests for delete to authenticated
using ((select private.has_staff_rank('operations_manager')));

revoke all on public.catalog_product_requests from anon, authenticated;
grant select, delete on public.catalog_product_requests to authenticated;

create or replace function public.request_catalog_product(p_product_name text, p_search_query text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text := regexp_replace(trim(coalesce(p_product_name, '')), '\s+', ' ', 'g');
  v_query text := nullif(left(regexp_replace(trim(coalesce(p_search_query, '')), '\s+', ' ', 'g'), 120), '');
begin
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'PRODUCT_NAME_INVALID' using errcode = '22023';
  end if;

  -- The same name sent again within a minute (a double tap, a resend) is kept once.
  if exists (
    select 1
    from public.catalog_product_requests existing
    where existing.product_name_normalized = public.normalize_catalog_search(v_name)
      and existing.created_at > now() - interval '1 minute'
  ) then
    return;
  end if;

  -- A flood guard: the whole catalog takes at most 30 requests a minute.
  if (select count(*) from public.catalog_product_requests recent where recent.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = '54000';
  end if;

  insert into public.catalog_product_requests (product_name, search_query) values (v_name, v_query);
end;
$function$;

comment on function public.request_catalog_product(text, text) is
  'Records an anonymous request to stock a product. Stores only the product name and the search text, never the requester.';

revoke execute on function public.request_catalog_product(text, text) from public;
grant execute on function public.request_catalog_product(text, text) to anon, authenticated;
