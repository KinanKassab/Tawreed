begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('93000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor-variants-test@example.com', 'test', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"طبيب اختبار الخيارات"}'),
  ('94000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager-variants-test@example.com', 'test', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"مدير اختبار الخيارات"}');
insert into public.staff_accounts(user_id, rank) values ('94000000-0000-0000-0000-000000000001', 'operations_manager');

set local role authenticated;
set local "request.jwt.claim.sub" = '93000000-0000-0000-0000-000000000001';
select throws_ok(
  $$select public.operations_add_product_option('20000000-0000-0000-0000-000000000001'::uuid, 'كبير', 'صغير')$$,
  '42501', 'STAFF_REQUIRED', 'Doctor cannot add product options'
);
select throws_ok(
  $$select public.operations_create_product('11000000-0000-0000-0000-000000000001'::uuid, 'منتج طبيب')$$,
  '42501', 'STAFF_REQUIRED', 'Doctor cannot create products'
);
select throws_ok(
  $$select public.operations_set_product_active('20000000-0000-0000-0000-000000000001'::uuid, false)$$,
  '42501', 'STAFF_REQUIRED', 'Doctor cannot archive products'
);
select throws_ok(
  $$select public.operations_set_unit_label(array['20000000-0000-0000-0000-000000000001'::uuid], 'علبة')$$,
  '42501', 'STAFF_REQUIRED', 'Doctor cannot change the sales unit'
);
select throws_ok(
  $$select public.operations_set_product_category(array['20000000-0000-0000-0000-000000000002'::uuid], '11000000-0000-0000-0000-000000000005'::uuid)$$,
  '42501', 'STAFF_REQUIRED', 'Doctor cannot move products between categories'
);
select throws_ok(
  $$select public.operations_set_price_for_options(array['20000000-0000-0000-0000-000000000007'::uuid], 500)$$,
  '42501', 'STAFF_REQUIRED', 'Doctor cannot unify prices'
);

set local "request.jwt.claim.sub" = '94000000-0000-0000-0000-000000000001';

-- Seeded group ordering is backfilled.
select is(
  (select array_agg(variant_sort_order order by variant_sort_order) from public.products where variant_group_key = 'priced-liquids-725d4bace9eb'),
  array[0, 1], 'Existing option groups receive sequential sort order'
);

-- Converting a standalone product into a group.
create temporary table test_ids(name text primary key, id uuid) on commit drop;
insert into test_ids values ('option', public.operations_add_product_option('20000000-0000-0000-0000-000000000001'::uuid, 'كبير', 'صغير'));
select isnt((select variant_group_key from public.products where id = '20000000-0000-0000-0000-000000000001'), null, 'Standalone source joins a new group');
select is((select variant_label_ar from public.products where id = '20000000-0000-0000-0000-000000000001'), 'صغير', 'Source receives its option label');
select is(
  (select variant_group_key from public.products where id = (select id from test_ids where name = 'option')),
  (select variant_group_key from public.products where id = '20000000-0000-0000-0000-000000000001'),
  'New option shares the source group'
);
select is((select variant_sort_order from public.products where id = (select id from test_ids where name = 'option')), 1, 'New option is appended');
select matches((select sku from public.products where id = (select id from test_ids where name = 'option')), '^TWD-OPS-[0-9]{5}$', 'New option receives a generated SKU');
select is((select name_ar from public.products where id = (select id from test_ids where name = 'option')), 'أوجينول برازيلي', 'New option copies shared details');
select is((select count(*)::integer from public.product_prices where product_id = (select id from test_ids where name = 'option')), 0, 'New option starts without a price');
select ok((select count(*) from public.audit_events where table_name = 'products' and action = 'insert') > 0, 'Product creation is audited');

select throws_ok(
  $$select public.operations_add_product_option('20000000-0000-0000-0000-000000000001'::uuid, ' كبير ')$$,
  '23505', 'DUPLICATE_OPTION_LABEL', 'Duplicate option labels are rejected'
);
select throws_ok(
  $$select public.operations_add_product_option('20000000-0000-0000-0000-000000000002'::uuid, 'كبير')$$,
  '22023', 'INVALID_OPTION_LABEL', 'Converting needs a label for the source'
);

-- Rename, reorder and shared details.
select public.operations_set_product_option((select id from test_ids where name = 'option'), (select variant_group_key from public.products where id = '20000000-0000-0000-0000-000000000001'), 'عبوة كبيرة');
select is((select variant_label_ar from public.products where id = (select id from test_ids where name = 'option')), 'عبوة كبيرة', 'Option label can be renamed');
select public.operations_reorder_product_options(
  (select variant_group_key from public.products where id = '20000000-0000-0000-0000-000000000001'),
  array[(select id from test_ids where name = 'option'), '20000000-0000-0000-0000-000000000001'::uuid]
);
select is((select variant_sort_order from public.products where id = (select id from test_ids where name = 'option')), 0, 'Options can be reordered');
select throws_ok(
  $$select public.operations_reorder_product_options('priced-liquids-725d4bace9eb', array['20000000-0000-0000-0000-000000000001'::uuid])$$,
  '22023', 'OPTION_NOT_IN_GROUP', 'Reorder rejects options from another group'
);
select public.operations_update_group_details(
  (select variant_group_key from public.products where id = '20000000-0000-0000-0000-000000000001'),
  'أوجينول محدث', 'شركة', 'وصف مشترك', 'مواصفات', '11000000-0000-0000-0000-000000000002'::uuid
);
select is(
  (select count(*)::integer from public.products where variant_group_key = (select variant_group_key from public.products where id = '20000000-0000-0000-0000-000000000001') and name_ar = 'أوجينول محدث' and category_id = '11000000-0000-0000-0000-000000000002'),
  2, 'Shared details apply to every option'
);

-- Detach and move.
select public.operations_set_product_option((select id from test_ids where name = 'option'), null, null);
select is((select variant_group_key from public.products where id = (select id from test_ids where name = 'option')), null, 'Option can be detached into a standalone product');
select public.operations_set_product_option((select id from test_ids where name = 'option'), 'priced-liquids-725d4bace9eb', 'عبوة ثالثة');
select is((select variant_sort_order from public.products where id = (select id from test_ids where name = 'option')), 2, 'Moved option is appended to the target group');
select throws_ok(
  $$select public.operations_set_product_option('20000000-0000-0000-0000-000000000002'::uuid, 'missing-group', 'أ')$$,
  'P0002', 'VARIANT_GROUP_NOT_FOUND', 'Unknown target group is rejected'
);

-- Standalone creation and archiving.
insert into test_ids values ('created', public.operations_create_product('11000000-0000-0000-0000-000000000003'::uuid, 'منتج جديد من العمليات'));
select is((select availability::text from public.products where id = (select id from test_ids where name = 'created')), 'unavailable', 'Created product starts unavailable');
select public.operations_set_product_active((select id from test_ids where name = 'created'), false);
select is((select active from public.products where id = (select id from test_ids where name = 'created')), false, 'Product can be archived');
select public.operations_set_product_active((select id from test_ids where name = 'created'), true);
select is((select active from public.products where id = (select id from test_ids where name = 'created')), true, 'Product can be restored');

-- Gallery.
insert into test_ids values ('img1', public.operations_add_product_image(
  (select id from test_ids where name = 'created'),
  'products/' || (select id from test_ids where name = 'created') || '/aaaaaaaa-0000-0000-0000-000000000001.webp', 'image/webp', 1200, 1200, true));
insert into test_ids values ('img2', public.operations_add_product_image(
  (select id from test_ids where name = 'created'),
  'products/' || (select id from test_ids where name = 'created') || '/aaaaaaaa-0000-0000-0000-000000000002.webp', 'image/webp', 1200, 1200, false));
select is((select count(*)::integer from public.product_media where product_id = (select id from test_ids where name = 'created')), 2, 'Gallery keeps several images');
select is((select media_asset_id from public.product_media where product_id = (select id from test_ids where name = 'created') and is_primary), (select id from test_ids where name = 'img1'), 'First image stays primary when the second is added as gallery');
select public.operations_set_primary_product_image((select id from test_ids where name = 'created'), (select id from test_ids where name = 'img2'));
select is((select media_asset_id from public.product_media where product_id = (select id from test_ids where name = 'created') and is_primary), (select id from test_ids where name = 'img2'), 'Primary image can be changed');
select public.operations_remove_product_image((select id from test_ids where name = 'created'), (select id from test_ids where name = 'img2'));
select is((select media_asset_id from public.product_media where product_id = (select id from test_ids where name = 'created') and is_primary), (select id from test_ids where name = 'img1'), 'Removing the primary image promotes the next one');
select throws_ok(
  format($$select public.operations_add_product_image(%L::uuid, 'products/other/x.webp', 'image/webp', 1200, 1200)$$, (select id from test_ids where name = 'created')),
  '22023', 'INVALID_PRODUCT_IMAGE', 'Image path must belong to the product'
);

select public.operations_add_product_image('20000000-0000-0000-0000-000000000007'::uuid,
  'products/20000000-0000-0000-0000-000000000007/bbbbbbbb-0000-0000-0000-000000000001.webp', 'image/webp', 1200, 1200, true);
select is(public.operations_copy_product_images_to_group('20000000-0000-0000-0000-000000000007'::uuid), 2, 'Copy reports updated options');
select is(
  (select count(distinct pm.media_asset_id)::integer from public.product_media pm join public.products p on p.id = pm.product_id
   where p.variant_group_key = 'priced-liquids-725d4bace9eb' and pm.is_primary),
  1, 'Every option in the group shares the copied primary image'
);

-- Editor upload keeps the gallery.
select public.operations_update_product(
  (select id from test_ids where name = 'created'), 'منتج جديد من العمليات', '', 'قطعة', '', '', '',
  'unavailable'::public.product_availability, 5, null, null, 'USD'::public.currency_code, 2::smallint, 0, '',
  'products/' || (select id from test_ids where name = 'created') || '/aaaaaaaa-0000-0000-0000-000000000003.webp', 'image/webp', 1200, 1200
);
select is((select count(*)::integer from public.product_media where product_id = (select id from test_ids where name = 'created')), 2, 'Editor upload adds a primary image without wiping the gallery');

-- Sales unit for a whole group.
select is(public.operations_set_unit_label(
  (select array_agg(id) from public.products where variant_group_key = 'priced-liquids-725d4bace9eb'), '  علبة  '), 3, 'Sales unit changes for every option of a group');
select is((select count(*)::integer from public.products where variant_group_key = 'priced-liquids-725d4bace9eb' and unit_label_ar = 'علبة'), 3, 'Sales unit is trimmed and stored');
select is(public.operations_set_unit_label(array['20000000-0000-0000-0000-000000000007'::uuid], 'علبة'), 0, 'Unchanged unit reports no updated rows');
select throws_ok(
  $$select public.operations_set_unit_label(array['20000000-0000-0000-0000-000000000007'::uuid], '  ')$$,
  '22023', 'INVALID_UNIT_LABEL', 'Empty sales unit is rejected'
);

-- Uncropped uploads keep their own dimensions.
select isnt(public.operations_add_product_image(
  (select id from test_ids where name = 'created'),
  'products/' || (select id from test_ids where name = 'created') || '/aaaaaaaa-0000-0000-0000-000000000004.jpg', 'image/jpeg', 1600, 900, false), null, 'Non-square images are accepted');
select throws_ok(
  format($$select public.operations_add_product_image(%L::uuid, %L, 'image/jpeg', 9000, 900)$$, (select id from test_ids where name = 'created'), 'products/' || (select id from test_ids where name = 'created') || '/aaaaaaaa-0000-0000-0000-000000000005.jpg'),
  '22023', 'INVALID_PRODUCT_IMAGE', 'Oversized image dimensions are rejected'
);

-- Category moves for standalone products.
select is(public.operations_set_product_category(array['20000000-0000-0000-0000-000000000002'::uuid], '11000000-0000-0000-0000-000000000005'::uuid), 1, 'Standalone product moves to another category');
select is((select category_id from public.products where id = '20000000-0000-0000-0000-000000000002'), '11000000-0000-0000-0000-000000000005'::uuid, 'New category is stored');
select throws_ok(
  $$select public.operations_set_product_category(array['20000000-0000-0000-0000-000000000002'::uuid], '11000000-0000-0000-0000-0000000000ff'::uuid)$$,
  'P0002', 'CATEGORY_NOT_FOUND', 'Unknown category is rejected'
);

-- Unify price across a whole group.
select is(public.operations_set_price_for_options(
  array['20000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000008'::uuid, (select id from test_ids where name = 'created')], 500), 3, 'Unifying a new price updates every requested product, priced or not');
select is((select count(*)::integer from public.products where id in ('20000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000008', (select id from test_ids where name = 'created')) and id in (select product_id from public.product_prices where currency = 'USD' and active and amount_minor = 500)), 3, 'Every requested product now has the unified USD price');
select is(public.operations_set_price_for_options(array['20000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000008'::uuid], 500), 0, 'Reapplying the same price reports no changes');
select is((select amount_minor from public.product_prices where product_id = '20000000-0000-0000-0000-000000000007' and currency = 'NEW_SYP' and active), 500::bigint, 'The SYP sync trigger still derives from the unified USD price');
select throws_ok(
  $$select public.operations_set_price_for_options(array['20000000-0000-0000-0000-000000000007'::uuid], -1)$$,
  '22023', 'INVALID_PRICE', 'A negative unified price is rejected'
);
select throws_ok(
  $$select public.operations_set_price_for_options(array['aaaaaaaa-0000-0000-0000-000000000099'::uuid], 500)$$,
  'P0002', 'PRODUCT_NOT_FOUND', 'Unifying price for an unknown product is rejected'
);

select * from finish();
rollback;
