-- Encrypt per-client UniPlug service-access overrides with Supabase Vault.
-- This file is self-contained so a fresh environment does not depend on the
-- Chezahub VIP migration history to obtain the helper functions.

create or replace function private.upsert_operational_vault_secret(
  p_existing_id uuid,
  p_name text,
  p_description text,
  p_plaintext text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_existing_id;
begin
  if p_plaintext is null then
    raise exception 'Vault plaintext cannot be null';
  end if;

  if v_id is null then
    select s.id into v_id
    from vault.secrets s
    where s.name = p_name
    order by s.created_at desc
    limit 1;
  end if;

  if v_id is null then
    select vault.create_secret(p_plaintext, p_name, p_description) into v_id;
  else
    perform vault.update_secret(v_id, p_plaintext, p_name, p_description);
  end if;

  return v_id;
end;
$$;
revoke all on function private.upsert_operational_vault_secret(uuid,text,text,text) from public, anon, authenticated;
grant execute on function private.upsert_operational_vault_secret(uuid,text,text,text) to service_role;

create or replace function private.delete_operational_vault_secret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.vault_secret_id is not null then
    delete from vault.secrets where id = old.vault_secret_id;
  end if;
  return old;
end;
$$;
revoke all on function private.delete_operational_vault_secret() from public, anon, authenticated;

alter table private.uniplug_client_service_access
  add column if not exists vault_secret_id uuid;

comment on column private.uniplug_client_service_access.vault_secret_id is
  'Supabase Vault secret containing account_email/password/profile_name/profile_pin JSON.';

do $$
declare
  r record;
  v_id uuid;
begin
  for r in
    select client_subscription_id, account_email, account_password, profile_name, profile_pin, vault_secret_id
    from private.uniplug_client_service_access
    where vault_secret_id is null
       or account_email is not null
       or account_password is not null
       or profile_name is not null
       or profile_pin is not null
  loop
    v_id := private.upsert_operational_vault_secret(
      r.vault_secret_id,
      'uniplug_client_service_access:' || r.client_subscription_id::text,
      'Encrypted UniPlug client service-access override bundle',
      jsonb_build_object(
        'account_email', r.account_email,
        'account_password', r.account_password,
        'profile_name', r.profile_name,
        'profile_pin', r.profile_pin
      )::text
    );

    update private.uniplug_client_service_access
    set vault_secret_id = v_id,
        account_email = null,
        account_password = null,
        profile_name = null,
        profile_pin = null,
        updated_at = now()
    where client_subscription_id = r.client_subscription_id;
  end loop;
end $$;

create or replace function private.encrypt_uniplug_client_service_access_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.vault_secret_id := private.upsert_operational_vault_secret(
    new.vault_secret_id,
    'uniplug_client_service_access:' || new.client_subscription_id::text,
    'Encrypted UniPlug client service-access override bundle',
    jsonb_build_object(
      'account_email', new.account_email,
      'account_password', new.account_password,
      'profile_name', new.profile_name,
      'profile_pin', new.profile_pin
    )::text
  );
  new.account_email := null;
  new.account_password := null;
  new.profile_name := null;
  new.profile_pin := null;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.encrypt_uniplug_client_service_access_row() from public, anon, authenticated;

drop trigger if exists encrypt_uniplug_client_service_access_row on private.uniplug_client_service_access;
create trigger encrypt_uniplug_client_service_access_row
before insert or update of account_email, account_password, profile_name, profile_pin
on private.uniplug_client_service_access
for each row execute function private.encrypt_uniplug_client_service_access_row();

drop trigger if exists delete_uniplug_client_service_access_vault_secret on private.uniplug_client_service_access;
create trigger delete_uniplug_client_service_access_vault_secret
after delete on private.uniplug_client_service_access
for each row execute function private.delete_operational_vault_secret();

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
  if not found then raise exception 'Subscription not found'; end if;

  if v_account_id is not null then
    select account.account_mail,
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

  if v_base_email is null and nullif(btrim(v_account_reference), '') is not null then
    select account.account_mail,
           coalesce(secret.decrypted_secret, account.account_password),
           account.profile_name
    into v_base_email, v_base_password, v_base_profile
    from public.accounts account
    left join vault.decrypted_secrets secret on secret.id = account.password_secret_id
    where lower(account.account_mail) = lower(v_account_reference)
    limit 1;
  end if;

  insert into private.uniplug_client_service_access_log(client_subscription_id, actor_user_id, action)
  values (p_client_subscription_id, auth.uid(), 'admin_read');

  return query
  select
    v_service_name,
    coalesce(access_vault.decrypted_secret::jsonb ->> 'account_email', access.account_email, v_base_email, v_account_reference),
    coalesce(access_vault.decrypted_secret::jsonb ->> 'account_password', access.account_password, v_base_password),
    coalesce(access_vault.decrypted_secret::jsonb ->> 'profile_name', access.profile_name, v_base_profile),
    coalesce(access_vault.decrypted_secret::jsonb ->> 'profile_pin', access.profile_pin)
  from (select 1) seed
  left join private.uniplug_client_service_access access
    on access.client_subscription_id = p_client_subscription_id
  left join vault.decrypted_secrets access_vault on access_vault.id = access.vault_secret_id;
end;
$$;

create or replace function public.uniplug_get_client_account_access_v2(p_client_subscription_id uuid)
returns table(service_name text, account_email text, account_password text, verification_code text, profile_name text, profile_pin text)
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private', 'vault'
as $$
declare
  v_row record;
begin
  select * into v_row
  from private.uniplug_get_client_account_access(p_client_subscription_id)
  limit 1;
  if not found then return; end if;

  insert into private.uniplug_client_service_access_log(client_subscription_id, actor_user_id, action)
  values (p_client_subscription_id, auth.uid(), 'member_read');

  return query
  select
    v_row.service_name::text,
    coalesce(access_vault.decrypted_secret::jsonb ->> 'account_email', access.account_email, v_row.account_email)::text,
    coalesce(access_vault.decrypted_secret::jsonb ->> 'account_password', access.account_password, v_row.account_password)::text,
    v_row.verification_code::text,
    coalesce(access_vault.decrypted_secret::jsonb ->> 'profile_name', access.profile_name, v_row.profile_name)::text,
    coalesce(access_vault.decrypted_secret::jsonb ->> 'profile_pin', access.profile_pin)::text
  from (select 1) seed
  left join private.uniplug_client_service_access access
    on access.client_subscription_id = p_client_subscription_id
  left join vault.decrypted_secrets access_vault on access_vault.id = access.vault_secret_id;
end;
$$;
