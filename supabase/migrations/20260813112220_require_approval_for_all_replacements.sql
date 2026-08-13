-- Every tracked client can have a portal identity, even when the imported
-- source record has no usable phone number. Username login remains available.
alter table public.client_portal_accounts
  alter column phone_e164 drop not null;

-- Preserve the allocator installed by the previous migration, but remove its
-- direct authenticated grant so it cannot bypass the approval gate below.
alter function private.uniplug_replace_client_account(uuid, text)
  rename to uniplug_replace_client_account_with_legacy_policy;

revoke all on function private.uniplug_replace_client_account_with_legacy_policy(uuid, text)
  from public, anon, authenticated;

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
  v_service_name text;
  v_reason text := lower(btrim(coalesce(p_reason, '')));
  v_request_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if v_reason not in ('incorrect_password','no_subscription','vpn_issue','household_issue','other') then
    raise exception 'Choose a valid replacement reason';
  end if;

  select portal.client_id into v_client_id
  from public.client_portal_accounts portal
  where portal.user_id = v_user_id
    and portal.must_change_password = false;
  if v_client_id is null then
    raise exception 'Complete password setup before managing services';
  end if;

  select coalesce(service.name, subscription.service_identifier, 'Digital service')
    into v_service_name
  from public.client_subscriptions subscription
  left join public.client_services service on service.id = subscription.service_id
  where subscription.id = p_client_subscription_id
    and subscription.client_id = v_client_id
    and subscription.status in ('active','due_soon','trial')
  for update of subscription;
  if not found then
    raise exception 'An active tracked subscription was not found';
  end if;

  select request.id into v_request_id
  from public.uniplug_replacement_approvals request
  where request.client_subscription_id = p_client_subscription_id
    and request.user_id = v_user_id
    and request.status = 'approved'
  order by request.reviewed_at desc nulls last, request.created_at desc
  limit 1
  for update;

  if v_request_id is null then
    insert into public.uniplug_replacement_approvals(
      client_subscription_id, client_id, user_id, service_name, reason
    ) values (
      p_client_subscription_id, v_client_id, v_user_id, v_service_name, v_reason
    )
    on conflict (client_subscription_id, user_id) where status = 'pending'
    do update set
      reason = excluded.reason,
      service_name = excluded.service_name,
      updated_at = now()
    returning id into v_request_id;

    return jsonb_build_object('status','approval_required','requestId',v_request_id);
  end if;

  v_result := private.uniplug_replace_client_account_with_legacy_policy(
    p_client_subscription_id,
    v_reason
  );

  if v_result->>'status' = 'completed' then
    update public.uniplug_replacement_approvals
    set status = 'consumed', consumed_at = now(), updated_at = now()
    where id = v_request_id and status = 'approved';
  end if;

  return v_result;
end;
$$;

revoke all on function private.uniplug_replace_client_account(uuid, text)
  from public, anon;
grant execute on function private.uniplug_replace_client_account(uuid, text)
  to authenticated, service_role;

comment on function public.uniplug_replace_client_account(uuid, text) is
  'Queues every account replacement for administrator approval and consumes one approval after a successful assignment.';

