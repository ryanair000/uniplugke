-- VeriFy Phase 3: per-subscription controls and server-only operations data.

alter table public.client_subscriptions
  add column if not exists verify_enabled boolean not null default true,
  add column if not exists verify_updated_at timestamptz;

comment on column public.client_subscriptions.verify_enabled is
  'Administrative per-subscription VeriFy switch. Service capability and subscription eligibility still apply.';
comment on column public.client_subscriptions.verify_updated_at is
  'Last time an administrator changed the per-subscription VeriFy switch.';

alter table public.uniplug_household_events
  drop constraint if exists uniplug_household_events_failure_category_check;

alter table public.uniplug_household_events
  add constraint uniplug_household_events_failure_category_check
    check (failure_category is null or failure_category in (
      'configuration_missing',
      'subscription_ineligible',
      'assignment_missing',
      'mailbox_connection_missing',
      'mailbox_authentication_failed',
      'mailbox_provider_error',
      'no_current_code',
      'member_rate_limit',
      'ip_rate_limit',
      'ip_velocity',
      'recent_auth_required'
    ));

create table if not exists public.uniplug_verify_admin_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'mailbox_connection_tested',
    'mailbox_credentials_rotated',
    'mailbox_credentials_revoked',
    'subscription_enabled',
    'subscription_disabled',
    'alert_resolved',
    'alert_reopened'
  )),
  outcome text not null check (outcome ~ '^[a-z0-9_]{2,64}$'),
  failure_category text check (
    failure_category is null or failure_category ~ '^[a-z0-9_]{2,64}$'
  ),
  provider text check (provider is null or provider in ('netflix')),
  mailbox_email text,
  client_subscription_id uuid references public.client_subscriptions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists uniplug_verify_admin_events_created_idx
  on public.uniplug_verify_admin_events(created_at desc);
create index if not exists uniplug_verify_admin_events_actor_idx
  on public.uniplug_verify_admin_events(actor_user_id, created_at desc);
create index if not exists uniplug_verify_admin_events_subscription_idx
  on public.uniplug_verify_admin_events(client_subscription_id, created_at desc)
  where client_subscription_id is not null;
create index if not exists uniplug_verify_admin_events_mailbox_idx
  on public.uniplug_verify_admin_events(lower(mailbox_email), created_at desc)
  where mailbox_email is not null;

alter table public.uniplug_verify_admin_events enable row level security;
revoke all on public.uniplug_verify_admin_events from public, anon, authenticated;
grant all on public.uniplug_verify_admin_events to service_role;

comment on table public.uniplug_verify_admin_events is
  'Server-only VeriFy administrative audit trail. Never stores mailbox secrets, messages, or verification codes.';

create table if not exists public.uniplug_verify_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique check (char_length(alert_key) between 3 and 180),
  category text not null check (category in (
    'authentication_failure',
    'repeated_no_code',
    'unusual_member_activity',
    'provider_format_change',
    'configuration'
  )),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  provider text not null check (provider in ('netflix')),
  mailbox_email text,
  client_subscription_id uuid references public.client_subscriptions(id) on delete set null,
  safe_context jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_context) = 'object'),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'open' and resolved_at is null and resolved_by is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

create index if not exists uniplug_verify_alerts_queue_idx
  on public.uniplug_verify_alerts(status, severity, last_seen_at desc);
create index if not exists uniplug_verify_alerts_provider_idx
  on public.uniplug_verify_alerts(provider, category, last_seen_at desc);
create index if not exists uniplug_verify_alerts_subscription_idx
  on public.uniplug_verify_alerts(client_subscription_id, last_seen_at desc)
  where client_subscription_id is not null;
create index if not exists uniplug_verify_alerts_resolved_by_idx
  on public.uniplug_verify_alerts(resolved_by)
  where resolved_by is not null;

alter table public.uniplug_verify_alerts enable row level security;
revoke all on public.uniplug_verify_alerts from public, anon, authenticated;
grant all on public.uniplug_verify_alerts to service_role;

comment on table public.uniplug_verify_alerts is
  'Server-only operational alerts derived from code-free VeriFy telemetry and safe mailbox health metadata.';
