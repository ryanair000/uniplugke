-- Support is available to every authenticated user with an active UniPlug profile.
-- Do not depend on client_subscriptions visibility here: that table intentionally
-- hides credentials while a portal password-change flag is pending.

create or replace function public.is_uniplug_support_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.uniplug_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.status = 'active'
  );
$$;

revoke all on function public.is_uniplug_support_member() from public;
grant execute on function public.is_uniplug_support_member() to authenticated;

drop policy if exists "members create own support tickets"
  on public.uniplug_support_tickets;
create policy "members create own support tickets"
  on public.uniplug_support_tickets for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_uniplug_support_member())
  );
