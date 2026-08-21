-- A regular UniPlug shop account is not automatically a VIP member. VIP data
-- access requires an administrator account or a Lokimax portal link with at
-- least one tracked service, matching the application-level host routing.
create or replace function public.is_uniplug_member()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.uniplug_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.status = 'active'
      and (
        profile.role = 'admin'
        or exists (
          select 1
          from public.client_portal_accounts portal
          join public.client_subscriptions subscription
            on subscription.client_id = portal.client_id
          where portal.user_id = profile.user_id
        )
      )
  );
$$;

revoke all on function public.is_uniplug_member() from public, anon;
grant execute on function public.is_uniplug_member() to authenticated;
