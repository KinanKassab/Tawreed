-- Referral codes are deliberately easy to read, dictate, and enter: XXXX-XXXX-XXXX.
-- Campaign coupons remain unconstrained so Operations can use names such as FIXED5.
alter table public.reward_transactions
  drop constraint if exists reward_transactions_code_fkey;
alter table public.reward_transactions
  add constraint reward_transactions_code_fkey
  foreign key (code) references public.reward_coupons(code) on update cascade;

create or replace function private.ensure_reward_wallet(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  insert into public.reward_wallets(user_id) values(p_user) on conflict do nothing;

  while not exists(select 1 from public.reward_coupons where owner_id=p_user) loop
    v_code := upper(
      substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
      substr(replace(gen_random_uuid()::text, '-', ''), 5, 4) || '-' ||
      substr(replace(gen_random_uuid()::text, '-', ''), 9, 4)
    );
    insert into public.reward_coupons(code, owner_id) values(v_code, p_user) on conflict do nothing;
  end loop;
end;
$$;

-- Upgrade previously generated referral codes without losing their order history.
do $$
declare
  v_old_code text;
  v_new_code text;
begin
  for v_old_code in
    select code from public.reward_coupons
    where owner_id is not null and code !~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'
  loop
    loop
      v_new_code := upper(
        substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
        substr(replace(gen_random_uuid()::text, '-', ''), 5, 4) || '-' ||
        substr(replace(gen_random_uuid()::text, '-', ''), 9, 4)
      );
      exit when not exists(select 1 from public.reward_coupons where code=v_new_code);
    end loop;
    update public.reward_coupons set code=v_new_code where code=v_old_code;
  end loop;
end;
$$;

alter table public.reward_coupons
  add constraint reward_coupons_owner_code_format
  check (owner_id is null or code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$');
