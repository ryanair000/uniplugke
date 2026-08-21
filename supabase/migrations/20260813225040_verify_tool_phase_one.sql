-- VeriFy Phase 1 keeps mailbox credentials entirely outside the member Data API.
drop policy if exists "Authorized mailbox connection reads" on public.uniplug_mailbox_credentials;
drop policy if exists "Members read assigned Netflix mailbox connection" on public.uniplug_mailbox_credentials;
drop policy if exists "Admins read mailbox connection status" on public.uniplug_mailbox_credentials;

revoke all on public.uniplug_mailbox_credentials from public, anon, authenticated;
grant all on public.uniplug_mailbox_credentials to service_role;

alter table public.uniplug_household_events
  drop constraint if exists uniplug_household_events_event_type_check;

alter table public.uniplug_household_events
  add constraint uniplug_household_events_event_type_check
  check (event_type in (
    'assistant_opened',
    'code_requested',
    'code_found',
    'code_not_found',
    'mailbox_not_connected',
    'mailbox_check_failed',
    'rate_limited',
    'replacement_requested'
  ));

create index if not exists uniplug_household_events_rate_limit_idx
  on public.uniplug_household_events(user_id, client_subscription_id, event_type, created_at desc);

comment on table public.uniplug_mailbox_credentials is
  'Server-only encrypted Gmail app passwords. Browser and authenticated Data API access is revoked.';
