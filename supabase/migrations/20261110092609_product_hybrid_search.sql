-- Lightweight bilingual catalog search. Existing catalog columns and indexes are
-- intentionally kept so this can be rolled out without rewriting application data.
create extension if not exists pg_trgm with schema extensions;

create or replace function public.normalize_catalog_search(input text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $function$
  select trim(
    regexp_replace(
      regexp_replace(
        translate(
          lower(input),
          'أإآٱؤئىيۀةـ',
          'ااااويييهه '
        ),
        '[ًٌٍَُِّْٰٕٖ]+',
        '',
        'g'
      ),
      '[[:punct:][:space:]]+',
      ' ',
      'g'
    )
  )
$function$;

comment on function public.normalize_catalog_search(text) is
  'Normalizes Arabic letter variants, diacritics, punctuation, whitespace, and Latin case for catalog search.';

alter table public.products
  add column search_normalized text generated always as (
    public.normalize_catalog_search(
      coalesce(sku, '') || ' ' || coalesce(name_ar, '') || ' ' || coalesce(name_en, '') || ' ' ||
      coalesce(manufacturer, '') || ' ' || coalesce(unit_label_ar, '') || ' ' || coalesce(package_label_ar, '') || ' ' ||
      coalesce(description_ar, '') || ' ' || coalesce(specifications_ar, '') || ' ' || coalesce(variant_label_ar, '')
    )
  ) stored,
  add column search_fts tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      public.normalize_catalog_search(
        coalesce(sku, '') || ' ' || coalesce(name_ar, '') || ' ' || coalesce(name_en, '') || ' ' ||
        coalesce(manufacturer, '') || ' ' || coalesce(unit_label_ar, '') || ' ' || coalesce(package_label_ar, '') || ' ' ||
        coalesce(description_ar, '') || ' ' || coalesce(specifications_ar, '') || ' ' || coalesce(variant_label_ar, '')
      )
    )
  ) stored;

create index products_search_normalized_trgm_idx
  on public.products using gin (search_normalized extensions.gin_trgm_ops);
create index products_search_fts_idx
  on public.products using gin (search_fts);

create table public.catalog_search_synonyms (
  id bigint generated always as identity primary key,
  group_key text not null,
  term text not null,
  term_normalized text generated always as (public.normalize_catalog_search(term)) stored,
  constraint catalog_search_synonyms_group_term_key unique (group_key, term_normalized),
  constraint catalog_search_synonyms_group_key_check check (group_key ~ '^[a-z0-9_]+$'),
  constraint catalog_search_synonyms_term_check check (length(trim(term)) between 1 and 80)
);

comment on table public.catalog_search_synonyms is
  'Non-sensitive Arabic/English catalog vocabulary used to expand exact search phrases.';

alter table public.catalog_search_synonyms enable row level security;
create policy catalog_search_synonyms_read_public
  on public.catalog_search_synonyms for select to anon, authenticated using (true);
grant select on public.catalog_search_synonyms to anon, authenticated;

insert into public.catalog_search_synonyms (group_key, term) values
  ('anesthetic', 'مخدر'), ('anesthetic', 'بنج'), ('anesthetic', 'تخدير'), ('anesthetic', 'anesthetic'),
  ('composite', 'كومبوزيت'), ('composite', 'كمبوزيت'), ('composite', 'حشوة ضوئية'), ('composite', 'composite'),
  ('gloves', 'قفازات'), ('gloves', 'كفوف'), ('gloves', 'جوانتي'), ('gloves', 'gloves'),
  ('cotton_roll', 'لفافات قطن'), ('cotton_roll', 'رول قطن'), ('cotton_roll', 'قطن رول'), ('cotton_roll', 'cotton roll'),
  ('burs', 'سنابل'), ('burs', 'رؤوس حفر'), ('burs', 'burs'),
  ('gutta_percha', 'كوتا'), ('gutta_percha', 'جوتا'), ('gutta_percha', 'gutta percha'),
  ('matrix', 'ماتريكس'), ('matrix', 'ماتركس'), ('matrix', 'matrix'),
  ('rubber_dam', 'حاجز مطاطي'), ('rubber_dam', 'رابر دام'), ('rubber_dam', 'rubber dam'),
  ('rotary', 'روتاري'), ('rotary', 'مبارد دوارة'), ('rotary', 'rotary'),
  ('paper_points', 'اقماع ورقية'), ('paper_points', 'أقماع ورقية'), ('paper_points', 'paper points')
on conflict (group_key, term_normalized) do nothing;

create or replace function public.catalog_prefix_tsquery(input text)
returns tsquery
language sql
immutable
parallel safe
strict
set search_path = ''
as $function$
  select coalesce(
    to_tsquery(
      'simple'::regconfig,
      string_agg(quote_literal(token) || ':*', ' & ' order by position)
    ),
    ''::tsquery
  )
  from regexp_split_to_table(public.normalize_catalog_search(input), ' +') with ordinality as words(token, position)
  where token <> ''
$function$;

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
  with input as (
    select public.normalize_catalog_search(left(coalesce(p_query, ''), 120)) as query,
           lower(trim(left(coalesce(p_query, ''), 120))) as raw_query
  ),
  expanded_terms as (
    select query as term from input where query <> ''
    union
    select synonym.term_normalized
    from input
    join public.catalog_search_synonyms matched on matched.term_normalized = input.query
    join public.catalog_search_synonyms synonym on synonym.group_key = matched.group_key
  ),
  ranked as (
    select product.id,
      max(
        case when lower(product.sku) = input.raw_query then 140 else 0 end
        + case when public.normalize_catalog_search(product.name_ar) = term.term then 110 else 0 end
        + case when public.normalize_catalog_search(coalesce(product.name_en, '')) = term.term then 105 else 0 end
        + case when public.normalize_catalog_search(product.name_ar) like term.term || '%' then 80 else 0 end
        + case when product.search_normalized like term.term || '%' then 55 else 0 end
        + case when product.search_fts @@ public.catalog_prefix_tsquery(term.term)
          then 35 + (20 * ts_rank_cd(product.search_fts, public.catalog_prefix_tsquery(term.term))) else 0 end
        + case when position(term.term in product.search_normalized) > 0 then 24 else 0 end
        + case when length(term.term) >= 3 then 35 * extensions.similarity(product.search_normalized, term.term) else 0 end
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
        or product.search_fts @@ public.catalog_prefix_tsquery(term.term)
        or (length(term.term) >= 3 and product.search_normalized operator(extensions.%) term.term)
      )
    group by product.id
  )
  select ranked.id, ranked.rank
  from ranked
  order by ranked.rank desc, ranked.id
  limit least(greatest(coalesce(p_limit, 1000), 1), 1000)
$function$;

comment on function public.search_catalog_products(text, uuid, public.product_availability[], integer) is
  'Ranks active catalog rows using normalized exact/prefix matches, simple full-text search, synonyms, and pg_trgm typo tolerance.';

revoke execute on function public.normalize_catalog_search(text) from public, anon, authenticated;
revoke execute on function public.catalog_prefix_tsquery(text) from public, anon, authenticated;
revoke execute on function public.search_catalog_products(text, uuid, public.product_availability[], integer) from public;
grant execute on function public.search_catalog_products(text, uuid, public.product_availability[], integer) to anon, authenticated;
