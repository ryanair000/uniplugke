-- Add code-free audit categories for the explicit Netflix Household confirmation action.
alter table public.uniplug_household_events
  drop constraint if exists uniplug_household_events_event_type_check,
  drop constraint if exists uniplug_household_events_failure_category_check;

alter table public.uniplug_household_events
  add constraint uniplug_household_events_event_type_check
    check (event_type in (
      'assistant_opened',
      'code_requested',
      'code_found',
      'code_reused',
      'code_not_found',
      'household_update_approved',
      'household_update_reused',
      'household_update_not_found',
      'mailbox_not_connected',
      'mailbox_check_failed',
      'rate_limited',
      'ip_anomaly',
      'recent_auth_required',
      'replacement_requested',
      'provider_access_denied'
    )),
  add constraint uniplug_household_events_failure_category_check
    check (failure_category is null or failure_category in (
      'configuration_missing',
      'subscription_ineligible',
      'assignment_missing',
      'mailbox_connection_missing',
      'mailbox_authentication_failed',
      'mailbox_provider_error',
      'no_current_code',
      'no_current_household_update',
      'member_rate_limit',
      'ip_rate_limit',
      'ip_velocity',
      'recent_auth_required',
      'provider_disabled',
      'provider_paused',
      'provider_pilot_restricted',
      'provider_rollout_missing'
    ));

comment on column public.uniplug_household_events.event_type is
  'Code-free VeriFy audit event, including explicit Netflix Household confirmation outcomes.';
