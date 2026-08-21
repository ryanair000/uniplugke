-- Per-member, per-subscription access details for UniPlug VIP.
-- Secrets remain in the private schema and are exposed only through guarded RPCs.

create table if not exists private.uniplug_client_service_access (
  client_subscription_id uuid primary key references public.client_subscriptions(id) on delete cascade,
  account_email text,
  account_password text,
  profile_name text,
  profile_pin text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uniplug_client_service_access_email_len check (account_email is null or char_length(account_email) <= 320),
  constraint uniplug_client_service_access_password_len check (account_password is null or char_length(account_password) <= 2048),
  constraint uniplug_client_service_access_profile_len check (profile_name is null or char_length(profile_name) <= 160),
  constraint uniplug_client_service_access_pin_len check (profile_pin is null or char_length(profile_pin) <= 128)
);

create table if not exists private.uniplug_client_service_access_log (
  id uuid primary key default gen_random_uuid(),
  client_subscription_id uuid not null references public.client_subscriptions(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('admin_read', 'admin_update', 'member_read')),
  created_at timestamptz not null default now()
);

revoke all on private.uniplug_client_service_access from public, anon, authenticated;
revoke all on private.uniplug_client_service_access_log from public, anon, authenticated;

create or replace function private.uniplug_is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.uniplug_profiles profile
    where profile.user_id = auth.uid()
      and profile.role = 'admin'
      and profile.status = 'active'
  );
$$;

revoke all on function private.uniplug_is_active_admin() from public, anon, authenticated;

create or replace function public.uniplug_admin_get_client_service_access(p_client_subscription_id uuid)
returns table(
  service_name text,
  account_email text,
  account_password text,
  profile_name text,
  profile_pin text
)
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private', 'vault'
as $$
declare
  v_account_id uuid;
  v_slot_id uuid;
  v_account_reference text;
  v_service_name text;
  v_base_email text;
  v_base_password text;
  v_base_profile text;
begin
  if not private.uniplug_is_active_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select
    public.hub_try_uuid(subscription.metadata->>'assigned_account_id'),
    public.hub_try_uuid(subscription.metadata->>'assigned_slot_id'),
    subscription.account_reference,
    coalesce(service.name, subscription.service_identifier, 'Tracked service')
  into v_account_id, v_slot_id, v_account_reference, v_service_name
  from public.client_subscriptions subscription
  left join public.client_services service on service.id = subscription.service_id
  where subscription.id = p_client_subscription_id;

  if not found then
    raise exception 'Subscription not found';
  end if;

  if v_account_id is not null then
    select
      account.account_mail,
      coalesce(secret.decrypted_secret, account.account_password),
      account.profile_name
    into v_base_email, v_base_password, v_base_profile
    from public.accounts account
    left join vault.decrypted_secrets secret on secret.id = account.password_secret_id
    where account.id = v_account_id
    limit 1;
  elsif v_slot_id is not null then
    select slot.account, slot.password, null::text
    into v_base_email, v_base_password, v_base_profile
    from public.slots slot
    where slot.id = v_slot_id
    limit 1;
  end if;

  insert into private.uniplug_client_service_access_log(client_subscription_id, actor_user_id, action)
  values (p_client_subscription_id, auth.uid(), 'admin_read');

  return query
  select
    v_service_name,
    coalesce(access.account_email, v_base_email, v_account_reference),
    coalesce(access.account_password, v_base_password),
    coalesce(access.profile_name, v_base_profile),
    access.profile_pin
  from (select 1) seed
  left join private.uniplug_client_service_access access
    on access.client_subscription_id = p_client_subscription_id;
end;
$$;

revoke all on function public.uniplug_admin_get_client_service_access(uuid) from public, anon;
grant execute on function public.uniplug_admin_get_client_service_access(uuid) to authenticated;

create or replace function public.uniplug_admin_set_client_service_access(
  p_client_subscription_id uuid,
  p_account_email text,
  p_account_password text,
  p_profile_name text,
  p_profile_pin text
)
returns void
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $$
begin
  if not private.uniplug_is_active_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.client_subscriptions where id = p_client_subscription_id) then
    raise exception 'Subscription not found';
  end if;

  if p_account_email is not null and char_length(p_account_email) > 320 then raise exception 'Account email/key is too long'; end if;
  if p_account_password is not null and char_length(p_account_password) > 2048 then raise exception 'Account password is too long'; end if;
  if p_profile_name is not null and char_length(p_profile_name) > 160 then raise exception 'Profile name is too long'; end if;
  if p_profile_pin is not null and char_length(p_profile_pin) > 128 then raise exception 'Profile PIN is too long'; end if;

  insert into private.uniplug_client_service_access(
    client_subscription_id, account_email, account_password, profile_name, profile_pin, updated_by
  ) values (
    p_client_subscription_id,
    nullif(btrim(coalesce(p_account_email, '')), ''),
    nullif(p_account_password, ''),
    nullif(btrim(coalesce(p_profile_name, '')), ''),
    nullif(btrim(coalesce(p_profile_pin, '')), ''),
    auth.uid()
  )
  on conflict (client_subscription_id) do update set
    account_email = excluded.account_email,
    account_password = excluded.account_password,
    profile_name = excluded.profile_name,
    profile_pin = excluded.profile_pin,
    updated_by = auth.uid(),
    updated_at = now();

  insert into private.uniplug_client_service_access_log(client_subscription_id, actor_user_id, action)
  values (p_client_subscription_id, auth.uid(), 'admin_update');
end;
$$;

revoke all on function public.uniplug_admin_set_client_service_access(uuid, text, text, text, text) from public, anon;
grant execute on function public.uniplug_admin_set_client_service_access(uuid, text, text, text, text) to authenticated;

create or replace function public.uniplug_get_client_account_access_v2(p_client_subscription_id uuid)
returns table(
  service_name text,
  account_email text,
  account_password text,
  verification_code text,
  profile_name text,
  profile_pin text
)
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $$
declare
  v_row record;
begin
  select * into v_row
  from private.uniplug_get_client_account_access(p_client_subscription_id)
  limit 1;

  if not found then
    return;
  end if;

  insert into private.uniplug_client_service_access_log(client_subscription_id, actor_user_id, action)
  values (p_client_subscription_id, auth.uid(), 'member_read');

  return query
  select
    v_row.service_name::text,
    coalesce(access.account_email, v_row.account_email)::text,
    coalesce(access.account_password, v_row.account_password)::text,
    v_row.verification_code::text,
    coalesce(access.profile_name, v_row.profile_name)::text,
    access.profile_pin::text
  from (select 1) seed
  left join private.uniplug_client_service_access access
    on access.client_subscription_id = p_client_subscription_id;
end;
$$;

revoke all on function public.uniplug_get_client_account_access_v2(uuid) from public, anon;
grant execute on function public.uniplug_get_client_account_access_v2(uuid) to authenticated;
