drop policy if exists "Members read assigned Netflix mailbox connection" on public.uniplug_mailbox_credentials;
drop policy if exists "Admins read mailbox connection status" on public.uniplug_mailbox_credentials;

create policy "Authorized mailbox connection reads"
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
  or exists (
    select 1
    from public.uniplug_profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'admin'
      and p.status = 'active'
  )
);
