-- Surface the assigned LokiMax profile name and PIN on UniPlug member access pages.
-- Slot-backed subscriptions keep these values in subscription_service_items metadata;
-- account-backed subscriptions keep them on accounts. Manual UniPlug overrides remain
-- highest priority and stay encrypted in Vault.

begin;

create or replace function private.uniplug_resolve_subscription_profile(
  p_client_subscription_id uuid,
  p_account_email text default null
)
returns table(profile_name text, profile_pin text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_slot_id uuid;
  v_profile_name text;
  v_profile_pin text;
  v_candidate_name text;
  v_candidate_pin text;
begin
  select
    public.hub_try_uuid(subscription.metadata->>'assigned_account_id'),
    public.hub_try_uuid(subscription.metadata->>'assigned_slot_id')
  into v_account_id, v_slot_id
  from public.client_subscriptions subscription
  where subscription.id = p_client_subscription_id;

  if not found then
    return;
  end if;

  if v_account_id is not null then
    select
      nullif(btrim(account.profile_name), ''),
      nullif(btrim(account.profile_pin), '')
    into v_profile_name, v_profile_pin
    from public.accounts account
    where account.id = v_account_id
    limit 1;
  end if;

  if v_slot_id is not null then
    select
      nullif(btrim(item.metadata->>'profile_name'), ''),
      nullif(btrim(item.metadata->>'profile_pin'), '')
    into v_candidate_name, v_candidate_pin
    from public.subscription_service_items item
    where item.slot_id = v_slot_id
    order by item.updated_at desc nulls last
    limit 1;

    v_profile_name := coalesce(v_profile_name, v_candidate_name);
    v_profile_pin := coalesce(v_profile_pin, v_candidate_pin);

    -- History is a fallback for older slot records whose normalized service item
    -- has not yet been populated, while still being scoped to this subscription.
    if v_profile_name is null or v_profile_pin is null then
      select
        nullif(btrim(history.snapshot->>'profile_name'), ''),
        nullif(btrim(history.snapshot->>'profile_pin'), '')
      into v_candidate_name, v_candidate_pin
      from public.client_service_history history
      where history.canonical_subscription_id = p_client_subscription_id
        and history.slot_id = v_slot_id
      order by history.recorded_at desc
      limit 1;

      v_profile_name := coalesce(v_profile_name, v_candidate_name);
      v_profile_pin := coalesce(v_profile_pin, v_candidate_pin);
    end if;
  end if;

  -- Legacy/fallback subscriptions can resolve an account by the email already
  -- authorized by the guarded base access function.
  if (v_profile_name is null or v_profile_pin is null)
     and nullif(btrim(p_account_email), '') is not null then
    select
      nullif(btrim(account.profile_name), ''),
      nullif(btrim(account.profile_pin), '')
    into v_candidate_name, v_candidate_pin
    from public.accounts account
    where lower(account.account_mail) = lower(p_account_email)
    limit 1;

    v_profile_name := coalesce(v_profile_name, v_candidate_name);
    v_profile_pin := coalesce(v_profile_pin, v_candidate_pin);
  end if;

  return query select v_profile_name, v_profile_pin;
end;
$$;

revoke all on function private.uniplug_resolve_subscription_profile(uuid, text)
from public, anon, authenticated;
grant execute on function private.uniplug_resolve_subscription_profile(uuid, text) to service_role;

create or replace function public.uniplug_admin_get_client_service_access(p_client_subscription_id uuid)
returns table(service_name text, account_email text, account_password text, profile_name text, profile_pin text)
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
  v_base_pin text;
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
      coalesce(secret.decrypted_secret, account.account_password)
    into v_base_email, v_base_password
    from public.accounts account
    left join vault.decrypted_secrets secret on secret.id = account.password_secret_id
    where account.id = v_account_id
    limit 1;
  elsif v_slot_id is not null then
    select slot.account, slot.password
    into v_base_email, v_base_password
    from public.slots slot
    where slot.id = v_slot_id
    limit 1;
  end if;

  if v_base_email is null and nullif(btrim(v_account_reference), '') is not null then
    select
      account.account_mail,
      coalesce(secret.decrypted_secret, account.account_password)
    into v_base_email, v_base_password
    from public.accounts account
    left join vault.decrypted_secrets secret on secret.id = account.password_secret_id
    where lower(account.account_mail) = lower(v_account_reference)
    limit 1;
  end if;

  select resolved.profile_name, resolved.profile_pin
  into v_base_profile, v_base_pin
  from private.uniplug_resolve_subscription_profile(
    p_client_subscription_id,
    coalesce(v_base_email, v_account_reference)
  ) resolved
  limit 1;

  insert into private.uniplug_client_service_access_log(client_subscription_id, actor_user_id, action)
  values (p_client_subscription_id, auth.uid(), 'admin_read');

  return query
  select
    v_service_name,
    coalesce(access_vault.decrypted_secret::jsonb ->> 'account_email', access.account_email, v_base_email, v_account_reference),
    coalesce(access_vault.decrypted_secret::jsonb ->> 'account_password', access.account_password, v_base_password),
    coalesce(access_vault.decrypted_secret::jsonb ->> 'profile_name', access.profile_name, v_base_profile),
    coalesce(access_vault.decrypted_secret::jsonb ->> 'profile_pin', access.profile_pin, v_base_pin)
  from (select 1) seed
  left join private.uniplug_client_service_access access
    on access.client_subscription_id = p_client_subscription_id
  left join vault.decrypted_secrets access_vault on access_vault.id = access.vault_secret_id;
end;
$$;

revoke all on function public.uniplug_admin_get_client_service_access(uuid) from public, anon;
grant execute on function public.uniplug_admin_get_client_service_access(uuid) to authenticated;

create or replace function public.uniplug_get_client_account_access_v2(p_client_subscription_id uuid)
returns table(service_name text, account_email text, account_password text, verification_code text, profile_name text, profile_pin text)
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private', 'vault'
as $$
declare
  v_row record;
  v_base_profile text;
  v_base_pin text;
begin
  -- This existing guarded function verifies that the signed-in member owns the
  -- subscription before any LokiMax profile metadata is resolved below.
  select * into v_row
  from private.uniplug_get_client_account_access(p_client_subscription_id)
  limit 1;

  if not found then
    return;
  end if;

  select resolved.profile_name, resolved.profile_pin
  into v_base_profile, v_base_pin
  from private.uniplug_resolve_subscription_profile(
    p_client_subscription_id,
    v_row.account_email::text
  ) resolved
  limit 1;

  insert into private.uniplug_client_service_access_log(client_subscription_id, actor_user_id, action)
  values (p_client_subscription_id, auth.uid(), 'member_read');

  return query
  select
    v_row.service_name::text,
    coalesce(access_vault.decrypted_secret::jsonb ->> 'account_email', access.account_email, v_row.account_email)::text,
    coalesce(access_vault.decrypted_secret::jsonb ->> 'account_password', access.account_password, v_row.account_password)::text,
    v_row.verification_code::text,
    coalesce(
      access_vault.decrypted_secret::jsonb ->> 'profile_name',
      access.profile_name,
      v_base_profile,
      v_row.profile_name
    )::text,
    coalesce(
      access_vault.decrypted_secret::jsonb ->> 'profile_pin',
      access.profile_pin,
      v_base_pin
    )::text
  from (select 1) seed
  left join private.uniplug_client_service_access access
    on access.client_subscription_id = p_client_subscription_id
  left join vault.decrypted_secrets access_vault on access_vault.id = access.vault_secret_id;
end;
$$;

revoke all on function public.uniplug_get_client_account_access_v2(uuid) from public, anon;
grant execute on function public.uniplug_get_client_account_access_v2(uuid) to authenticated;

commit;
