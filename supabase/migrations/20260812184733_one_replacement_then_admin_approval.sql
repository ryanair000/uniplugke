create table if not exists public.uniplug_replacement_approvals (
  id uuid primary key default gen_random_uuid(),
  client_subscription_id uuid not null references public.client_subscriptions(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_name text not null,
  reason text not null check (reason in ('incorrect_password','no_subscription','vpn_issue','household_issue','other')),
  status text not null default 'pending' check (status in ('pending','approved','declined','consumed')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uniplug_replacement_approvals_user_idx
  on public.uniplug_replacement_approvals(user_id, created_at desc);
create index if not exists uniplug_replacement_approvals_subscription_idx
  on public.uniplug_replacement_approvals(client_subscription_id, status, created_at desc);
create unique index if not exists uniplug_replacement_approvals_one_pending_idx
  on public.uniplug_replacement_approvals(client_subscription_id, user_id)
  where status = 'pending';

alter table public.uniplug_replacement_approvals enable row level security;
revoke all on public.uniplug_replacement_approvals from public, anon, authenticated;
grant select on public.uniplug_replacement_approvals to authenticated;
grant all on public.uniplug_replacement_approvals to service_role;

create policy "Authorized users read replacement requests"
on public.uniplug_replacement_approvals
for select to authenticated
using ((select auth.uid()) = user_id or (select public.hub_is_admin()));

create policy "Admins update replacement requests"
on public.uniplug_replacement_approvals
for update to authenticated
using ((select public.hub_is_admin()))
with check ((select public.hub_is_admin()));

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.uniplug_replace_client_account(
  p_client_subscription_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_client_id uuid;
  v_subscription public.client_subscriptions%rowtype;
  v_service_name text;
  v_reason text := lower(btrim(coalesce(p_reason, '')));
  v_legacy_subscription_id uuid;
  v_old_account_id uuid;
  v_new_account_id uuid;
  v_new_account_mail text;
  v_replacement_id uuid;
  v_request_id uuid;
  v_completed_count integer;
begin
  if v_user_id is null then raise exception 'Authentication is required'; end if;
  if v_reason not in ('incorrect_password','no_subscription','vpn_issue','household_issue','other') then
    raise exception 'Choose a valid replacement reason';
  end if;

  select portal.client_id into v_client_id
  from public.client_portal_accounts portal
  where portal.user_id = v_user_id and portal.must_change_password = false;
  if v_client_id is null then raise exception 'Complete password setup before managing services'; end if;

  select subscription.* into v_subscription
  from public.client_subscriptions subscription
  where subscription.id = p_client_subscription_id
    and subscription.client_id = v_client_id
    and subscription.status in ('active','due_soon','trial')
  for update;
  if not found then raise exception 'An active tracked subscription was not found'; end if;

  select coalesce(service.name, v_subscription.service_identifier, 'Digital service') into v_service_name
  from (select 1) seed
  left join public.client_services service on service.id = v_subscription.service_id;

  select count(*) into v_completed_count
  from public.client_account_replacements replacement
  where replacement.client_subscription_id = p_client_subscription_id
    and replacement.user_id = v_user_id
    and replacement.status = 'completed';

  if v_completed_count >= 1 then
    select request.id into v_request_id
    from public.uniplug_replacement_approvals request
    where request.client_subscription_id = p_client_subscription_id
      and request.user_id = v_user_id
      and request.status = 'approved'
    order by request.reviewed_at desc nulls last, request.created_at desc
    limit 1
    for update;

    if v_request_id is null then
      select request.id into v_request_id
      from public.uniplug_replacement_approvals request
      where request.client_subscription_id = p_client_subscription_id
        and request.user_id = v_user_id
        and request.status = 'pending'
      order by request.created_at desc
      limit 1;

      if v_request_id is null then
        insert into public.uniplug_replacement_approvals(
          client_subscription_id, client_id, user_id, service_name, reason
        ) values (
          p_client_subscription_id, v_client_id, v_user_id, v_service_name, v_reason
        ) returning id into v_request_id;
      end if;

      return jsonb_build_object('status','approval_required','requestId',v_request_id);
    end if;
  end if;

  if coalesce(v_subscription.metadata->>'legacy_id','') ~*
     '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_legacy_subscription_id := (v_subscription.metadata->>'legacy_id')::uuid;
  end if;

  if v_legacy_subscription_id is not null then
    select legacy.account_id into v_old_account_id
    from public.subscriptions legacy where legacy.id = v_legacy_subscription_id;
  end if;

  if v_old_account_id is null and nullif(btrim(v_subscription.account_reference),'') is not null then
    select account.id into v_old_account_id
    from public.accounts account
    where lower(account.account_mail) = lower(v_subscription.account_reference)
    limit 1;
  end if;

  select account.id, account.account_mail into v_new_account_id, v_new_account_mail
  from public.accounts account
  where account.id is distinct from v_old_account_id
    and nullif(btrim(account.account_mail),'') is not null
    and (account.password_secret_id is not null or nullif(btrim(account.account_password),'') is not null)
    and (
      regexp_replace(lower(coalesce(account.service_name,'')), '[^a-z0-9]', '', 'g') = regexp_replace(lower(coalesce(v_service_name,'')), '[^a-z0-9]', '', 'g')
      or regexp_replace(lower(coalesce(account.game,'')), '[^a-z0-9]', '', 'g') = regexp_replace(lower(coalesce(v_service_name,'')), '[^a-z0-9]', '', 'g')
      or regexp_replace(lower(coalesce(account.service_name,'')), '[^a-z0-9]', '', 'g') = regexp_replace(lower(coalesce(v_subscription.service_identifier,'')), '[^a-z0-9]', '', 'g')
      or regexp_replace(lower(coalesce(account.game,'')), '[^a-z0-9]', '', 'g') = regexp_replace(lower(coalesce(v_subscription.service_identifier,'')), '[^a-z0-9]', '', 'g')
    )
  order by (
    select count(*) from public.subscriptions assigned
    where assigned.account_id = account.id and coalesce(assigned.status,'active') = 'active'
  ), account.updated_at nulls first, account.created_at
  limit 1
  for update of account skip locked;

  if v_new_account_id is null then
    insert into public.client_account_replacements(
      client_subscription_id, client_id, user_id, old_account_id, status, reason
    ) values (
      p_client_subscription_id, v_client_id, v_user_id, v_old_account_id, 'no_inventory', v_reason
    ) returning id into v_replacement_id;
    return jsonb_build_object('status','no_inventory','replacementId',v_replacement_id);
  end if;

  if v_legacy_subscription_id is not null then
    update public.subscriptions set account_id=v_new_account_id, service_mail=v_new_account_mail, updated_at=now()
    where id=v_legacy_subscription_id;
  end if;

  update public.client_subscriptions
  set account_reference=v_new_account_mail,
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('last_replacement_at',now(),'assigned_account_id',v_new_account_id),
      updated_at=now()
  where id=p_client_subscription_id;

  insert into public.client_account_replacements(
    client_subscription_id, client_id, user_id, old_account_id, new_account_id, status, reason
  ) values (
    p_client_subscription_id, v_client_id, v_user_id, v_old_account_id, v_new_account_id, 'completed', v_reason
  ) returning id into v_replacement_id;

  if v_completed_count >= 1 and v_request_id is not null then
    update public.uniplug_replacement_approvals
    set status='consumed', consumed_at=now(), updated_at=now()
    where id=v_request_id and status='approved';
  end if;

  if to_regclass('public.uniplug_member_events') is not null then
    insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
    values (v_user_id,'subscription_status','Account replaced','A replacement account was assigned.','subscription',p_client_subscription_id);
  end if;

  return jsonb_build_object('status','completed','replacementId',v_replacement_id);
end;
$$;

revoke all on function private.uniplug_replace_client_account(uuid,text) from public, anon;
grant execute on function private.uniplug_replace_client_account(uuid,text) to authenticated, service_role;

create or replace function public.uniplug_replace_client_account(
  p_client_subscription_id uuid,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.uniplug_replace_client_account(p_client_subscription_id, p_reason);
$$;

revoke all on function public.uniplug_replace_client_account(uuid,text) from public, anon;
grant execute on function public.uniplug_replace_client_account(uuid,text) to authenticated;

comment on function public.uniplug_replace_client_account(uuid,text) is
  'Allows one immediate replacement per subscription. Every later replacement consumes one admin approval.';
