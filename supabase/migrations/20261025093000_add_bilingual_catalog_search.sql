create extension if not exists pg_trgm with schema extensions;

alter table public.categories add column name_en text;

alter table public.products add column search_text text generated always as (
  lower(
    coalesce(sku, '') || ' ' ||
    coalesce(name_ar, '') || ' ' ||
    coalesce(name_en, '') || ' ' ||
    coalesce(manufacturer, '')
  )
) stored;

create index products_search_text_idx on public.products using gin (search_text extensions.gin_trgm_ops);
