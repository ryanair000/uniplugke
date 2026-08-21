-- VeriFy Phase 2: provider capabilities, atomic limits, anomaly signals,
-- request telemetry, and code-free message idempotency.

alter table public.client_services
  add column if not exists verify_enabled boolean not null default false,
  add column if not exists verify_provider text;

alter table public.client_services
  drop constraint if exists client_services_verify_capability_check;

alter table public.client_services
  add constraint client_services_verify_capability_check
  check (
    (verify_enabled = false and verify_provider is null)
    or (verify_enabled = true and verify_provider in ('netflix'))
  );

-- Provider assignment is a reviewed catalog operation. No arbitrary sender or
-- parser configuration is stored in the database.
update public.client_services
set verify_enabled = true,
    verify_provider = 'netflix'
where lower(trim(name)) in ('netflix', 'netflix premium');

comment on column public.client_services.verify_enabled is
  'Reviewed capability flag controlling whether VeriFy is available for this service.';
comment on column public.client_services.verify_provider is
  'Allowlisted VeriFy provider implemented in application code.';

alter table public.uniplug_household_events
  add column if not exists request_id uuid,
  add column if not exists provider text,
  add column if not exists failure_category text,
  add column if not exists latency_ms integer,
  add column if not exists ip_hash text,
  add column if not exists message_fingerprint text,
  add column if not exists idempotent boolean not null default false;

alter table public.uniplug_household_events
  drop constraint if exists uniplug_household_events_event_type_check,
  drop constraint if exists uniplug_household_events_provider_check,
  drop constraint if exists uniplug_household_events_failure_category_check,
  drop constraint if exists uniplug_household_events_latency_check,
  drop constraint if exists uniplug_household_events_ip_hash_check,
  drop constraint if exists uniplug_household_events_message_fingerprint_check;

alter table public.uniplug_household_events
  add constraint uniplug_household_events_event_type_check
    check (event_type in (
      'assistant_opened',
      'code_requested',
      'code_found',
      'code_reused',
      'code_not_found',
      'mailbox_not_connected',
      'mailbox_check_failed',
      'rate_limited',
      'ip_anomaly',
      'recent_auth_required',
      'replacement_requested'
    )),
  add constraint uniplug_household_events_provider_check
    check (provider is null or provider in ('netflix')),
  add constraint uniplug_household_events_failure_category_check
    check (failure_category is null or failure_category in (
      'configuration_missing',
      'subscription_ineligible',
      'assignment_missing',
      'mailbox_connection_missing',
      'mailbox_provider_error',
      'no_current_code',
      'member_rate_limit',
      'ip_rate_limit',
      'ip_velocity',
      'recent_auth_required'
    )),
  add constraint uniplug_household_events_latency_check
    check (latency_ms is null or latency_ms >= 0),
  add constraint uniplug_household_events_ip_hash_check
    check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  add constraint uniplug_household_events_message_fingerprint_check
    check (message_fingerprint is null or message_fingerprint ~ '^[0-9a-f]{64}$');

create index if not exists uniplug_household_events_member_rate_v2_idx
  on public.uniplug_household_events(user_id, client_subscription_id, created_at desc)
  where event_type = 'code_requested';

create index if not exists uniplug_household_events_ip_rate_idx
  on public.uniplug_household_events(ip_hash, created_at desc)
  where event_type = 'code_requested' and ip_hash is not null;

create index if not exists uniplug_household_events_provider_ops_idx
  on public.uniplug_household_events(provider, event_type, created_at desc);

create table if not exists public.uniplug_verify_message_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_subscription_id uuid not null references public.client_subscriptions(id) on delete cascade,
  provider text not null check (provider in ('netflix')),
  message_fingerprint text not null check (message_fingerprint ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  first_request_id uuid not null,
  last_request_id uuid not null,
  seen_count integer not null default 1 check (seen_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, client_subscription_id, provider, message_fingerprint)
);

create index if not exists uniplug_verify_message_receipts_expiry_idx
  on public.uniplug_verify_message_receipts(expires_at);

alter table public.uniplug_verify_message_receipts enable row level security;
revoke all on public.uniplug_verify_message_receipts from public, anon, authenticated;
grant all on public.uniplug_verify_message_receipts to service_role;

comment on table public.uniplug_verify_message_receipts is
  'Server-only idempotency receipts. Stores message fingerprints and expiry metadata, never codes or email content.';

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
  if p_provider not in ('netflix') then
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
  v_member_lock := hashtextextended(
    'verify-member:' || p_user_id::text || ':' || p_client_subscription_id::text,
    0
  );
  v_ip_lock := case when p_ip_hash is null then null else hashtextextended('verify-ip:' || p_ip_hash, 0) end;

  -- Acquire both identity locks in a stable order to avoid deadlocks.
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
    failure_category := case
      when v_member_count >= p_member_limit then 'member_rate_limit'
      else 'ip_rate_limit'
    end;
    v_retry_from := case
      when failure_category = 'member_rate_limit' then v_member_oldest
      else v_ip_oldest
    end;
    retry_after := greatest(
      1,
      ceil(extract(epoch from ((v_retry_from + make_interval(secs => p_window_seconds)) - v_now)))::integer
    );

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

comment on function public.uniplug_reserve_verify_request(uuid, uuid, text, text, integer, integer, integer, integer) is
  'Atomically reserves a VeriFy request under member/subscription and hashed-IP rolling limits.';

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
  if p_provider not in ('netflix')
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

comment on function public.uniplug_record_verify_message(uuid, uuid, text, text, timestamptz, uuid) is
  'Records a code-free message fingerprint and returns true when the same active message was already seen.';
