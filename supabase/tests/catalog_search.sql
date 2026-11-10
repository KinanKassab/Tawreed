begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select is(public.normalize_catalog_search('  أَقْمَاع، ورقية  '), 'اقماع ورقيه', 'Arabic letters, diacritics, punctuation, and spacing normalize');
select is(public.normalize_catalog_search('Rubber-Dam'), 'rubber dam', 'Latin case and punctuation normalize');
select has_column('public', 'products', 'search_normalized', 'products store normalized search text');
select has_column('public', 'products', 'search_fts', 'products store a full-text vector');
select has_column('public', 'products', 'name_ar_normalized', 'products store normalized Arabic names');
select has_column('public', 'products', 'name_en_normalized', 'products store normalized English names');
select has_index('public', 'products', 'products_search_normalized_trgm_idx', 'trigram search index exists');
select has_index('public', 'products', 'products_search_fts_idx', 'full-text search index exists');
select has_index('public', 'products', 'products_name_ar_normalized_trgm_idx', 'Arabic name trigram index exists');
select has_index('public', 'products', 'products_name_en_normalized_trgm_idx', 'English name trigram index exists');
select has_function('public', 'search_catalog_products', array['text', 'uuid', 'product_availability[]', 'integer'], 'catalog search RPC exists');
select ok(has_function_privilege('anon', 'public.search_catalog_products(text,uuid,public.product_availability[],integer)', 'EXECUTE'), 'visitors can execute catalog search');
select ok(has_function_privilege('anon', 'public.normalize_catalog_search(text)', 'EXECUTE'), 'catalog RPC helper is executable by visitors');

insert into public.products (id, sku, name_ar, name_en, category_id, unit_label_ar, description_ar, availability, active)
values
  ('91000000-0000-0000-0000-000000000001', 'SEARCH-EXACT-1', 'مخدر أسنان', 'Dental Anesthetic', (select id from public.categories limit 1), 'علبة', 'تخدير موضعي للعيادة', 'available', true),
  ('91000000-0000-0000-0000-000000000002', 'SEARCH-RUBBER-2', 'حاجز مطاطي', 'Rubber Dam Sheets', (select id from public.categories limit 1), 'علبة', 'صفائح عزل', 'available', true),
  ('91000000-0000-0000-0000-000000000003', 'SEARCH-HIDDEN-3', 'بنج مخفي', null, (select id from public.categories limit 1), 'علبة', null, 'available', false);

set local role anon;
select is((select product_id from public.search_catalog_products('SEARCH-EXACT-1') limit 1), '91000000-0000-0000-0000-000000000001'::uuid, 'exact SKU ranks first');
select ok(exists(select 1 from public.search_catalog_products('بنج') where product_id = '91000000-0000-0000-0000-000000000001'), 'Arabic synonym finds the canonical product');
select ok(exists(select 1 from public.search_catalog_products('rubber da') where product_id = '91000000-0000-0000-0000-000000000002'), 'English prefix finds a product');
select ok(exists(select 1 from public.search_catalog_products('حاجر مطاطي') where product_id = '91000000-0000-0000-0000-000000000002'), 'trigram matching tolerates a typo');
select ok(not exists(select 1 from public.search_catalog_products('بنج') where product_id = '91000000-0000-0000-0000-000000000003'), 'RLS excludes inactive products');

select * from finish();
rollback;
