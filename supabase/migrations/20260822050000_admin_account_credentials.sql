-- Admin-facing service-account credential management for UniPlug VeriFy.
-- New passwords are written to Supabase Vault and mirrored to the legacy
-- accounts.account_password column while Lokimax still depends on that field.
-- The portal accessor already prefers Vault when password_secret_id is present.

alter table public.accounts
  add column if not exists profile_pin text;

create or replace function public.uniplug_admin_update_account_credentials(
  p_account_id uuid,
  p_account_email text,
  p_account_password text default null,
  p_profile_name text default null,
  p_profile_pin text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  v_secret_id uuid;
  v_existing_secret_id uuid;
  v_email text := lower(btrim(coalesce(p_account_email, '')));
begin
  if p_account_id is null then
    raise exception 'Account is required';
  end if;
  if v_email = '' or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid service account email is required';
  end if;

  select password_secret_id
  into v_existing_secret_id
  from public.accounts
  where id = p_account_id
  for update;

  if not found then
    raise exception 'Service account not found';
  end if;

  if nullif(btrim(coalesce(p_account_password, '')), '') is not null then
    if char_length(p_account_password) > 512 then
      raise exception 'Account password is too long';
    end if;

    if v_existing_secret_id is null then
      select vault.create_secret(
        p_account_password,
        'uniplug-account-' || p_account_id::text,
        'UniPlug managed service account password'
      ) into v_secret_id;
    else
      perform vault.update_secret(
        v_existing_secret_id,
        p_account_password,
        'uniplug-account-' || p_account_id::text,
        'UniPlug managed service account password'
      );
      v_secret_id := v_existing_secret_id;
    end if;
  else
    v_secret_id := v_existing_secret_id;
  end if;

  update public.accounts
  set
    account_mail = v_email,
    password_secret_id = v_secret_id,
    account_password = case
      when nullif(btrim(coalesce(p_account_password, '')), '') is not null then p_account_password
      else account_password
    end,
    profile_name = nullif(btrim(coalesce(p_profile_name, '')), ''),
    profile_pin = nullif(btrim(coalesce(p_profile_pin, '')), '')
  where id = p_account_id;
end;
$$;

revoke all on function public.uniplug_admin_update_account_credentials(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.uniplug_admin_update_account_credentials(uuid, text, text, text, text) to service_role;

comment on function public.uniplug_admin_update_account_credentials(uuid, text, text, text, text) is
  'Service-role-only admin operation for updating UniPlug managed service-account credentials and profile metadata; passwords are stored in Vault and mirrored for legacy Lokimax compatibility.';
