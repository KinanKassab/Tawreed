-- Existing environments may not have had an operational exchange rate when the
-- preceding migration ran. Use the project's established initial rate, then
-- backfill missing customer-facing SYP prices with upward 50-pound rounding.
insert into public.exchange_rates(base_currency, quote_currency, rate, active)
select 'USD', 'NEW_SYP', 100, true
where not exists (
  select 1 from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'NEW_SYP' and active
);

insert into public.product_prices(product_id, currency, amount_minor, decimal_places)
select usd.product_id, 'NEW_SYP',
  (ceil(((usd.amount_minor / 100.0) * rate.rate) / 50.0) * 50)::bigint,
  0
from public.product_prices usd
cross join lateral (
  select exchange_rates.rate
  from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'NEW_SYP' and active
  order by effective_at desc limit 1
) rate
where usd.currency = 'USD' and usd.active
  and not exists (
    select 1 from public.product_prices syp
    where syp.product_id = usd.product_id and syp.currency = 'NEW_SYP' and syp.active
  );
