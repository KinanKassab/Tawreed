alter table public.products
  add column name_ar_normalized text generated always as (public.normalize_catalog_search(name_ar)) stored,
  add column name_en_normalized text generated always as (public.normalize_catalog_search(coalesce(name_en, ''))) stored;

create index products_name_ar_normalized_trgm_idx
  on public.products using gin (name_ar_normalized extensions.gin_trgm_ops);
create index products_name_en_normalized_trgm_idx
  on public.products using gin (name_en_normalized extensions.gin_trgm_ops);

create or replace function public.search_catalog_products(
  p_query text,
  p_category_id uuid default null,
  p_availability public.product_availability[] default null,
  p_limit integer default 1000
)
returns table(product_id uuid, search_rank double precision)
language sql
stable
security invoker
set search_path = ''
as $function$
  with input as materialized (
    select public.normalize_catalog_search(left(coalesce(p_query, ''), 120)) as query,
           lower(trim(left(coalesce(p_query, ''), 120))) as raw_query
  ),
  expanded_values as (
    select query as term from input where query <> ''
    union
    select synonym.term_normalized
    from input
    join public.catalog_search_synonyms matched on matched.term_normalized = input.query
    join public.catalog_search_synonyms synonym on synonym.group_key = matched.group_key
  ),
  expanded_terms as materialized (
    select term, public.catalog_prefix_tsquery(term) as prefix_query
    from expanded_values
  ),
  ranked as (
    select product.id,
      max(
        case when lower(product.sku) = input.raw_query then 140 else 0 end
        + case when product.name_ar_normalized = term.term then 110 else 0 end
        + case when product.name_en_normalized = term.term then 105 else 0 end
        + case when product.name_ar_normalized like term.term || '%' then 80 else 0 end
        + case when product.search_normalized like term.term || '%' then 55 else 0 end
        + case when product.search_fts @@ term.prefix_query
          then 35 + (20 * ts_rank_cd(product.search_fts, term.prefix_query)) else 0 end
        + case when position(term.term in product.search_normalized) > 0 then 24 else 0 end
        + case when length(term.term) >= 3 then
            45 * greatest(
              extensions.similarity(product.name_ar_normalized, term.term),
              extensions.similarity(product.name_en_normalized, term.term),
              extensions.similarity(product.search_normalized, term.term)
            )
          else 0 end
        + case product.availability when 'available' then 4 when 'limited' then 2 else 0 end
      )::double precision as rank
    from public.products product
    cross join input
    cross join expanded_terms term
    where product.active
      and (p_category_id is null or product.category_id = p_category_id)
      and (p_availability is null or product.availability = any(p_availability))
      and (
        lower(product.sku) = input.raw_query
        or product.search_normalized like term.term || '%'
        or position(term.term in product.search_normalized) > 0
        or product.search_fts @@ term.prefix_query
        or (length(term.term) >= 3 and (
          product.name_ar_normalized operator(extensions.%) term.term
          or product.name_en_normalized operator(extensions.%) term.term
          or product.search_normalized operator(extensions.%) term.term
        ))
      )
    group by product.id
  )
  select ranked.id, ranked.rank
  from ranked
  order by ranked.rank desc, ranked.id
  limit least(greatest(coalesce(p_limit, 1000), 1), 1000)
$function$;
