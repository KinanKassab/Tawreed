-- Typo tolerance for short words and unfinished English words.
-- Trigram similarity is too weak for 4-6 letter words (one wrong letter in "تبطين" breaks most of its trigrams),
-- so single-word typos are now matched by edit distance per word, and synonyms also match by prefix or edit
-- distance ("composit" reaches the composite group and its Arabic names).
create extension if not exists fuzzystrmatch with schema extensions;

-- Edit-distance budget for one word: 1 letter up to 6 letters, 2 letters for longer words.
create or replace function public.catalog_typo_budget(word text)
returns integer
language sql
immutable
parallel safe
strict
set search_path = ''
as $function$
  select case when length(word) < 4 then 0 when length(word) <= 6 then 1 else 2 end
$function$;

-- True when every word of a normalized query appears in a normalized text, allowing typos:
-- words under 4 letters must start a word of the text; longer words may be within their typo budget of a whole
-- word, or (from 6 letters) of the start of a longer word, which covers a typo in a word still being typed.
-- At least one query word must have 4+ letters, so short queries never match by typo alone.
create or replace function public.catalog_fuzzy_words_match(p_query text, p_text text)
returns boolean
language sql
immutable
parallel safe
strict
set search_path = ''
as $function$
  select coalesce(bool_or(length(query_word) >= 4) and bool_and(exists (
    select 1
    from regexp_split_to_table(p_text, ' +') as text_words(text_word)
    where text_word <> ''
      and (
        text_word like query_word || '%'
        or (
          length(query_word) >= 4
          and abs(length(text_word) - length(query_word)) <= public.catalog_typo_budget(query_word)
          and extensions.levenshtein(query_word, text_word) <= public.catalog_typo_budget(query_word)
        )
        or (
          length(query_word) >= 6
          and length(text_word) > length(query_word)
          and extensions.levenshtein(query_word, left(text_word, length(query_word))) <= 1
        )
      )
  )), false)
  from regexp_split_to_table(p_query, ' +') as query_words(query_word)
  where query_word <> ''
$function$;

comment on function public.catalog_fuzzy_words_match(text, text) is
  'Word-by-word typo match for catalog search: every query word must match a word of the text within its edit-distance budget.';

-- p_include_inactive lets Operations search archived products too. The function runs as the caller, so the products
-- RLS still decides what is visible: visitors and doctors only ever see active rows, whatever they pass.
-- The old 4-argument version is dropped so PostgREST never has two candidates for the same named call.
drop function public.search_catalog_products(text, uuid, public.product_availability[], integer);

create function public.search_catalog_products(
  p_query text,
  p_category_id uuid default null,
  p_availability public.product_availability[] default null,
  p_limit integer default 1000,
  p_include_inactive boolean default false
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
  matched_groups as (
    select distinct matched.group_key
    from input
    join public.catalog_search_synonyms matched
      on matched.term_normalized = input.query
      or (length(input.query) >= 4 and matched.term_normalized like input.query || '%')
      or (
        length(input.query) >= 4
        and abs(length(matched.term_normalized) - length(input.query)) <= public.catalog_typo_budget(input.query)
        and extensions.levenshtein(input.query, matched.term_normalized) <= public.catalog_typo_budget(input.query)
      )
  ),
  expanded_values as (
    select query as term from input where query <> ''
    union
    select synonym.term_normalized
    from matched_groups
    join public.catalog_search_synonyms synonym on synonym.group_key = matched_groups.group_key
  ),
  expanded_terms as materialized (
    select term, public.catalog_prefix_tsquery(term) as prefix_query
    from expanded_values
  ),
  scored as (
    select product.id,
      product.availability,
      lower(product.sku) = input.raw_query as sku_match,
      product.name_ar_normalized = term.term as ar_exact,
      product.name_en_normalized = term.term as en_exact,
      product.name_ar_normalized like term.term || '%' as ar_prefix,
      product.search_normalized like term.term || '%' as text_prefix,
      product.search_fts @@ term.prefix_query as fts_match,
      ts_rank_cd(product.search_fts, term.prefix_query) as fts_rank,
      position(term.term in product.search_normalized) > 0 as contains_term,
      case when length(term.term) >= 3 then greatest(
        extensions.similarity(product.name_ar_normalized, term.term),
        extensions.similarity(product.name_en_normalized, term.term),
        extensions.similarity(product.search_normalized, term.term)
      ) else 0 end as trigram_score,
      length(term.term) >= 3 and (
        product.name_ar_normalized operator(extensions.%) term.term
        or product.name_en_normalized operator(extensions.%) term.term
        or product.search_normalized operator(extensions.%) term.term
      ) as trigram_match,
      -- Names and the option label ("كفوف" + "نتريل"); descriptions are left out so typos only reach what a product is called.
      public.catalog_fuzzy_words_match(
        term.term,
        product.name_ar_normalized || ' ' || product.name_en_normalized || ' ' || public.normalize_catalog_search(coalesce(product.variant_label_ar, ''))
      ) as word_typo_match
    from public.products product
    cross join input
    cross join expanded_terms term
    where (product.active or coalesce(p_include_inactive, false))
      and (p_category_id is null or product.category_id = p_category_id)
      and (p_availability is null or product.availability = any(p_availability))
  ),
  ranked as (
    select id,
      max(
        case when sku_match then 140 else 0 end
        + case when ar_exact then 110 else 0 end
        + case when en_exact then 105 else 0 end
        + case when ar_prefix then 80 else 0 end
        + case when text_prefix then 55 else 0 end
        + case when fts_match then 35 + (20 * fts_rank) else 0 end
        + case when contains_term then 24 else 0 end
        + 45 * trigram_score
        + case when word_typo_match then 30 else 0 end
        + case availability when 'available' then 4 when 'limited' then 2 else 0 end
      )::double precision as rank
    from scored
    where sku_match or text_prefix or contains_term or fts_match or trigram_match or word_typo_match
    group by id
  )
  select ranked.id, ranked.rank
  from ranked
  order by ranked.rank desc, ranked.id
  limit least(greatest(coalesce(p_limit, 1000), 1), 1000)
$function$;

comment on function public.search_catalog_products(text, uuid, public.product_availability[], integer, boolean) is
  'Ranks catalog rows using normalized exact/prefix matches, simple full-text search, synonyms, trigram similarity and per-word edit distance. Runs as the caller, so products RLS applies.';

revoke execute on function public.search_catalog_products(text, uuid, public.product_availability[], integer, boolean) from public;
grant execute on function public.search_catalog_products(text, uuid, public.product_availability[], integer, boolean) to anon, authenticated;

-- The search runs as the caller (security invoker), so its helpers stay executable by visitors, as before.
revoke execute on function public.catalog_typo_budget(text) from public;
revoke execute on function public.catalog_fuzzy_words_match(text, text) from public;
grant execute on function public.catalog_typo_budget(text) to anon, authenticated;
grant execute on function public.catalog_fuzzy_words_match(text, text) to anon, authenticated;
