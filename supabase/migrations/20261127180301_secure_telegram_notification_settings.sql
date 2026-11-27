-- Private-schema settings are accessible only through the staff-checked RPCs.
-- Enable RLS as defense in depth; no direct API policies are intentionally granted.
alter table private.telegram_notification_settings enable row level security;
