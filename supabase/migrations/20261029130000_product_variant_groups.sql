alter table public.products
  add column if not exists variant_group_key text,
  add column if not exists variant_label_ar text;

create index if not exists products_variant_group_active_idx
  on public.products(variant_group_key, active)
  where variant_group_key is not null;

comment on column public.products.variant_group_key is
  'Stable catalog grouping key. Rows sharing this key are price-bearing variants shown as one Doctor catalog product.';

comment on column public.products.variant_label_ar is
  'Arabic option label shown inside the grouped product. Null for products without variants.';
