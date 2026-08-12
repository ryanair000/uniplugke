-- Server-managed Gmail OAuth connections for Netflix temporary-access codes.
-- Refresh tokens are encrypted by the application before they reach Postgres.
create table if not exists public.uniplug_gmail_connections (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  mailbox_email text not null,
  encrypted_refresh_token text not null,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint uniplug_gmail_connections_mailbox_email_check
    check (mailbox_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint uniplug_gmail_connections_token_check
    check (char_length(encrypted_refresh_token) >= 40)
);

alter table public.uniplug_gmail_connections enable row level security;
revoke all on public.uniplug_gmail_connections from public, anon, authenticated;
grant all on public.uniplug_gmail_connections to service_role;

comment on table public.uniplug_gmail_connections is
  'Server-only encrypted Gmail OAuth refresh tokens for managed Netflix mailboxes.';

create table if not exists public.uniplug_household_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_subscription_id uuid not null references public.client_subscriptions(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  event_type text not null check (event_type in (
    'assistant_opened',
    'code_requested',
    'code_found',
    'code_not_found',
    'mailbox_not_connected',
    'replacement_requested'
  )),
  outcome text,
  created_at timestamptz not null default now()
);

create index if not exists uniplug_household_events_user_idx
  on public.uniplug_household_events(user_id, created_at desc);
create index if not exists uniplug_household_events_subscription_idx
  on public.uniplug_household_events(client_subscription_id, created_at desc);

alter table public.uniplug_household_events enable row level security;
revoke all on public.uniplug_household_events from public, anon, authenticated;
grant all on public.uniplug_household_events to service_role;

comment on table public.uniplug_household_events is
  'Server-only audit trail for Netflix Household assistance without persisting temporary codes.';
