alter table public.products
  add column name_en text,
  add column specifications_ar text,
  add column suggested_brands text[] not null default '{}',
  add column catalog_priority text,
  add constraint products_catalog_priority_check check (
    catalog_priority is null or catalog_priority in ('عالية جداً', 'عالية', 'متوسطة', 'توسعية', 'تشغيلية')
  );

comment on column public.products.suggested_brands is
  'Unverified sourcing suggestions from the catalog master; never proof of local availability or an offer to the Doctor.';
