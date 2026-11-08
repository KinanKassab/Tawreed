alter table public.promo_banners add column bundle_items jsonb;

comment on column public.promo_banners.bundle_items is
  'Optional [{"product_id": uuid, "quantity": int}] added to the cart when the banner is tapped, instead of opening link_url.';
