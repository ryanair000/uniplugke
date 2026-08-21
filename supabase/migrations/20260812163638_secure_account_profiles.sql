-- Add profile-level access details and allow new account passwords to be kept
-- in Supabase Vault. Legacy plaintext inventory remains readable until it is
-- migrated separately.
alter table public.accounts
  add column if not exists profile_name text,
  add column if not exists password_secret_id uuid;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.uniplug_get_client_account_access(
  p_client_subscription_id uuid
)
returns table(
  service_name text,
  account_email text,
  account_password text,
  verification_code text,
  profile_name text
)
language plpgsql
security definer
set search_path = pg_catalog, public, vault, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_account_id uuid;
  v_account_reference text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select portal.client_id into v_client_id
  from public.client_portal_accounts portal
  where portal.user_id = v_user_id
    and portal.must_change_password = false;

  if v_client_id is null then
    raise exception 'Complete password setup first';
  end if;

  select
    case
      when jsonb_typeof(subscription.metadata -> 'assigned_account_id') = 'string'
        then (subscription.metadata ->> 'assigned_account_id')::uuid
      else null
    end,
    subscription.account_reference
  into v_account_id, v_account_reference
  from public.client_subscriptions subscription
  where subscription.id = p_client_subscription_id
    and subscription.client_id = v_client_id
    and subscription.status in ('active', 'due_soon', 'trial');

  if not found then
    raise exception 'An active tracked service was not found';
  end if;

  return query
  select
    coalesce(service.name, subscription.service_identifier, account.service_name, account.game, 'Tracked service'),
    account.account_mail,
    coalesce(secret.decrypted_secret, account.account_password),
    account.verification_code,
    account.profile_name
  from public.client_subscriptions subscription
  left join public.client_services service on service.id = subscription.service_id
  join public.accounts account
    on (v_account_id is not null and account.id = v_account_id)
    or (v_account_id is null and lower(account.account_mail) = lower(v_account_reference))
  left join vault.decrypted_secrets secret on secret.id = account.password_secret_id
  where subscription.id = p_client_subscription_id
  limit 1;
end;
$$;

revoke all on function private.uniplug_get_client_account_access(uuid) from public, anon;
grant execute on function private.uniplug_get_client_account_access(uuid) to authenticated, service_role;

create or replace function public.uniplug_get_client_account_access(
  p_client_subscription_id uuid
)
returns table(
  service_name text,
  account_email text,
  account_password text,
  verification_code text,
  profile_name text
)
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select * from private.uniplug_get_client_account_access(p_client_subscription_id);
$$;

revoke all on function public.uniplug_get_client_account_access(uuid) from public, anon;
grant execute on function public.uniplug_get_client_account_access(uuid) to authenticated;
