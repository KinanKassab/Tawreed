-- Points: 10% of net USD merchandise dollars. One point buys 0.1% off
-- eligible merchandise. Bundle quantities never receive an extra discount.
create table public.reward_settings (
  id boolean primary key default true check (id),
  friend_discount_percent numeric(6,3) not null default 1 check (friend_discount_percent between 0 and 100),
  max_points_discount_percent numeric(6,3) not null default 30 check (max_points_discount_percent between 0 and 100)
);
insert into public.reward_settings(id) values (true);
create table public.reward_coupons (
  code text primary key check (code ~ '^[A-Z0-9-]{4,40}$'),
  owner_id uuid unique references public.profiles(id),
  discount_type text not null default 'percent' check (discount_type in ('percent', 'fixed')),
  value numeric(14,3) not null default 0 check (value >= 0 and (discount_type <> 'percent' or value <= 100)),
  active boolean not null default true,
  expires_at timestamptz,
  max_uses_per_user integer not null default 2 check (max_uses_per_user between 1 and 1000),
  created_at timestamptz not null default now(),
  check (owner_id is null or (discount_type = 'percent' and max_uses_per_user = 2))
);
create table public.reward_wallets (
  user_id uuid primary key references public.profiles(id),
  available numeric(18,3) not null default 0 check (available >= 0)
);
alter table public.orders
  add column discount_minor bigint not null default 0 check (discount_minor >= 0),
  add column base_discount_minor bigint not null default 0 check (base_discount_minor >= 0),
  add column reward_request jsonb,
  add column payment_collected_at timestamptz;
create table public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  buyer_id uuid not null references public.profiles(id),
  owner_id uuid references public.profiles(id),
  code text references public.reward_coupons(code) on update cascade,
  buyer_name text not null,
  buyer_phone text not null,
  owner_name text,
  kind text not null check (kind in ('friend','campaign','points')),
  points_earned numeric(18,3) not null default 0 check (points_earned >= 0),
  points_spent numeric(18,3) not null default 0 check (points_spent >= 0),
  state text not null default 'pending' check (state in ('pending','available','cancelled')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index reward_transactions_buyer_code_idx on public.reward_transactions(buyer_id, code, state);
create index reward_transactions_owner_idx on public.reward_transactions(owner_id, created_at desc);
create index reward_transactions_code_idx on public.reward_transactions(code);
create index reward_transactions_created_idx on public.reward_transactions(created_at desc, id);

alter table public.reward_settings enable row level security;
alter table public.reward_coupons enable row level security;
alter table public.reward_wallets enable row level security;
alter table public.reward_transactions enable row level security;
-- No direct mutation grants. All writes run through guarded private functions.
revoke all on public.reward_settings, public.reward_coupons, public.reward_wallets, public.reward_transactions from anon, authenticated;
grant select on public.reward_settings, public.reward_coupons, public.reward_wallets, public.reward_transactions to authenticated;
grant select,insert,update,delete on public.reward_settings, public.reward_coupons, public.reward_wallets, public.reward_transactions to service_role;
create policy reward_settings_read on public.reward_settings for select to authenticated using (true);
create policy reward_coupons_read on public.reward_coupons for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.has_staff_rank('operations_manager')));
create policy reward_wallets_read on public.reward_wallets for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_staff_rank('operations_manager')));
-- Referral owners get a restricted history from the API, never buyer identities/items.
create policy reward_transactions_staff on public.reward_transactions for select to authenticated
  using ((select private.has_staff_rank('operations_manager')));

create function private.ensure_reward_wallet(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.reward_wallets(user_id) values(p_user) on conflict do nothing;
  -- Readable shareable codes, with collision retry and no exposure of account UUIDs.
  while not exists(select 1 from public.reward_coupons where owner_id=p_user) loop
    insert into public.reward_coupons(code, owner_id)
      values(
        upper(
          substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
          substr(replace(gen_random_uuid()::text, '-', ''), 5, 4) || '-' ||
          substr(replace(gen_random_uuid()::text, '-', ''), 9, 4)
        ),
        p_user
      ) on conflict do nothing;
  end loop;
end;
$$;
revoke all on function private.ensure_reward_wallet(uuid) from public, anon, authenticated;

create function private.reward_quote(p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_currency public.currency_code := (p_input->>'displayCurrency')::public.currency_code;
  v_points numeric := coalesce((p_input->>'points')::numeric,0);
  v_code text := nullif(upper(trim(p_input->>'code')),'');
  v_settings public.reward_settings%rowtype;
  v_coupon public.reward_coupons%rowtype;
  v_row record;
  v_bundle record;
  v_item record;
  v_requested jsonb := '{}';
  v_reserved jsonb := '{}';
  v_base bigint := 0; v_display bigint := 0;
  v_eligible_base bigint; v_eligible_display bigint;
  v_bundle_base bigint := 0; v_bundle_display bigint := 0;
  v_unit_base bigint; v_unit_display bigint;
  v_discount_base bigint := 0; v_discount_display bigint := 0;
  v_ratio numeric := 0; v_rate numeric := 1;
  v_decimals integer; v_delivery bigint; v_delivery_display bigint; v_tax_bps integer;
  v_tax bigint; v_tax_display bigint; v_available numeric; v_uses integer; v_remaining integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=v_user) then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  select * into v_settings from public.reward_settings where id;
  select available into v_available from public.reward_wallets where user_id=v_user;
  if v_points < 0 or v_points::text in ('NaN','Infinity','-Infinity') or v_points <> trunc(v_points,3)
     or v_points > coalesce(v_available,0) or v_points / 10 > v_settings.max_points_discount_percent then
    raise exception 'POINTS_INVALID' using errcode='22023';
  end if;
  if v_code is not null and v_points > 0 then raise exception 'REWARDS_EXCLUSIVE' using errcode='22023'; end if;
  if jsonb_typeof(p_input->'items') <> 'array' or coalesce(jsonb_array_length(p_input->'items'),0) not between 1 and 100 then
    raise exception 'INVALID_ITEMS' using errcode='22023';
  end if;
  select decimal_places into v_decimals from public.currency_settings where code=v_currency and enabled;
  if v_decimals is null or not exists(select 1 from public.currency_settings where code='USD' and is_base and enabled) then
    raise exception 'CURRENCY_NOT_CONFIGURED';
  end if;
  if v_currency <> 'USD' then
    select rate into v_rate from public.exchange_rates where base_currency='USD' and quote_currency=v_currency and active order by effective_at desc limit 1 for share;
    if v_rate is null then raise exception 'EXCHANGE_RATE_NOT_CONFIGURED'; end if;
  end if;
  for v_row in select x."productId" as product_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_input->'items') x("productId" uuid, quantity integer) group by x."productId"
  loop
    if v_row.product_id is null or v_row.quantity is null or v_row.quantity not between 1 and 999 then raise exception 'INVALID_QUANTITY'; end if;
    select pp.amount_minor into v_unit_base from public.products p join public.product_prices pp on pp.product_id=p.id
      where p.id=v_row.product_id and p.active and p.availability <> 'unavailable' and pp.currency='USD' and pp.active for share of p,pp;
    if v_unit_base is null then raise exception 'PRODUCT_UNAVAILABLE_OR_UNPRICED'; end if;
    v_unit_display := case when v_currency='NEW_SYP' then ceil(v_unit_base/100.0*v_rate/5)*5 else round(v_unit_base/100.0*v_rate*power(10::numeric,v_decimals)) end;
    v_base := v_base + v_unit_base*v_row.quantity;
    v_display := v_display + v_unit_display*v_row.quantity;
    v_requested := jsonb_set(v_requested,array[v_row.product_id::text],to_jsonb(v_row.quantity));
  end loop;
  if coalesce(jsonb_array_length(p_input->'bundleIds'),0)>20 then raise exception 'INVALID_BUNDLES'; end if;
  for v_bundle in select distinct value::uuid as id from jsonb_array_elements_text(coalesce(p_input->'bundleIds','[]')) loop
    select * into v_row from public.promo_banners where id=v_bundle.id and active and (expires_at is null or expires_at>now()) and bundle_price_usd_minor is not null for share;
    if not found or jsonb_typeof(v_row.bundle_items)<>'array' or jsonb_array_length(v_row.bundle_items)=0 then raise exception 'BUNDLE_UNAVAILABLE'; end if;
    for v_item in select x.product_id,sum(x.quantity)::integer as quantity from jsonb_to_recordset(v_row.bundle_items) x(product_id uuid,quantity integer) group by x.product_id loop
      v_reserved := jsonb_set(v_reserved,array[v_item.product_id::text],to_jsonb(coalesce((v_reserved->>v_item.product_id::text)::integer,0)+v_item.quantity));
      if coalesce((v_requested->>v_item.product_id::text)::integer,0)<(v_reserved->>v_item.product_id::text)::integer then raise exception 'BUNDLE_ITEMS_MISSING'; end if;
      select amount_minor into v_unit_base from public.product_prices where product_id=v_item.product_id and currency='USD' and active;
      v_unit_display := case when v_currency='NEW_SYP' then ceil(v_unit_base/100.0*v_rate/5)*5 else round(v_unit_base/100.0*v_rate*power(10::numeric,v_decimals)) end;
      v_base := v_base-v_unit_base*v_item.quantity;
      v_display := v_display-v_unit_display*v_item.quantity;
    end loop;
    v_bundle_base := v_bundle_base+v_row.bundle_price_usd_minor;
    v_bundle_display := v_bundle_display+case when v_currency='NEW_SYP' then ceil(v_row.bundle_price_usd_minor/100.0*v_rate/5)*5 else round(v_row.bundle_price_usd_minor/100.0*v_rate*power(10::numeric,v_decimals)) end;
  end loop;
  v_eligible_base := v_base; v_eligible_display := v_display;
  v_base := v_base+v_bundle_base; v_display := v_display+v_bundle_display;
  if v_code is not null then
    select * into v_coupon from public.reward_coupons where code=v_code and active and (expires_at is null or expires_at>now());
    if not found then raise exception 'COUPON_INVALID' using errcode='22023'; end if;
    if v_coupon.owner_id=v_user then raise exception 'COUPON_SELF' using errcode='22023'; end if;
    select count(*) into v_uses from public.reward_transactions where buyer_id=v_user and code=v_code and state<>'cancelled';
    if v_uses>=v_coupon.max_uses_per_user then raise exception 'COUPON_LIMIT' using errcode='22023'; end if;
    v_remaining := v_coupon.max_uses_per_user-v_uses;
    if v_coupon.owner_id is not null then v_ratio := v_settings.friend_discount_percent/100;
    elsif v_coupon.discount_type='percent' then v_ratio := v_coupon.value/100;
    else v_ratio := least(1,v_coupon.value*100/greatest(v_eligible_base,1)); end if;
  elsif v_points>0 then v_ratio:=v_points/1000; end if;
  if (v_code is not null or v_points>0) and v_eligible_base<=0 then raise exception 'REWARDS_NO_ELIGIBLE_ITEMS' using errcode='22023'; end if;
  v_discount_base := round(v_eligible_base*v_ratio);
  v_discount_display := round(v_eligible_display*v_ratio);
  select delivery_fee_minor,tax_rate_bps into v_delivery,v_tax_bps from public.financial_settings where id for share;
  v_tax := round((v_base-v_discount_base)*v_tax_bps/10000.0);
  v_delivery_display := case when v_currency='NEW_SYP' then ceil(v_delivery/100.0*v_rate/5)*5 else round(v_delivery/100.0*v_rate*power(10::numeric,v_decimals)) end;
  v_tax_display := case when v_currency='NEW_SYP' then ceil(v_tax/100.0*v_rate/5)*5 else round(v_tax/100.0*v_rate*power(10::numeric,v_decimals)) end;
  return jsonb_build_object('subtotal',jsonb_build_object('amountMinor',v_display,'currency',v_currency,'decimalPlaces',v_decimals),
    'discount',jsonb_build_object('amountMinor',v_discount_display,'currency',v_currency,'decimalPlaces',v_decimals),
    'delivery',jsonb_build_object('amountMinor',v_delivery_display,'currency',v_currency,'decimalPlaces',v_decimals),
    'tax',jsonb_build_object('amountMinor',v_tax_display,'currency',v_currency,'decimalPlaces',v_decimals),
    'total',jsonb_build_object('amountMinor',v_display-v_discount_display+v_delivery_display+v_tax_display,'currency',v_currency,'decimalPlaces',v_decimals),
    'points',v_points,'pointsEarned',case when v_coupon.owner_id is not null then (v_base-v_discount_base)/1000.0 else 0 end,
    'usesRemaining',v_remaining,'baseSubtotal',v_base,'baseDiscount',v_discount_base,'baseTax',v_tax);
end;
$$;
revoke all on function private.reward_quote(jsonb) from public,anon,authenticated;

create function private.reward_api(p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid:=auth.uid(); v_result jsonb; v_code text; v_owner uuid;
  v_order public.orders%rowtype; v_quote jsonb; v_order_id uuid; v_number text;
  v_wallet numeric; v_settings public.reward_settings%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=v_user) then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
  if p_action in ('tracking','settings','save_settings','coupons','save_coupon','collect') then
    if not private.has_staff_rank('operations_manager') then raise exception 'STAFF_REQUIRED' using errcode='42501'; end if;
    if p_action in ('save_settings','save_coupon') and not private.has_staff_rank('admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  end if;
  if p_action='settings' then
    select jsonb_build_object('friendDiscountPercent',friend_discount_percent,'maxPointsDiscountPercent',max_points_discount_percent) into v_result from public.reward_settings where id;
    return v_result;
  elsif p_action='save_settings' then
    update public.reward_settings set friend_discount_percent=(p_input->>'friendDiscountPercent')::numeric,max_points_discount_percent=(p_input->>'maxPointsDiscountPercent')::numeric where id;
    return '{}'::jsonb;
  elsif p_action='coupons' then
    select coalesce(jsonb_agg(jsonb_build_object('code',code,'type',discount_type,'value',value,'active',active,'expiresAt',expires_at,'maxUsesPerUser',max_uses_per_user) order by created_at desc),'[]') into v_result from public.reward_coupons where owner_id is null;
    return v_result;
  elsif p_action='save_coupon' then
    insert into public.reward_coupons(code,discount_type,value,active,expires_at,max_uses_per_user)
      values(upper(trim(p_input->>'code')),p_input->>'type',(p_input->>'value')::numeric,(p_input->>'active')::boolean,(p_input->>'expiresAt')::timestamptz,(p_input->>'maxUsesPerUser')::integer)
      on conflict(code) do update set discount_type=excluded.discount_type,value=excluded.value,active=excluded.active,expires_at=excluded.expires_at,max_uses_per_user=excluded.max_uses_per_user where public.reward_coupons.owner_id is null;
    if not found then raise exception 'COUPON_INVALID'; end if;
    return '{}'::jsonb;
  elsif p_action='collect' then
    update public.orders set payment_collected_at=coalesce(payment_collected_at,now()) where id=(p_input->>'orderId')::uuid and status='delivered';
    if not found then raise exception 'PAYMENT_NOT_DELIVERED'; end if;
    return '{}'::jsonb;
  elsif p_action='tracking' then
    select jsonb_build_object('rows',coalesce(jsonb_agg(r.payload order by r.created_at desc,r.id),'[]'),'hasMore',count(*)>50) into v_result
    from (
      select t.id,t.created_at,jsonb_build_object('id',t.id,'orderId',o.id,'orderNumber',o.order_number,'createdAt',t.created_at,
        'buyerName',t.buyer_name,'buyerPhone',t.buyer_phone,'ownerName',t.owner_name,'code',t.code,'kind',t.kind,'status',o.status,'rewardState',t.state,
        'pointsEarned',t.points_earned,'pointsSpent',t.points_spent,'collectedAt',o.payment_collected_at,
        'discount',jsonb_build_object('amountMinor',o.discount_minor,'currency',o.currency,'decimalPlaces',o.currency_decimal_places),
        'total',jsonb_build_object('amountMinor',o.total_minor,'currency',o.currency,'decimalPlaces',o.currency_decimal_places),
        'items',(select coalesce(jsonb_agg(jsonb_build_object('name',i.name_ar_snapshot,'sku',i.sku_snapshot,'quantity',i.quantity,
          'total',jsonb_build_object('amountMinor',i.line_total_minor,'currency',i.currency,'decimalPlaces',i.currency_decimal_places)) order by i.id),'[]') from public.order_items i where i.order_id=o.id)) as payload
      from public.reward_transactions t join public.orders o on o.id=t.order_id
      where (nullif(p_input->>'search','') is null or concat_ws(' ',t.buyer_name,t.buyer_phone,t.owner_name,t.code,o.order_number) ilike '%'||(p_input->>'search')||'%')
        and (nullif(p_input->>'from','') is null or t.created_at >= (p_input->>'from')::timestamptz)
        and (nullif(p_input->>'to','') is null or t.created_at < (p_input->>'to')::timestamptz)
        and (nullif(p_input->>'status','') is null or o.status::text=p_input->>'status')
      order by t.created_at desc,t.id limit 51 offset greatest(0,coalesce((p_input->>'offset')::integer,0))
    ) r;
    return jsonb_set(v_result,'{rows}',coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(v_result->'rows') with ordinality a(value,n) where n<=50),'[]'));
  end if;
  perform private.ensure_reward_wallet(v_user);
  if p_action='wallet' then
    select jsonb_build_object('code',c.code,'available',w.available,
      'pending',(select coalesce(sum(points_earned),0) from public.reward_transactions where owner_id=v_user and state='pending'),
      'maxPointsDiscountPercent',s.max_points_discount_percent,
      'history',coalesce((select jsonb_agg(h.payload order by h.created_at desc) from (
        select t.created_at,jsonb_build_object('id',t.id,'orderNumber',o.order_number,'points',case when t.owner_id=v_user then t.points_earned else t.points_spent end,
          'kind',case when t.owner_id=v_user then 'earned' else 'spent' end,'state',t.state,'createdAt',t.created_at) as payload
        from public.reward_transactions t join public.orders o on o.id=t.order_id where t.owner_id=v_user or (t.buyer_id=v_user and t.points_spent>0) order by t.created_at desc limit 100
      ) h),'[]')) into v_result
      from public.reward_wallets w join public.reward_coupons c on c.owner_id=w.user_id cross join public.reward_settings s where w.user_id=v_user;
    return v_result;
  elsif p_action='quote' then return private.reward_quote(p_input)-array['baseSubtotal','baseDiscount','baseTax'];
  elsif p_action='place' then
    if not exists(select 1 from auth.sessions where id=nullif(auth.jwt()->>'session_id','')::uuid and user_id=v_user and (not_after is null or not_after>now())) then
      raise exception 'SESSION_INVALID' using errcode='42501';
    end if;
    -- Serialize a buyer's checkout and point spending, including retries.
    select available into v_wallet from public.reward_wallets where user_id=v_user for update;
    select * into v_order from public.orders where user_id=v_user and idempotency_key=(p_input->>'idempotencyKey')::uuid;
    if found then
      -- A refreshed quote can change after a response is lost; the same cart,
      -- delivery and benefit selection must still replay the committed order.
      if (v_order.reward_request-'expectedQuote') is distinct from (p_input-'expectedQuote') then raise exception 'REWARDS_REQUEST_CHANGED' using errcode='22023'; end if;
      return jsonb_build_object('orderId',v_order.id,'orderNumber',v_order.order_number);
    end if;
    v_code:=nullif(upper(trim(p_input->>'code')),'');
    if v_code is not null then
      perform 1 from public.reward_coupons where code=v_code for update;
      select owner_id into v_owner from public.reward_coupons where code=v_code;
    end if;
    v_quote:=private.reward_quote(p_input);
    select r.order_id,r.order_number into v_order_id,v_number from public.create_doctor_order(
      (p_input->>'idempotencyKey')::uuid,(p_input->>'displayCurrency')::public.currency_code,p_input->>'deliveryAddress',p_input->>'recipientName',p_input->>'recipientPhone',p_input->>'deliveryNotes',
      (select jsonb_agg(jsonb_build_object('product_id',x."productId",'quantity',x.quantity)) from jsonb_to_recordset(p_input->'items') x("productId" uuid,quantity integer)),
      (p_input->>'deliveryLatitude')::double precision,(p_input->>'deliveryLongitude')::double precision,p_input->>'deliveryGooglePlaceId',
      array(select value::uuid from jsonb_array_elements_text(coalesce(p_input->'bundleIds','[]')))
    ) r;
    select * into strict v_order from public.orders where id=v_order_id;
    if v_order.base_subtotal_minor<>(v_quote->>'baseSubtotal')::bigint or v_order.subtotal_minor<>(v_quote#>>'{subtotal,amountMinor}')::bigint then raise exception 'REWARDS_PRICE_CHANGED'; end if;
    if p_input->'expectedQuote' is not null and p_input->'expectedQuote' <> jsonb_build_object('subtotal',v_quote->'subtotal','discount',v_quote->'discount','delivery',v_quote->'delivery','tax',v_quote->'tax','total',v_quote->'total','points',v_quote->'points','pointsEarned',v_quote->'pointsEarned','usesRemaining',v_quote->'usesRemaining') then raise exception 'REWARDS_PRICE_CHANGED'; end if;
    update public.orders set reward_request=p_input,discount_minor=(v_quote#>>'{discount,amountMinor}')::bigint,
      base_discount_minor=(v_quote->>'baseDiscount')::bigint,base_tax_minor=(v_quote->>'baseTax')::bigint,tax_minor=(v_quote#>>'{tax,amountMinor}')::bigint,
      base_total_minor=base_subtotal_minor-(v_quote->>'baseDiscount')::bigint+base_delivery_fee_minor+(v_quote->>'baseTax')::bigint,
      total_minor=(v_quote#>>'{total,amountMinor}')::bigint where id=v_order_id;
    if v_code is not null or (v_quote->>'points')::numeric>0 then
      insert into public.reward_transactions(order_id,buyer_id,owner_id,code,buyer_name,buyer_phone,owner_name,kind,points_earned,points_spent)
        values(v_order_id,v_user,v_owner,v_code,(select full_name from public.profiles where id=v_user),p_input->>'recipientPhone',
          (select full_name from public.profiles where id=v_owner),case when v_owner is not null then 'friend' when v_code is not null then 'campaign' else 'points' end,
          (v_quote->>'pointsEarned')::numeric,(v_quote->>'points')::numeric);
      update public.reward_wallets set available=available-(v_quote->>'points')::numeric where user_id=v_user;
    end if;
    return jsonb_build_object('orderId',v_order_id,'orderNumber',v_number);
  end if;
  raise exception 'INVALID_REWARD_ACTION' using errcode='22023';
end;
$$;
revoke all on function private.reward_api(text,jsonb) from public,anon;
grant execute on function private.reward_api(text,jsonb) to authenticated;
create function public.reward_api(p_action text,p_input jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select private.reward_api(p_action,p_input);$$;
revoke all on function public.reward_api(text,jsonb) from public,anon;
grant execute on function public.reward_api(text,jsonb) to authenticated;

create function private.settle_order_rewards() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_reward public.reward_transactions%rowtype;
begin
  select * into v_reward from public.reward_transactions where order_id=new.id for update;
  if not found or v_reward.state<>'pending' then return new; end if;
  if new.status='cancelled' then
    update public.reward_wallets set available=available+v_reward.points_spent where user_id=v_reward.buyer_id;
    update public.reward_transactions set state='cancelled',settled_at=now() where id=v_reward.id;
  elsif new.status='delivered' and new.payment_collected_at is not null then
    if v_reward.owner_id is not null then
      perform private.ensure_reward_wallet(v_reward.owner_id);
      update public.reward_wallets set available=available+v_reward.points_earned where user_id=v_reward.owner_id;
    end if;
    update public.reward_transactions set state='available',settled_at=now() where id=v_reward.id;
  end if;
  return new;
end;
$$;
revoke all on function private.settle_order_rewards() from public,anon,authenticated;
create trigger settle_order_rewards after update of status,payment_collected_at on public.orders for each row execute function private.settle_order_rewards();

create trigger reward_settings_audit after update on public.reward_settings for each row execute function private.capture_audit_event();
create trigger reward_coupons_audit after insert or update on public.reward_coupons for each row execute function private.capture_audit_event();
create trigger reward_transactions_audit after insert or update on public.reward_transactions for each row execute function private.capture_audit_event();
notify pgrst, 'reload schema';
