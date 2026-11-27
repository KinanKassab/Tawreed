-- Telegram credentials stay in the non-exposed private schema. Notifications are queued
-- asynchronously with pg_net so Telegram outages never roll back an order or request.
create extension if not exists pg_net;

create table if not exists private.telegram_notification_settings (
  id boolean primary key default true check (id),
  bot_token text,
  chat_id text,
  enabled boolean not null default false,
  notify_new_orders boolean not null default true,
  notify_order_status boolean not null default true,
  notify_catalog_requests boolean not null default true,
  notify_support_requests boolean not null default true,
  updated_at timestamptz not null default now()
);

revoke all on private.telegram_notification_settings from public, anon, authenticated;
insert into private.telegram_notification_settings (id) values (true) on conflict (id) do nothing;

create or replace function public.operations_get_telegram_settings()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v private.telegram_notification_settings%rowtype;
begin
  if not private.has_staff_rank('operations_manager') then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  select * into v from private.telegram_notification_settings where id = true;
  return jsonb_build_object(
    'enabled', v.enabled, 'chatId', coalesce(v.chat_id, ''),
    'tokenConfigured', v.bot_token is not null,
    'tokenHint', case when v.bot_token is null then '' else '••••' || right(v.bot_token, 5) end,
    'notifyNewOrders', v.notify_new_orders, 'notifyOrderStatus', v.notify_order_status,
    'notifyCatalogRequests', v.notify_catalog_requests, 'notifySupportRequests', v.notify_support_requests
  );
end;
$function$;
revoke all on function public.operations_get_telegram_settings() from public, anon;
grant execute on function public.operations_get_telegram_settings() to authenticated;

create or replace function public.operations_save_telegram_settings(
  p_bot_token text, p_chat_id text, p_enabled boolean,
  p_notify_new_orders boolean, p_notify_order_status boolean,
  p_notify_catalog_requests boolean, p_notify_support_requests boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare v_token text := nullif(trim(coalesce(p_bot_token, '')), '');
begin
  if not private.has_staff_rank('operations_manager') then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if length(coalesce(p_chat_id, '')) > 100 then raise exception 'CHAT_ID_INVALID' using errcode = '22023'; end if;
  if v_token is not null and length(v_token) > 256 then raise exception 'BOT_TOKEN_INVALID' using errcode = '22023'; end if;
  update private.telegram_notification_settings set
    bot_token = coalesce(v_token, bot_token), chat_id = nullif(trim(coalesce(p_chat_id, '')), ''),
    enabled = coalesce(p_enabled, false), notify_new_orders = coalesce(p_notify_new_orders, false),
    notify_order_status = coalesce(p_notify_order_status, false), notify_catalog_requests = coalesce(p_notify_catalog_requests, false),
    notify_support_requests = coalesce(p_notify_support_requests, false), updated_at = now()
  where id = true;
end;
$function$;
revoke all on function public.operations_save_telegram_settings(text,text,boolean,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function public.operations_save_telegram_settings(text,text,boolean,boolean,boolean,boolean,boolean) to authenticated;

create or replace function private.telegram_notify(p_event text, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare v private.telegram_notification_settings%rowtype;
begin
  select * into v from private.telegram_notification_settings where id = true;
  if not found or not v.enabled or v.bot_token is null or v.chat_id is null then return; end if;
  if (p_event = 'new_order' and not v.notify_new_orders)
     or (p_event = 'order_status' and not v.notify_order_status)
     or (p_event = 'catalog_request' and not v.notify_catalog_requests)
     or (p_event = 'support_request' and not v.notify_support_requests) then return; end if;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v.bot_token || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('chat_id', v.chat_id, 'text', left(p_message, 4000)),
    timeout_milliseconds := 5000
  );
exception when others then
  -- Never interrupt the business transaction because a notification could not be queued.
  raise warning 'Telegram notification queue failed for event %', p_event;
end;
$function$;
revoke all on function private.telegram_notify(text,text) from public, anon, authenticated;

create or replace function private.notify_new_order_to_telegram()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  perform private.telegram_notify('new_order',
    'طلب جديد على توريد' || E'\n' || 'رقم الطلب: ' || new.order_number || E'\n' ||
    'الاسم: ' || new.recipient_name_snapshot || E'\n' || 'الهاتف: ' || new.recipient_phone_snapshot || E'\n' ||
    'العنوان: ' || new.delivery_address_snapshot || E'\n' ||
    'الإجمالي: ' || (new.total_minor::numeric / power(10, new.currency_decimal_places))::text || ' ' || new.currency::text);
  return new;
end; $function$;

create or replace function private.notify_order_status_to_telegram()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if new.status is distinct from old.status then
    perform private.telegram_notify('order_status', 'تحديث طلب على توريد' || E'\n' || 'رقم الطلب: ' ||
      (select o.order_number from public.orders o where o.id = new.id) || E'\n' || 'الحالة الجديدة: ' || new.status::text);
  end if;
  return new;
end; $function$;

create or replace function private.notify_catalog_request_to_telegram()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  perform private.telegram_notify('catalog_request', 'طلب إضافة منتج جديد' || E'\n' || 'المنتج: ' || new.product_name ||
    case when new.search_query is null then '' else E'\n' || 'كلمات البحث: ' || new.search_query end);
  return new;
end; $function$;

create or replace function private.notify_support_request_to_telegram()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  perform private.telegram_notify('support_request', 'طلب دعم جديد' || E'\n' || 'الموضوع: ' || new.subject || E'\n' || left(new.message, 2500));
  return new;
end; $function$;

drop trigger if exists telegram_new_order on public.orders;
create trigger telegram_new_order after insert on public.orders for each row execute function private.notify_new_order_to_telegram();
drop trigger if exists telegram_order_status on public.orders;
create trigger telegram_order_status after update of status on public.orders for each row execute function private.notify_order_status_to_telegram();
drop trigger if exists telegram_catalog_request on public.catalog_product_requests;
create trigger telegram_catalog_request after insert on public.catalog_product_requests for each row execute function private.notify_catalog_request_to_telegram();
drop trigger if exists telegram_support_request on public.support_cases;
create trigger telegram_support_request after insert on public.support_cases for each row execute function private.notify_support_request_to_telegram();
