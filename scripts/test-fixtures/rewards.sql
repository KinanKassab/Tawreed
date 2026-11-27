begin;
create function pg_temp.check(p_ok boolean,p_message text) returns void language plpgsql as $$ begin if p_ok is distinct from true then raise exception 'FAILED: %',p_message; end if; raise notice 'PASS: %',p_message; end $$;
create function pg_temp.reject(p_sql text,p_expected text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if position(p_expected in sqlerrm)>0 then return; end if;
    raise exception 'Expected %, got %',p_expected,sqlerrm;
  end;
  raise exception 'Expected rejection: %',p_expected;
end; $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('96000000-0000-0000-0000-000000000001','reward-buyer@example.test','{"full_name":"مشتري الاختبار"}'),
 ('96000000-0000-0000-0000-000000000002','reward-owner@example.test','{"full_name":"صاحب الكود"}'),
 ('96000000-0000-0000-0000-000000000003','reward-admin@example.test','{"full_name":"مدير الاختبار"}');
insert into auth.sessions(id,user_id) values ('96000000-0000-0000-0000-0000000000a1','96000000-0000-0000-0000-000000000001'),('96000000-0000-0000-0000-0000000000a2','96000000-0000-0000-0000-000000000002');
insert into public.staff_accounts(user_id,rank) values('96000000-0000-0000-0000-000000000003','owner');
update public.financial_settings set delivery_fee_minor=0,tax_rate_bps=0 where id;
update public.exchange_rates set active=false where active;
insert into public.exchange_rates(base_currency,quote_currency,rate,active) values('USD','NEW_SYP',100,true);
create temporary table picked as select p.id from public.products p join public.product_prices pp on pp.product_id=p.id and pp.currency='USD' and pp.active where p.active order by p.id limit 1;
update public.products set availability='available' where id=(select id from picked);
update public.product_prices set amount_minor=10000 where product_id=(select id from picked) and currency='USD' and active;
select set_config('request.jwt.claims','{"sub":"96000000-0000-0000-0000-000000000002","session_id":"96000000-0000-0000-0000-0000000000a2"}',true);
select public.reward_api('wallet');
select pg_temp.check((select code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$' from public.reward_coupons where owner_id='96000000-0000-0000-0000-000000000002'),'referral code uses the XXXX-XXXX-XXXX format');
create temporary table cart as select jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',(select id from picked),'quantity',1)),
  'bundleIds','[]'::jsonb,'displayCurrency','NEW_SYP','code',(select code from public.reward_coupons where owner_id='96000000-0000-0000-0000-000000000002'),'points',0) as input;
select pg_temp.reject($q$select public.reward_api('quote',(select input from cart))$q$,'COUPON_SELF');
select set_config('request.jwt.claims','{"sub":"96000000-0000-0000-0000-000000000001","session_id":"96000000-0000-0000-0000-0000000000a1"}',true);
select public.reward_api('wallet');
select pg_temp.check((public.reward_api('quote',(select input from cart))#>>'{discount,amountMinor}')::numeric=100,'friend discount is 1%');
select pg_temp.check((public.reward_api('quote',(select input from cart))->>'pointsEarned')::numeric=9.9,'10% points on net USD merchandise, retaining fractions');
select pg_temp.reject($q$select public.reward_api('quote',(select input||'{"points":1}' from cart))$q$,'POINTS_INVALID');
select pg_temp.reject($q$select public.reward_api('tracking')$q$,'STAFF_REQUIRED');
create temporary table request as select input||jsonb_build_object('idempotencyKey','96000000-0000-0000-0000-0000000000b1','deliveryAddress','عنوان توصيل الاختبار','recipientName','اسم المستلم','recipientPhone','+963900000001','expectedQuote',public.reward_api('quote',input)) as input from cart;
select pg_temp.reject($q$select public.reward_api('place',(select input||'{"expectedQuote":{}}' from request))$q$,'REWARDS_PRICE_CHANGED');
create temporary table first_order as select public.reward_api('place',input) as result from request;
select pg_temp.check(public.reward_api('place',(select input from request))=(select result from first_order),'replay returns the same order');
select pg_temp.check(public.reward_api('place',(select input||'{"expectedQuote":{}}' from request))=(select result from first_order),'a refreshed quote does not break an already committed retry');
select pg_temp.check((select count(*) from public.reward_transactions where buyer_id='96000000-0000-0000-0000-000000000001')=1,'replay does not duplicate points or usage');
select pg_temp.reject($q$select public.reward_api('place',(select input||'{"points":5}' from request))$q$,'REWARDS_REQUEST_CHANGED');
select pg_temp.check((select available from public.reward_wallets where user_id='96000000-0000-0000-0000-000000000002')=0,'points unavailable before delivery');
update public.orders set status='delivered' where id=(select (result->>'orderId')::uuid from first_order);
select pg_temp.check((select available from public.reward_wallets where user_id='96000000-0000-0000-0000-000000000002')=0,'delivery alone does not award points');
select set_config('request.jwt.claims','{"sub":"96000000-0000-0000-0000-000000000003"}',true);
select public.reward_api('collect',jsonb_build_object('orderId',(select result->>'orderId' from first_order)));
select public.reward_api('collect',jsonb_build_object('orderId',(select result->>'orderId' from first_order)));
select pg_temp.check((select available from public.reward_wallets where user_id='96000000-0000-0000-0000-000000000002')=9.9,'collection awards points exactly once');
select pg_temp.check(public.reward_api('tracking')->'rows'->0->>'buyerName'='مشتري الاختبار','tracking shows purchaser identity');
select pg_temp.check(public.reward_api('tracking')->'rows'->0->>'ownerName'='صاحب الكود','tracking shows code owner');
select pg_temp.check((public.reward_api('tracking')->'rows'->0->'items'->0->>'quantity')::integer=1,'tracking contains purchased items');
select pg_temp.check(jsonb_array_length(public.reward_api('tracking','{"search":"no-match"}')->'rows')=0,'tracking search filters results');
-- Second use succeeds; third fails; cancellation releases that usage.
select set_config('request.jwt.claims','{"sub":"96000000-0000-0000-0000-000000000001","session_id":"96000000-0000-0000-0000-0000000000a1"}',true);
drop table requested_items;
update request set input=jsonb_set(input,'{idempotencyKey}','"96000000-0000-0000-0000-0000000000b2"')- 'expectedQuote';
create temporary table second_order as select public.reward_api('place',input) as result from request;
select pg_temp.reject($q$select public.reward_api('quote',(select input from cart))$q$,'COUPON_LIMIT');
update public.orders set status='cancelled' where id=(select (result->>'orderId')::uuid from second_order);
select pg_temp.check((public.reward_api('quote',(select input from cart))->>'usesRemaining')::integer=1,'cancellation restores a code use');
-- Redeem points from the owner account: 9 points => 0.9%, not nine dollars.
select set_config('request.jwt.claims','{"sub":"96000000-0000-0000-0000-000000000002","session_id":"96000000-0000-0000-0000-0000000000a2"}',true);
update cart set input=input||'{"code":"","points":9}'::jsonb;
select pg_temp.check((public.reward_api('quote',(select input from cart))#>>'{discount,amountMinor}')::numeric=90,'each point buys 0.1 percent');
select pg_temp.reject($q$select public.reward_api('quote',(select input||'{"points":20}' from cart))$q$,'POINTS_INVALID');
drop table requested_items;
create temporary table redemption as select public.reward_api('place',input||jsonb_build_object('idempotencyKey','96000000-0000-0000-0000-0000000000c1','deliveryAddress','عنوان صالح للتوصيل','recipientName','صاحب النقاط','recipientPhone','+963900000002')) as result from cart;
select pg_temp.check((select available from public.reward_wallets where user_id='96000000-0000-0000-0000-000000000002')=0.9,'points reserved atomically at checkout');
update public.orders set status='cancelled' where id=(select (result->>'orderId')::uuid from redemption);
update public.orders set status='cancelled' where id=(select (result->>'orderId')::uuid from redemption);
select pg_temp.check((select available from public.reward_wallets where user_id='96000000-0000-0000-0000-000000000002')=9.9,'cancellation restores spent points once');
-- Campaign discounts and bundle exclusion.
select set_config('request.jwt.claims','{"sub":"96000000-0000-0000-0000-000000000003"}',true);
select public.reward_api('save_coupon','{"code":"FIXED5","type":"fixed","value":5,"active":true,"expiresAt":null,"maxUsesPerUser":2}');
select public.reward_api('save_coupon','{"code":"PERCENT5","type":"percent","value":5,"active":true,"expiresAt":null,"maxUsesPerUser":2}');
select set_config('request.jwt.claims','{"sub":"96000000-0000-0000-0000-000000000001","session_id":"96000000-0000-0000-0000-0000000000a1"}',true);
update cart set input=input||'{"code":"FIXED5","points":0}'::jsonb;
select pg_temp.check((public.reward_api('quote',(select input from cart))#>>'{discount,amountMinor}')::numeric=500,'fixed-dollar coupon converted correctly');
select pg_temp.check((public.reward_api('quote',(select input||'{"code":"PERCENT5"}' from cart))#>>'{discount,amountMinor}')::numeric=500,'percentage campaign works');
select pg_temp.check((public.reward_api('quote',(select input from cart))->>'pointsEarned')::numeric=0,'campaigns do not award referral points');
insert into public.promo_banners(id,title_ar,image_object_key,bundle_price_usd_minor,bundle_items) select 'a6000000-0000-0000-0000-000000000001','عرض','banners/test.webp',8000,jsonb_build_array(jsonb_build_object('product_id',(select id from picked),'quantity',1));
update cart set input=input||'{"bundleIds":["a6000000-0000-0000-0000-000000000001"]}';
select pg_temp.reject($q$select public.reward_api('quote',(select input from cart))$q$,'REWARDS_NO_ELIGIBLE_ITEMS');
-- Real authenticated-role boundary, including hidden buyer history.
set local role authenticated;
select pg_temp.check((select count(*) from public.reward_transactions)=0,'doctors cannot directly read tracking records');
select pg_temp.reject($q$select public.reward_api('tracking')$q$,'STAFF_REQUIRED');
select pg_temp.reject($q$update public.reward_wallets set available=10000$q$,'permission denied');
select pg_temp.reject($q$select public.reward_api('save_settings','{"friendDiscountPercent":99,"maxPointsDiscountPercent":100}')$q$,'STAFF_REQUIRED');
reset role;
select pg_temp.check(not has_function_privilege('anon','public.reward_api(text,jsonb)','EXECUTE'),'anonymous users cannot call rewards API');
rollback;
