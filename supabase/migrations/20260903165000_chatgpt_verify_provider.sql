-- Add ChatGPT as a second reviewed VeriFy provider.

alter table public.client_services
  drop constraint if exists client_services_verify_capability_check;
alter table public.client_services
  add constraint client_services_verify_capability_check
  check (
    (verify_enabled = false and verify_provider is null)
    or (verify_enabled = true and verify_provider in ('netflix', 'chatgpt'))
  );

alter table public.uniplug_household_events
  drop constraint if exists uniplug_household_events_provider_check;
alter table public.uniplug_household_events
  add constraint uniplug_household_events_provider_check
  check (provider is null or provider in ('netflix', 'chatgpt'));

alter table public.uniplug_verify_admin_events
  drop constraint if exists uniplug_verify_admin_events_provider_check;
alter table public.uniplug_verify_admin_events
  add constraint uniplug_verify_admin_events_provider_check
  check (provider is null or provider in ('netflix', 'chatgpt'));

alter table public.uniplug_verify_alerts
  drop constraint if exists uniplug_verify_alerts_provider_check;
alter table public.uniplug_verify_alerts
  add constraint uniplug_verify_alerts_provider_check
  check (provider in ('netflix', 'chatgpt'));

alter table public.uniplug_verify_message_receipts
  drop constraint if exists uniplug_verify_message_receipts_provider_check;
alter table public.uniplug_verify_message_receipts
  add constraint uniplug_verify_message_receipts_provider_check
  check (provider in ('netflix', 'chatgpt'));

alter table public.uniplug_verify_provider_rollouts
  drop constraint if exists uniplug_verify_provider_rollouts_provider_check;
alter table public.uniplug_verify_provider_rollouts
  add constraint uniplug_verify_provider_rollouts_provider_check
  check (provider in ('netflix', 'chatgpt'));

create or replace function public.uniplug_reserve_verify_request(
  p_user_id uuid,
  p_client_subscription_id uuid,
  p_provider text,
  p_ip_hash text default null,
  p_window_seconds integer default 600,
  p_member_limit integer default 5,
  p_ip_anomaly_limit integer default 20,
  p_ip_limit integer default 30
)
returns table (
  allowed boolean,
  request_id uuid,
  retry_after integer,
  failure_category text,
  ip_anomaly boolean
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_member_count integer := 0;
  v_ip_count integer := 0;
  v_member_oldest timestamptz;
  v_ip_oldest timestamptz;
  v_member_lock bigint;
  v_ip_lock bigint;
  v_retry_from timestamptz;
begin
  if p_provider not in ('netflix', 'chatgpt') then
    raise exception 'unsupported VeriFy provider';
  end if;
  if p_window_seconds not between 60 and 3600
     or p_member_limit not between 1 and 100
     or p_ip_anomaly_limit not between 1 and 1000
     or p_ip_limit < p_ip_anomaly_limit
     or p_ip_limit > 2000 then
    raise exception 'invalid VeriFy limit configuration';
  end if;
  if p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid VeriFy IP hash';
  end if;

  request_id := gen_random_uuid();
  retry_after := 0;
  failure_category := null;
  ip_anomaly := false;
  v_window_start := v_now - make_interval(secs => p_window_seconds);
  v_member_lock := hashtextextended('verify-member:' || p_user_id::text || ':' || p_client_subscription_id::text, 0);
  v_ip_lock := case when p_ip_hash is null then null else hashtextextended('verify-ip:' || p_ip_hash, 0) end;

  if v_ip_lock is null or v_member_lock = v_ip_lock then
    perform pg_advisory_xact_lock(v_member_lock);
  else
    perform pg_advisory_xact_lock(least(v_member_lock, v_ip_lock));
    perform pg_advisory_xact_lock(greatest(v_member_lock, v_ip_lock));
  end if;

  select count(*)::integer, min(e.created_at)
  into v_member_count, v_member_oldest
  from public.uniplug_household_events e
  where e.user_id = p_user_id
    and e.client_subscription_id = p_client_subscription_id
    and e.event_type = 'code_requested'
    and e.created_at >= v_window_start;

  if p_ip_hash is not null then
    select count(*)::integer, min(e.created_at)
    into v_ip_count, v_ip_oldest
    from public.uniplug_household_events e
    where e.ip_hash = p_ip_hash
      and e.event_type = 'code_requested'
      and e.created_at >= v_window_start;
  end if;

  ip_anomaly := p_ip_hash is not null and v_ip_count >= p_ip_anomaly_limit;

  if v_member_count >= p_member_limit or (p_ip_hash is not null and v_ip_count >= p_ip_limit) then
    allowed := false;
    failure_category := case when v_member_count >= p_member_limit then 'member_rate_limit' else 'ip_rate_limit' end;
    v_retry_from := case when failure_category = 'member_rate_limit' then v_member_oldest else v_ip_oldest end;
    retry_after := greatest(1, ceil(extract(epoch from ((v_retry_from + make_interval(secs => p_window_seconds)) - v_now)))::integer);

    insert into public.uniplug_household_events (
      user_id, client_subscription_id, event_type, outcome, request_id,
      provider, failure_category, latency_ms, ip_hash
    ) values (
      p_user_id, p_client_subscription_id, 'rate_limited', failure_category, request_id,
      p_provider, failure_category, 0, p_ip_hash
    );
    return next;
    return;
  end if;

  if ip_anomaly then
    insert into public.uniplug_household_events (
      user_id, client_subscription_id, event_type, outcome, request_id,
      provider, failure_category, latency_ms, ip_hash
    ) values (
      p_user_id, p_client_subscription_id, 'ip_anomaly', 'velocity_threshold', request_id,
      p_provider, 'ip_velocity', 0, p_ip_hash
    );
  end if;

  insert into public.uniplug_household_events (
    user_id, client_subscription_id, event_type, outcome, request_id,
    provider, latency_ms, ip_hash
  ) values (
    p_user_id, p_client_subscription_id, 'code_requested', p_provider, request_id,
    p_provider, 0, p_ip_hash
  );

  allowed := true;
  return next;
end;
$$;

revoke execute on function public.uniplug_reserve_verify_request(uuid, uuid, text, text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.uniplug_reserve_verify_request(uuid, uuid, text, text, integer, integer, integer, integer)
  to service_role;

create or replace function public.uniplug_record_verify_message(
  p_user_id uuid,
  p_client_subscription_id uuid,
  p_provider text,
  p_message_fingerprint text,
  p_expires_at timestamptz,
  p_request_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_seen_count integer;
begin
  if p_provider not in ('netflix', 'chatgpt')
     or p_message_fingerprint !~ '^[0-9a-f]{64}$'
     or p_expires_at <= clock_timestamp() then
    raise exception 'invalid VeriFy message receipt';
  end if;

  insert into public.uniplug_verify_message_receipts (
    user_id, client_subscription_id, provider, message_fingerprint,
    expires_at, first_request_id, last_request_id
  ) values (
    p_user_id, p_client_subscription_id, p_provider, p_message_fingerprint,
    p_expires_at, p_request_id, p_request_id
  )
  on conflict (user_id, client_subscription_id, provider, message_fingerprint)
  do update set
    expires_at = excluded.expires_at,
    last_request_id = excluded.last_request_id,
    seen_count = public.uniplug_verify_message_receipts.seen_count + 1,
    last_seen_at = clock_timestamp()
  returning seen_count into v_seen_count;

  return v_seen_count > 1;
end;
$$;

revoke execute on function public.uniplug_record_verify_message(uuid, uuid, text, text, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.uniplug_record_verify_message(uuid, uuid, text, text, timestamptz, uuid)
  to service_role;

insert into public.uniplug_verify_provider_rollouts (
  provider,
  operational_status,
  authorization_status,
  authorization_model,
  authorization_reference,
  terms_review_status,
  code_semantics,
  incident_owner,
  support_runbook_reference,
  sender_allowlist_reviewed,
  parser_fixtures_reviewed,
  expiry_rules_reviewed,
  abuse_limits_reviewed,
  forbidden_code_classes_confirmed,
  support_runbook_reviewed,
  approved_at
) values (
  'chatgpt',
  'live',
  'approved',
  'UniPlug-managed ChatGPT access assigned to active member subscriptions; mailbox access remains with UniPlug operations.',
  'managed-chatgpt-email-verification',
  'approved',
  'Temporary six-digit ChatGPT verification codes only; password resets, magic links, and unrelated OTPs are rejected.',
  'UniPlug operations',
  '/admin/verify/providers',
  true,
  true,
  true,
  true,
  true,
  true,
  now()
)
on conflict (provider) do update set
  operational_status = excluded.operational_status,
  authorization_status = excluded.authorization_status,
  authorization_model = excluded.authorization_model,
  authorization_reference = excluded.authorization_reference,
  terms_review_status = excluded.terms_review_status,
  code_semantics = excluded.code_semantics,
  incident_owner = excluded.incident_owner,
  support_runbook_reference = excluded.support_runbook_reference,
  sender_allowlist_reviewed = true,
  parser_fixtures_reviewed = true,
  expiry_rules_reviewed = true,
  abuse_limits_reviewed = true,
  forbidden_code_classes_confirmed = true,
  support_runbook_reviewed = true,
  shutdown_reason = null,
  approved_at = coalesce(public.uniplug_verify_provider_rollouts.approved_at, now()),
  updated_at = now();

update public.client_services
set verify_enabled = true,
    verify_provider = 'chatgpt'
where lower(trim(name)) = 'chatgpt plus';

update public.client_subscriptions cs
set verify_enabled = true
from public.client_services s
where cs.service_id = s.id
  and lower(trim(s.name)) = 'chatgpt plus'
  and lower(coalesce(cs.account_reference, '')) = 'learningwithkikitv@gmail.com';

comment on table public.uniplug_household_events is
  'Server-only audit trail for provider verification assistance without persisting temporary codes.';
