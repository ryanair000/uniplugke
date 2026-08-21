-- Connect the canonical Lokimax client hub to the UniPlug member portal.
-- Portal accounts are provisioned by the server with a temporary phone-based
-- password and must replace it before any dashboard data is available.

alter table public.client_portal_accounts enable row level security;
alter table public.client_portal_accounts
  add column if not exists contact_email text;
alter table public.clients enable row level security;
alter table public.client_services enable row level security;
alter table public.client_subscriptions enable row level security;

drop policy if exists "Portal users update own password flag" on public.client_portal_accounts;
drop policy if exists "Portal users read own account" on public.client_portal_accounts;
create policy "Portal users read own account"
  on public.client_portal_accounts
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Portal users read own client" on public.clients;
create policy "Portal users read own client"
  on public.clients
  for select to authenticated
  using (
    exists (
      select 1
      from public.client_portal_accounts portal
      where portal.user_id = (select auth.uid())
        and portal.client_id = clients.id
        and portal.must_change_password = false
    )
  );

drop policy if exists "Portal users read own services" on public.client_services;
create policy "Portal users read own services"
  on public.client_services
  for select to authenticated
  using (
    exists (
      select 1
      from public.client_subscriptions subscription
      join public.client_portal_accounts portal
        on portal.client_id = subscription.client_id
      where portal.user_id = (select auth.uid())
        and portal.must_change_password = false
        and subscription.service_id = client_services.id
    )
  );

drop policy if exists "Portal users read own subscriptions" on public.client_subscriptions;
create policy "Portal users read own subscriptions"
  on public.client_subscriptions
  for select to authenticated
  using (
    exists (
      select 1
      from public.client_portal_accounts portal
      where portal.user_id = (select auth.uid())
        and portal.client_id = client_subscriptions.client_id
        and portal.must_change_password = false
    )
  );

grant select on public.client_portal_accounts, public.clients,
  public.client_services, public.client_subscriptions to authenticated;

-- The old account pool contains service credentials. It must never be public.
alter table public.accounts enable row level security;
drop policy if exists "Allow all operations" on public.accounts;
drop policy if exists "Authenticated users can manage accounts" on public.accounts;
drop policy if exists "Authenticated users can read accounts" on public.accounts;
drop policy if exists "Users cannot access accounts" on public.accounts;
drop policy if exists "Admins can manage accounts" on public.accounts;
create policy "Admins can manage accounts"
  on public.accounts
  for all to authenticated
  using ((select public.hub_is_admin()))
  with check ((select public.hub_is_admin()));

revoke all on public.accounts from anon;
revoke all on public.accounts from authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant all on public.accounts to service_role;

create table if not exists public.client_account_replacements (
  id uuid primary key default gen_random_uuid(),
  client_subscription_id uuid not null
    references public.client_subscriptions(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  old_account_id uuid references public.accounts(id) on delete set null,
  new_account_id uuid references public.accounts(id) on delete set null,
  status text not null check (status in ('completed','no_inventory','failed')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists client_account_replacements_user_idx
  on public.client_account_replacements(user_id, created_at desc);
create index if not exists client_account_replacements_subscription_idx
  on public.client_account_replacements(client_subscription_id, created_at desc);
create index if not exists client_account_replacements_client_idx
  on public.client_account_replacements(client_id, created_at desc);
create index if not exists client_account_replacements_old_account_idx
  on public.client_account_replacements(old_account_id) where old_account_id is not null;
create index if not exists client_account_replacements_new_account_idx
  on public.client_account_replacements(new_account_id) where new_account_id is not null;

alter table public.client_account_replacements enable row level security;
drop policy if exists "Portal users read own replacements" on public.client_account_replacements;
drop policy if exists "Authorized users read replacements" on public.client_account_replacements;
create policy "Authorized users read replacements"
  on public.client_account_replacements
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.hub_is_admin()));
drop policy if exists "Admins manage replacements" on public.client_account_replacements;
drop policy if exists "Admins insert replacements" on public.client_account_replacements;
create policy "Admins insert replacements"
  on public.client_account_replacements
  for insert to authenticated
  with check ((select public.hub_is_admin()));
drop policy if exists "Admins update replacements" on public.client_account_replacements;
create policy "Admins update replacements"
  on public.client_account_replacements
  for update to authenticated
  using ((select public.hub_is_admin()))
  with check ((select public.hub_is_admin()));
drop policy if exists "Admins delete replacements" on public.client_account_replacements;
create policy "Admins delete replacements"
  on public.client_account_replacements
  for delete to authenticated
  using ((select public.hub_is_admin()));

revoke all on public.client_account_replacements from anon, authenticated;
grant select on public.client_account_replacements to authenticated;
grant all on public.client_account_replacements to service_role;

create or replace function public.uniplug_complete_onboarding()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication is required'; end if;

  update public.uniplug_profiles
  set status = 'active', onboarding_completed_at = now(), updated_at = now()
  where user_id = v_user_id and status in ('pending','active');
  if not found then raise exception 'A pending UniPlug invitation was not found'; end if;

  update public.client_portal_accounts
  set must_change_password = false,
      last_login_at = now(),
      updated_at = now()
  where user_id = v_user_id;

  update public.uniplug_invitations
  set status = 'completed', completed_at = now()
  where user_id = v_user_id and status = 'created';
end;
$$;

revoke execute on function public.uniplug_complete_onboarding() from public, anon;
grant execute on function public.uniplug_complete_onboarding() to authenticated;

create or replace function public.uniplug_replace_client_account(
  p_client_subscription_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id uuid;
  v_subscription public.client_subscriptions%rowtype;
  v_service_name text;
  v_legacy_subscription_id uuid;
  v_old_account_id uuid;
  v_new_account_id uuid;
  v_new_account_mail text;
  v_replacement_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required'; end if;

  select portal.client_id
  into v_client_id
  from public.client_portal_accounts portal
  where portal.user_id = v_user_id
    and portal.must_change_password = false;

  if v_client_id is null then raise exception 'Complete password setup before managing services'; end if;

  select subscription.*
  into v_subscription
  from public.client_subscriptions subscription
  where subscription.id = p_client_subscription_id
    and subscription.client_id = v_client_id
    and subscription.status in ('active','due_soon')
  for update;

  if not found then raise exception 'An active tracked subscription was not found'; end if;

  if exists (
    select 1 from public.client_account_replacements replacement
    where replacement.client_subscription_id = p_client_subscription_id
      and replacement.user_id = v_user_id
      and replacement.status = 'completed'
      and replacement.created_at > now() - interval '15 minutes'
  ) then
    raise exception 'Please wait 15 minutes before requesting another replacement';
  end if;

  if (
    select count(*) from public.client_account_replacements replacement
    where replacement.client_subscription_id = p_client_subscription_id
      and replacement.user_id = v_user_id
      and replacement.status = 'completed'
      and replacement.created_at > now() - interval '7 days'
  ) >= 3 then
    raise exception 'The instant replacement limit has been reached; contact support';
  end if;

  select service.name into v_service_name
  from public.client_services service
  where service.id = v_subscription.service_id;

  if coalesce(v_subscription.metadata->>'legacy_id','') ~*
     '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_legacy_subscription_id := (v_subscription.metadata->>'legacy_id')::uuid;
  end if;

  if v_legacy_subscription_id is not null then
    select legacy.account_id
    into v_old_account_id
    from public.subscriptions legacy
    where legacy.id = v_legacy_subscription_id;
  end if;

  if v_old_account_id is null and nullif(btrim(v_subscription.account_reference),'') is not null then
    select account.id into v_old_account_id
    from public.accounts account
    where lower(account.account_mail) = lower(v_subscription.account_reference)
    limit 1;
  end if;

  select account.id, account.account_mail
  into v_new_account_id, v_new_account_mail
  from public.accounts account
  where account.id is distinct from v_old_account_id
    and nullif(btrim(account.account_mail),'') is not null
    and nullif(btrim(account.account_password),'') is not null
    and (
      regexp_replace(lower(coalesce(account.service_name,'')), '[^a-z0-9]', '', 'g') =
        regexp_replace(lower(coalesce(v_service_name,'')), '[^a-z0-9]', '', 'g')
      or regexp_replace(lower(coalesce(account.game,'')), '[^a-z0-9]', '', 'g') =
        regexp_replace(lower(coalesce(v_service_name,'')), '[^a-z0-9]', '', 'g')
      or regexp_replace(lower(coalesce(account.service_name,'')), '[^a-z0-9]', '', 'g') =
        regexp_replace(lower(coalesce(v_subscription.service_identifier,'')), '[^a-z0-9]', '', 'g')
      or regexp_replace(lower(coalesce(account.game,'')), '[^a-z0-9]', '', 'g') =
        regexp_replace(lower(coalesce(v_subscription.service_identifier,'')), '[^a-z0-9]', '', 'g')
    )
  order by (
    select count(*)
    from public.subscriptions assigned
    where assigned.account_id = account.id
      and coalesce(assigned.status,'active') = 'active'
  ), account.updated_at nulls first, account.created_at
  limit 1
  for update of account skip locked;

  if v_new_account_id is null then
    insert into public.client_account_replacements(
      client_subscription_id, client_id, user_id, old_account_id, status, reason
    ) values (
      p_client_subscription_id, v_client_id, v_user_id, v_old_account_id,
      'no_inventory', nullif(btrim(coalesce(p_reason,'')), '')
    ) returning id into v_replacement_id;

    return jsonb_build_object('status','no_inventory','replacementId',v_replacement_id);
  end if;

  if v_legacy_subscription_id is not null then
    update public.subscriptions
    set account_id = v_new_account_id,
        service_mail = v_new_account_mail,
        updated_at = now()
    where id = v_legacy_subscription_id;
  end if;

  update public.client_subscriptions
  set account_reference = v_new_account_mail,
      metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'last_replacement_at', now(),
        'assigned_account_id', v_new_account_id
      ),
      updated_at = now()
  where id = p_client_subscription_id;

  insert into public.client_account_replacements(
    client_subscription_id, client_id, user_id, old_account_id,
    new_account_id, status, reason
  ) values (
    p_client_subscription_id, v_client_id, v_user_id, v_old_account_id,
    v_new_account_id, 'completed', nullif(btrim(coalesce(p_reason,'')), '')
  ) returning id into v_replacement_id;

  if to_regclass('public.uniplug_member_events') is not null then
    insert into public.uniplug_member_events(
      user_id,event_type,title,detail,entity_type,entity_id
    ) values (
      v_user_id,'subscription_status','Account replaced',
      'A replacement account was assigned instantly.','subscription',p_client_subscription_id
    );
  end if;

  return jsonb_build_object('status','completed','replacementId',v_replacement_id);
end;
$$;

revoke execute on function public.uniplug_replace_client_account(uuid,text) from public, anon;
grant execute on function public.uniplug_replace_client_account(uuid,text) to authenticated;

comment on function public.uniplug_replace_client_account(uuid,text) is
  'Atomically assigns the least-used matching credential account to the authenticated portal client. Limited to three replacements per subscription per seven days.';
