begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.orders'::regclass), 'orders has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.order_items'::regclass), 'order_items has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.vendors'::regclass), 'internal vendors has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.product_sourcing_suggestions'::regclass), 'product sourcing suggestions has RLS');
select has_function('public', 'create_doctor_order', 'transactional order function exists');
select ok(has_function_privilege('authenticated', 'public.create_doctor_order(uuid,public.currency_code,text,text,text,text,jsonb)', 'EXECUTE'), 'authenticated can execute checkout RPC');
select ok(not has_table_privilege('authenticated', 'public.vendors', 'SELECT'), 'Doctor cannot read vendors');
select ok(not has_table_privilege('authenticated', 'public.purchase_orders', 'SELECT'), 'Doctor cannot read purchase orders');
select ok(not has_table_privilege('authenticated', 'public.inventory_balances', 'SELECT'), 'Doctor cannot read inventory balances');
select ok(not has_table_privilege('authenticated', 'public.product_sourcing_suggestions', 'SELECT'), 'Doctor cannot read sourcing suggestions');
select ok(has_table_privilege('service_role', 'public.product_sourcing_suggestions', 'SELECT'), 'service role can read internal sourcing suggestions');
select ok(has_table_privilege('authenticated', 'public.products', 'SELECT'), 'Doctor can read products through RLS');
select ok(not has_table_privilege('anon', 'public.products', 'SELECT'), 'anonymous users cannot read products');
select is((select count(*)::integer from public.categories), 12, 'dental catalog has 12 categories');
select is((select count(*)::integer from public.products), 196, 'dental catalog has 196 products');
select is((select count(*)::integer from public.product_prices), 0, 'unverified catalog has no invented prices');
select is((select count(*)::integer from public.inventory_balances where on_hand <> 0), 0, 'unverified catalog has no invented inventory');
select throws_ok(
  $$select * from public.create_doctor_order('00000000-0000-0000-0000-000000000001', 'USD', 'عنوان توصيل صالح', 'طبيب اختبار', '+963900000000', null, '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":1}]'::jsonb)$$,
  '42501',
  'AUTH_REQUIRED',
  'checkout rejects unauthenticated calls'
);

select * from finish();
rollback;
