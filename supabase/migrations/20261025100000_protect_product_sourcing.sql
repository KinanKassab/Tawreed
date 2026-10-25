create table public.product_sourcing_suggestions (
  product_id uuid primary key references public.products(id) on delete cascade,
  suggested_brands text[] not null default '{}',
  catalog_priority text not null,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_sourcing_suggestions enable row level security;
revoke all on public.product_sourcing_suggestions from public, anon, authenticated;
grant select on public.product_sourcing_suggestions to service_role;

alter table public.products drop column suggested_brands, drop column catalog_priority;

comment on table public.product_sourcing_suggestions is
  'Internal, unverified sourcing candidates. Never exposed to Doctor clients.';
