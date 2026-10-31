begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

select ok((select relrowsecurity from pg_class where oid = 'public.staff_accounts'::regclass), 'staff accounts has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_events'::regclass), 'audit events has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.order_inventory_reservations'::regclass), 'reservations has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.product_costs'::regclass), 'product costs has RLS');

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('91000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor-ops-test@example.com', 'test', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"طبيب اختبار العمليات"}'),
  ('92000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-ops-test@example.com', 'test', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"مالك اختبار العمليات"}');

insert into public.staff_accounts(user_id, rank)
values ('92000000-0000-0000-0000-000000000001', 'owner');

set local role authenticated;
set local "request.jwt.claim.sub" = '91000000-0000-0000-0000-000000000001';
select is((select count(*)::integer from public.operations_get_my_context()), 0, 'Doctor has no staff context');
select is((select count(*)::integer from public.inventory_balances), 0, 'Doctor cannot read internal inventory through RLS');
select is_empty(
  $$update public.products set availability = 'available' where id = '20000000-0000-0000-0000-000000000001' returning id$$,
  'Doctor cannot update catalog through staff policy'
);
select throws_ok(
  $$select public.operations_set_product_price('20000000-0000-0000-0000-000000000001'::uuid, 2500::bigint, 'USD'::public.currency_code, 2::smallint)$$,
  '42501', 'STAFF_REQUIRED', 'Doctor cannot call Operations pricing mutation'
);

set local "request.jwt.claim.sub" = '92000000-0000-0000-0000-000000000001';
select is((select rank::text from public.operations_get_my_context()), 'owner', 'Owner receives staff context');
select is((select count(*)::integer from public.products), 202, 'Owner inherits Operations catalog access');

select public.operations_set_product_price('20000000-0000-0000-0000-000000000001'::uuid, 2500::bigint, 'USD'::public.currency_code, 2::smallint);
select is((select count(*)::integer from public.product_prices where product_id = '20000000-0000-0000-0000-000000000001' and currency = 'USD' and active), 1, 'Operations creates one active USD accounting price');
select ok((select count(*) from public.audit_events where table_name = 'product_prices') > 0, 'Selling price change is audited');

select public.operations_set_exchange_rate('USD'::public.currency_code, 'NEW_SYP'::public.currency_code, 125::numeric);
select is((select rate from public.exchange_rates where base_currency = 'USD' and quote_currency = 'NEW_SYP' and active), 125.00000000::numeric, 'Operations changes exchange rate directly');
select ok((select count(*) from public.audit_events where table_name = 'exchange_rates') >= 1, 'Exchange rate change is audited');

select * from public.operations_adjust_inventory('20000000-0000-0000-0000-000000000001'::uuid, 10, 'رصيد اختبار العمليات');
select is((select on_hand from public.inventory_balances where product_id = '20000000-0000-0000-0000-000000000001'), 10, 'Operations adjusts inventory');
select is((select count(*)::integer from public.inventory_movements where product_id = '20000000-0000-0000-0000-000000000001' and movement_type = 'adjustment'), 1, 'Inventory adjustment creates movement');

select public.operations_update_product(
  '20000000-0000-0000-0000-000000000001'::uuid,
  'منتج محرر للاختبار',
  'شركة اختبار',
  'علبة',
  'عبوة 10 قطع',
  'وصف يظهر للطبيب بعد الحفظ',
  'مواصفات قابلة للتعديل من العمليات',
  'available'::public.product_availability,
  3,
  3000,
  1800,
  'NEW_SYP'::public.currency_code,
  0::smallint,
  12,
  'تسوية اختبار شاشة المنتجات',
  'products/20000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001.webp',
  'image/webp',
  1200,
  1200
);
select is((select name_ar from public.products where id = '20000000-0000-0000-0000-000000000001'), 'منتج محرر للاختبار', 'Product management updates Doctor-visible name');
select is((select description_ar from public.products where id = '20000000-0000-0000-0000-000000000001'), 'وصف يظهر للطبيب بعد الحفظ', 'Product management updates Doctor-visible description');
select is((select manufacturer from public.products where id = '20000000-0000-0000-0000-000000000001'), 'شركة اختبار', 'Product management updates manufacturer');
select is((select specifications_ar from public.products where id = '20000000-0000-0000-0000-000000000001'), 'مواصفات قابلة للتعديل من العمليات', 'Product management updates specifications');
select is((select low_stock_threshold from public.products where id = '20000000-0000-0000-0000-000000000001'), 3, 'Product management stores low-stock threshold');
select is((select on_hand from public.inventory_balances where product_id = '20000000-0000-0000-0000-000000000001'), 12, 'Product management safely sets exact on-hand quantity');
select is((select amount_minor from public.product_prices where product_id = '20000000-0000-0000-0000-000000000001' and currency = 'NEW_SYP' and active), 3000::bigint, 'Product management replaces SYP selling price');
select is((select amount_minor from public.product_costs where product_id = '20000000-0000-0000-0000-000000000001' and currency = 'NEW_SYP' and active), 1800::bigint, 'Product management stores protected SYP cost');
select is((select count(*)::integer from public.product_media where product_id = '20000000-0000-0000-0000-000000000001' and is_primary), 1, 'Product management binds one primary image');
select ok((select count(*) from public.audit_events where table_name = 'product_costs') > 0, 'Cost change is audited');

set local "request.jwt.claim.sub" = '91000000-0000-0000-0000-000000000001';
select is((select count(*)::integer from public.product_costs), 0, 'Doctor cannot read product costs');
select is((select count(*)::integer from public.product_media where product_id = '20000000-0000-0000-0000-000000000001'), 1, 'Doctor can read the newly published product image link');
set local "request.jwt.claim.sub" = '92000000-0000-0000-0000-000000000001';

update public.products set availability = 'available' where id = '20000000-0000-0000-0000-000000000001';
reset role;
create temporary table test_operations_order(order_id uuid, order_number text) on commit drop;
grant select, insert on test_operations_order to authenticated;
set local role authenticated;
set local "request.jwt.claim.sub" = '91000000-0000-0000-0000-000000000001';
insert into test_operations_order
select * from public.create_doctor_order(
  '93000000-0000-0000-0000-000000000001', 'USD', 'عنوان اختبار صالح للطلب', 'طبيب اختبار', '+963900000000', null,
  '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":2}]'::jsonb,
  33.5138, 36.2765, 'operations-test-place'
);
select is((select count(*)::integer from test_operations_order), 1, 'Doctor creates priced order for Operations flow');

set local "request.jwt.claim.sub" = '92000000-0000-0000-0000-000000000001';
select is((select public.operations_confirm_order(order_id)::text from test_operations_order), 'preparing', 'Operations confirms and reserves complete order');
select is((select reserved from public.inventory_balances where product_id = '20000000-0000-0000-0000-000000000001'), 2, 'Confirmation reserves full quantity');
select is((select public.operations_set_order_status(order_id, 'problem')::text from test_operations_order), 'problem', 'Operations can flag a reserved order problem');
select is((select public.operations_confirm_order(order_id)::text from test_operations_order), 'preparing', 'Operations resumes a resolved reserved order');
select is((select reserved from public.inventory_balances where product_id = '20000000-0000-0000-0000-000000000001'), 2, 'Reconfirmation does not double reserve inventory');
select is((select public.operations_set_order_status(order_id, 'ready_for_delivery')::text from test_operations_order), 'ready_for_delivery', 'Complete order becomes ready');
select is((select public.operations_set_order_status(order_id, 'out_for_delivery')::text from test_operations_order), 'out_for_delivery', 'Complete order dispatches');
select is((select on_hand from public.inventory_balances where product_id = '20000000-0000-0000-0000-000000000001'), 10, 'Dispatch deducts full quantity');
select is((select reserved from public.inventory_balances where product_id = '20000000-0000-0000-0000-000000000001'), 0, 'Dispatch clears reservation');
select is((select public.operations_set_order_status(order_id, 'delivered')::text from test_operations_order), 'delivered', 'Operations completes delivery');
select ok((select count(*) from public.audit_events where table_name = 'orders') >= 4, 'Order status changes are audited');

select * from finish();
rollback;
