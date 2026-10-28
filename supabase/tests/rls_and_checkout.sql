begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.orders'::regclass), 'orders has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.order_items'::regclass), 'order_items has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.vendors'::regclass), 'internal vendors has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.product_sourcing_suggestions'::regclass), 'product sourcing suggestions has RLS');
select has_function('public', 'create_doctor_order', 'transactional order function exists');
select ok(has_function_privilege('authenticated', 'public.create_doctor_order(uuid,public.currency_code,text,text,text,text,jsonb,double precision,double precision,text)', 'EXECUTE'), 'authenticated can execute checkout RPC');
select ok(not has_table_privilege('authenticated', 'public.vendors', 'SELECT'), 'Doctor cannot read vendors');
select ok(not has_table_privilege('authenticated', 'public.purchase_orders', 'SELECT'), 'Doctor cannot read purchase orders');
select ok(has_table_privilege('authenticated', 'public.inventory_balances', 'SELECT'), 'operations client can reach inventory only through RLS');
select ok(not has_table_privilege('authenticated', 'public.product_sourcing_suggestions', 'SELECT'), 'Doctor cannot read sourcing suggestions');
select ok(has_table_privilege('service_role', 'public.product_sourcing_suggestions', 'SELECT'), 'service role can read internal sourcing suggestions');
select ok(has_table_privilege('authenticated', 'public.products', 'SELECT'), 'Doctor can read products through RLS');
select ok(has_table_privilege('anon', 'public.products', 'SELECT'), 'visitors can browse active products through RLS');
select ok(has_table_privilege('anon', 'public.categories', 'SELECT'), 'visitors can browse active categories through RLS');
select ok(has_table_privilege('anon', 'public.product_prices', 'SELECT'), 'visitors can see active catalog prices through RLS');
select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'), 'visitors cannot read profiles');
select ok(not has_table_privilege('anon', 'public.orders', 'SELECT'), 'visitors cannot read orders');
select is((select count(*)::integer from public.categories), 12, 'dental catalog has 12 categories');
select is((select count(*)::integer from public.products), 198, 'dental catalog has 198 products');
select is((select count(*)::integer from public.product_prices), 0, 'unverified catalog has no invented prices');
select is((select count(*)::integer from public.inventory_balances where on_hand <> 0), 0, 'unverified catalog has no invented inventory');

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (
  '94000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'onboarding-test@example.com', 'test', now(), now(), now(), '{"provider":"email","providers":["email"]}',
  '{"first_name":"طبيب","last_name":"التوصيل","full_name":"طبيب التوصيل","phone":"+963900000000","preferred_contact":"whatsapp","default_address":"دمشق، شارع الاختبار، بناء ١٠","default_latitude":33.5138,"default_longitude":36.2765,"default_google_place_id":"place-test"}'
);
select is((select full_name from public.profiles where id = '94000000-0000-0000-0000-000000000001'), 'طبيب التوصيل', 'registration trigger stores the Doctor name');
select is((select preferred_contact from public.profiles where id = '94000000-0000-0000-0000-000000000001'), 'whatsapp', 'registration trigger stores the follow-up preference');
select is((select count(*)::integer from public.addresses where user_id = '94000000-0000-0000-0000-000000000001' and is_default), 1, 'registration trigger creates one default delivery address');
select is((select latitude::numeric(8,4) from public.addresses where user_id = '94000000-0000-0000-0000-000000000001' and is_default), 33.5138::numeric, 'registration trigger stores delivery coordinates');

select throws_ok(
  $$select * from public.create_doctor_order('00000000-0000-0000-0000-000000000001', 'USD', 'عنوان توصيل صالح', 'طبيب اختبار', '+963900000000', null, '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":1}]'::jsonb, null, null, null)$$,
  '42501',
  'AUTH_REQUIRED',
  'checkout rejects unauthenticated calls'
);

select * from finish();
rollback;
