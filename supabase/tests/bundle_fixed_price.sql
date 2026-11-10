begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Two priced products with known USD prices, and a known exchange rate.
create temporary table picked on commit drop as
  select row_number() over (order by p.id) as n, p.id
  from public.products p join public.product_prices pp on pp.product_id = p.id and pp.currency = 'USD' and pp.active
  where p.active limit 2;
update public.products set availability = 'available' where id in (select id from picked);
update public.product_prices set amount_minor = 1000 where product_id = (select id from picked where n = 1) and currency = 'USD' and active;
update public.product_prices set amount_minor = 3000 where product_id = (select id from picked where n = 2) and currency = 'USD' and active;
update public.exchange_rates set active = false where active;
insert into public.exchange_rates(base_currency, quote_currency, rate, active) values ('USD', 'NEW_SYP', 100, true);

insert into public.promo_banners(id, title_ar, image_object_key, bundle_price_usd_minor, bundle_items)
select 'a5000000-0000-0000-0000-000000000001', 'عرض', 'banners/test.webp', 2500,
  jsonb_build_array(jsonb_build_object('product_id', (select id from picked where n = 1), 'quantity', 1), jsonb_build_object('product_id', (select id from picked where n = 2), 'quantity', 1));
insert into public.promo_banners(id, title_ar, image_object_key, active, bundle_price_usd_minor, bundle_items)
select 'a5000000-0000-0000-0000-000000000002', 'موقوف', 'banners/test2.webp', false, 500, bundle_items from public.promo_banners where id = 'a5000000-0000-0000-0000-000000000001';

select is((select bundle_price_syp_minor from public.promo_banners where id = 'a5000000-0000-0000-0000-000000000001'), 2500::bigint, 'SYP offer price derives from the active rate');
update public.exchange_rates set rate = 111 where active;
select is((select bundle_price_syp_minor from public.promo_banners where id = 'a5000000-0000-0000-0000-000000000001'), 2775::bigint, 'a new rate reprices the offer');
update public.exchange_rates set rate = 100 where active;

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('95000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bundle-test@example.com', 'test', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"طبيب","last_name":"العروض","full_name":"طبيب العروض","phone":"+963900000001"}');
insert into auth.sessions(id, user_id, created_at, updated_at) values ('95000000-0000-0000-0000-0000000000a1', '95000000-0000-0000-0000-000000000001', now(), now());
select set_config('request.jwt.claims', '{"sub":"95000000-0000-0000-0000-000000000001","session_id":"95000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

create function pg_temp.place(p_key uuid, p_first integer, p_bundles uuid[]) returns uuid language sql as $$
  select order_id from public.create_doctor_order(p_key, 'NEW_SYP', 'عنوان توصيل صالح', 'طبيب اختبار', '+963900000000', null,
    jsonb_build_array(jsonb_build_object('product_id', (select id from picked where n = 1), 'quantity', p_first), jsonb_build_object('product_id', (select id from picked where n = 2), 'quantity', 1)),
    null, null, null, p_bundles);
$$;

create temporary table placed on commit drop as
  select pg_temp.place('95000000-0000-0000-0000-0000000000b1', 1, array['a5000000-0000-0000-0000-000000000001']::uuid[]) as id;
select is((select total_minor from public.orders where id = (select id from placed)), 2500::bigint, 'order total is the fixed SYP price, not the sum of products');
select is((select base_total_minor from public.orders where id = (select id from placed)), 2500::bigint, 'base total is the fixed USD price');
select is((select sum(line_total_minor)::bigint from public.order_items where order_id = (select id from placed)), 2500::bigint, 'order lines add up to the fixed price');

select pg_temp.place('95000000-0000-0000-0000-0000000000b1', 1, array['a5000000-0000-0000-0000-000000000001']::uuid[]);
select is((select total_minor from public.orders where id = (select id from placed)), 2500::bigint, 'a replay does not apply the offer twice');

-- Checkout's work table lives until commit, and this whole test is one transaction.
drop table requested_items;
create temporary table placed_extra on commit drop as
  select pg_temp.place('95000000-0000-0000-0000-0000000000b2', 3, array['a5000000-0000-0000-0000-000000000001']::uuid[]) as id;
select is((select total_minor from public.orders where id = (select id from placed_extra)), 4500::bigint, 'extra units beyond the offer stay at list price');

drop table requested_items;
create temporary table placed_plain on commit drop as
  select pg_temp.place('95000000-0000-0000-0000-0000000000b3', 1, '{}') as id;
select is((select total_minor from public.orders where id = (select id from placed_plain)), 4000::bigint, 'without an offer the order uses list prices');

drop table requested_items;
select throws_ok($$select pg_temp.place('95000000-0000-0000-0000-0000000000b4', 1, array['a5000000-0000-0000-0000-000000000002']::uuid[])$$, '22023', 'BUNDLE_UNAVAILABLE', 'a stopped offer is rejected');
select throws_ok($$select order_id from public.create_doctor_order('95000000-0000-0000-0000-0000000000b5', 'NEW_SYP', 'عنوان توصيل صالح', 'طبيب اختبار', '+963900000000', null, jsonb_build_array(jsonb_build_object('product_id', (select id from picked where n = 1), 'quantity', 1)), null, null, null, array['a5000000-0000-0000-0000-000000000001']::uuid[])$$, '22023', 'BUNDLE_ITEMS_MISSING', 'an offer needs all of its products in the order');
select ok(not has_function_privilege('anon', 'public.create_doctor_order(uuid,public.currency_code,text,text,text,text,jsonb,double precision,double precision,text,uuid[])', 'EXECUTE'), 'visitors cannot place offer orders');

select * from finish();
rollback;
