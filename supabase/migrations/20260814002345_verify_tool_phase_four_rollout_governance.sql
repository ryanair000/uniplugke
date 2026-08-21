-- VeriFy Phase 4: provider authorization, readiness, cohort rollout, and kill switches.

alter table public.uniplug_household_events
  drop constraint if exists uniplug_household_events_event_type_check;

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
      'provider_access_denied',
      'replacement_requested'
    ));

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
      'recent_auth_required',
      'provider_disabled',
      'provider_pilot_restricted'
    ));

alter table public.uniplug_verify_admin_events
  drop constraint if exists uniplug_verify_admin_events_action_check;

alter table public.uniplug_verify_admin_events
  add constraint uniplug_verify_admin_events_action_check
    check (action in (
      'mailbox_connection_tested',
      'mailbox_credentials_rotated',
      'mailbox_credentials_revoked',
      'subscription_enabled',
      'subscription_disabled',
      'alert_resolved',
      'alert_reopened',
      'provider_governance_updated',
      'provider_paused',
      'provider_resumed',
      'provider_cohort_added',
      'provider_cohort_removed'
    ));

create table if not exists public.uniplug_verify_provider_rollouts (
  provider text primary key check (provider in ('netflix')),
  operational_status text not null default 'disabled'
    check (operational_status in ('disabled', 'pilot', 'live', 'paused')),
  authorization_status text not null default 'pending'
    check (authorization_status in ('pending', 'approved', 'revoked')),
  authorization_model text not null default ''
    check (char_length(authorization_model) <= 1200),
  authorization_reference text not null default ''
    check (char_length(authorization_reference) <= 300),
  terms_review_status text not null default 'pending'
    check (terms_review_status in ('pending', 'approved', 'blocked')),
  code_semantics text not null default ''
    check (char_length(code_semantics) <= 600),
  incident_owner text not null default ''
    check (char_length(incident_owner) <= 160),
  support_runbook_reference text not null default ''
    check (char_length(support_runbook_reference) <= 300),
  sender_allowlist_reviewed boolean not null default false,
  parser_fixtures_reviewed boolean not null default false,
  expiry_rules_reviewed boolean not null default false,
  abuse_limits_reviewed boolean not null default false,
  forbidden_code_classes_confirmed boolean not null default false,
  support_runbook_reviewed boolean not null default false,
  shutdown_reason text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (shutdown_reason is null or char_length(shutdown_reason) between 3 and 300),
  check (
    operational_status not in ('pilot', 'live')
    or (
      authorization_status = 'approved'
      and terms_review_status = 'approved'
      and char_length(trim(authorization_model)) >= 20
      and char_length(trim(authorization_reference)) >= 3
      and char_length(trim(code_semantics)) >= 20
      and char_length(trim(incident_owner)) >= 3
      and char_length(trim(support_runbook_reference)) >= 3
      and sender_allowlist_reviewed
      and parser_fixtures_reviewed
      and expiry_rules_reviewed
      and abuse_limits_reviewed
      and forbidden_code_classes_confirmed
      and support_runbook_reviewed
    )
  )
);

create index if not exists uniplug_verify_provider_rollouts_status_idx
  on public.uniplug_verify_provider_rollouts(operational_status, updated_at desc);
create index if not exists uniplug_verify_provider_rollouts_updated_by_idx
  on public.uniplug_verify_provider_rollouts(updated_by)
  where updated_by is not null;
create index if not exists uniplug_verify_provider_rollouts_approved_by_idx
  on public.uniplug_verify_provider_rollouts(approved_by)
  where approved_by is not null;

alter table public.uniplug_verify_provider_rollouts enable row level security;
revoke all on public.uniplug_verify_provider_rollouts from public, anon, authenticated;
grant all on public.uniplug_verify_provider_rollouts to service_role;

comment on table public.uniplug_verify_provider_rollouts is
  'Server-only provider authorization, readiness, rollout status, and instant shutdown control. Contains no codes, messages, or mailbox credentials.';

create table if not exists public.uniplug_verify_provider_cohorts (
  id uuid primary key default gen_random_uuid(),
  provider text not null references public.uniplug_verify_provider_rollouts(provider) on delete cascade,
  client_subscription_id uuid not null references public.client_subscriptions(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  note text not null default '' check (char_length(note) <= 240),
  created_at timestamptz not null default now(),
  unique (provider, client_subscription_id)
);

create index if not exists uniplug_verify_provider_cohorts_subscription_idx
  on public.uniplug_verify_provider_cohorts(client_subscription_id, provider);
create index if not exists uniplug_verify_provider_cohorts_added_by_idx
  on public.uniplug_verify_provider_cohorts(added_by)
  where added_by is not null;

alter table public.uniplug_verify_provider_cohorts enable row level security;
revoke all on public.uniplug_verify_provider_cohorts from public, anon, authenticated;
grant all on public.uniplug_verify_provider_cohorts to service_role;

comment on table public.uniplug_verify_provider_cohorts is
  'Server-only explicit subscription cohort used while a provider is in pilot. Cohort membership grants no access unless all normal eligibility checks also pass.';

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
  'netflix',
  'live',
  'approved',
  'UniPlug-managed Netflix access assigned to active member subscriptions; mailbox access remains with UniPlug operations.',
  'existing-managed-service',
  'approved',
  'Temporary Netflix sign-in or viewing code only; password resets and unrelated one-time passwords are rejected.',
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
on conflict (provider) do nothing;
