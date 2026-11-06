create table public.promo_banners (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null check (char_length(trim(title_ar)) between 1 and 120),
  image_object_key text not null,
  link_url text check (link_url is null or char_length(link_url) <= 2000),
  sort_order integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index promo_banners_sort_order_idx on public.promo_banners (sort_order);

alter table public.promo_banners enable row level security;

create policy promo_banners_read_live_authenticated on public.promo_banners for select to authenticated
using (active and (expires_at is null or expires_at > now()));

create policy promo_banners_read_live_public on public.promo_banners for select to anon
using (active and (expires_at is null or expires_at > now()));

create policy promo_banners_read_by_staff on public.promo_banners for select to authenticated
using ((select private.has_staff_rank('operations_manager')));

create policy promo_banners_insert_by_staff on public.promo_banners for insert to authenticated
with check ((select private.has_staff_rank('operations_manager')));

create policy promo_banners_update_by_staff on public.promo_banners for update to authenticated
using ((select private.has_staff_rank('operations_manager')))
with check ((select private.has_staff_rank('operations_manager')));

create policy promo_banners_delete_by_staff on public.promo_banners for delete to authenticated
using ((select private.has_staff_rank('operations_manager')));

grant select on public.promo_banners to anon, authenticated;
grant insert, update, delete on public.promo_banners to authenticated;

create or replace function public.set_promo_banners_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger promo_banners_set_updated_at
before update on public.promo_banners
for each row execute function public.set_promo_banners_updated_at();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy promo_banners_objects_insert_by_staff
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] = 'banners'
  and (select private.has_staff_rank('operations_manager'))
);
create policy promo_banners_objects_update_by_staff
on storage.objects for update to authenticated
using (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] = 'banners'
  and (select private.has_staff_rank('operations_manager'))
);
create policy promo_banners_objects_delete_by_staff
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] = 'banners'
  and (select private.has_staff_rank('operations_manager'))
);

create or replace function public.operations_reorder_promo_banners(
  p_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.has_staff_rank('operations_manager')) then
    raise exception 'STAFF_REQUIRED' using errcode = '42501';
  end if;
  if exists(
    select 1 from unnest(p_ids) as requested(id)
    where not exists(select 1 from public.promo_banners b where b.id = requested.id)
  ) then
    raise exception 'BANNER_NOT_FOUND' using errcode = '22023';
  end if;

  update public.promo_banners b set sort_order = ordered.position - 1
  from unnest(p_ids) with ordinality as ordered(id, position)
  where b.id = ordered.id and b.sort_order is distinct from ordered.position - 1;
end;
$$;

revoke all on function public.operations_reorder_promo_banners(uuid[]) from public, anon;
grant execute on function public.operations_reorder_promo_banners(uuid[]) to authenticated;
