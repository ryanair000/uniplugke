-- Remove the legacy forced-password gate from VIP service access permanently.
-- Authentication plus client/subscription ownership remain the authorization boundary.

begin;

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
  v_slot_id uuid;
  v_account_reference text;
  v_service_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select portal.client_id
  into v_client_id
  from public.client_portal_accounts as portal
  where portal.user_id = v_user_id;

  if v_client_id is null then
    raise exception 'A UniPlug portal account was not found';
  end if;

  v_client_id := public.hub_resolve_client_id(v_client_id);

  select
    public.hub_try_uuid(subscription.metadata->>'assigned_account_id'),
    public.hub_try_uuid(subscription.metadata->>'assigned_slot_id'),
    subscription.account_reference,
    coalesce(service.name, subscription.service_identifier, 'Tracked service')
  into v_account_id, v_slot_id, v_account_reference, v_service_name
  from public.client_subscriptions as subscription
  left join public.client_services as service on service.id = subscription.service_id
  where subscription.id = p_client_subscription_id
    and public.hub_resolve_client_id(subscription.client_id) = v_client_id
    and (subscription.status in ('active', 'due_soon', 'trial')
      or public.uniplug_has_member_access_grant(p_client_subscription_id))
    and coalesce(subscription.metadata->>'portal_hidden', 'false') <> 'true';

  if not found then
    raise exception 'An active tracked service was not found';
  end if;

  if v_account_id is not null then
    return query
    select
      v_service_name,
      account.account_mail,
      coalesce(secret.decrypted_secret, account.account_password),
      account.verification_code,
      account.profile_name
    from public.accounts as account
    left join vault.decrypted_secrets as secret on secret.id = account.password_secret_id
    where account.id = v_account_id
    limit 1;
    if found then return; end if;
  end if;

  if v_slot_id is not null then
    return query
    select
      v_service_name,
      slot.account,
      slot.password,
      null::text,
      null::text
    from public.slots as slot
    where slot.id = v_slot_id
      and slot.status = 'active'
    limit 1;
    if found then return; end if;
  end if;

  return query
  select
    v_service_name,
    account.account_mail,
    coalesce(secret.decrypted_secret, account.account_password),
    account.verification_code,
    account.profile_name
  from public.accounts as account
  left join vault.decrypted_secrets as secret on secret.id = account.password_secret_id
  where lower(account.account_mail) = lower(v_account_reference)
  limit 1;
end;
$$;

revoke all on function private.uniplug_get_client_account_access(uuid) from public, anon;
grant execute on function private.uniplug_get_client_account_access(uuid) to authenticated, service_role;

update public.client_portal_accounts
set must_change_password = false,
    updated_at = now()
where must_change_password is true;

alter table public.client_portal_accounts
  alter column must_change_password set default false;

create or replace function private.uniplug_disable_forced_password_rotation()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  new.must_change_password := false;
  return new;
end;
$$;

drop trigger if exists uniplug_disable_forced_password_rotation on public.client_portal_accounts;
create trigger uniplug_disable_forced_password_rotation
before insert or update of must_change_password
on public.client_portal_accounts
for each row
execute function private.uniplug_disable_forced_password_rotation();

commit;
