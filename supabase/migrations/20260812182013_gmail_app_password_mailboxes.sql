-- Gmail app passwords are encrypted by the application before storage.
create table if not exists public.uniplug_mailbox_credentials (
  mailbox_email text primary key,
  provider text not null default 'gmail' check (provider = 'gmail'),
  encrypted_app_password text not null check (char_length(encrypted_app_password) >= 40),
  connected_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint uniplug_mailbox_credentials_email_check
    check (mailbox_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

alter table public.uniplug_mailbox_credentials enable row level security;
revoke all on public.uniplug_mailbox_credentials from public, anon, authenticated;
grant select on public.uniplug_mailbox_credentials to authenticated;
grant all on public.uniplug_mailbox_credentials to service_role;

-- Members may receive only the encrypted secret for the Netflix mailbox currently
-- assigned to one of their subscriptions. Decryption remains server-only.
create policy "Members read assigned Netflix mailbox connection"
on public.uniplug_mailbox_credentials
for select
to authenticated
using (
  exists (
    select 1
    from public.client_subscriptions cs
    join public.client_portal_accounts cpa on cpa.client_id = cs.client_id
    where cpa.user_id = (select auth.uid())
      and lower(cs.account_reference) = lower(uniplug_mailbox_credentials.mailbox_email)
      and lower(coalesce(cs.service_identifier, '')) like '%netflix%'
      and cs.status in ('active', 'due_soon', 'trial')
  )
);

create policy "Admins read mailbox connection status"
on public.uniplug_mailbox_credentials
for select
to authenticated
using (
  exists (
    select 1
    from public.uniplug_profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'admin'
      and p.status = 'active'
  )
);

comment on table public.uniplug_mailbox_credentials is
  'Encrypted server-side Gmail app passwords used for Netflix temporary viewing codes.';
