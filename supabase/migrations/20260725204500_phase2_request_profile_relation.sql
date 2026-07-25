-- Phase 2: expose an explicit PostgREST relationship from requests to member profiles.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uniplug_subscription_requests_profile_fkey'
  ) then
    alter table public.uniplug_subscription_requests
      add constraint uniplug_subscription_requests_profile_fkey
      foreign key (user_id) references public.uniplug_profiles(user_id) on delete cascade;
  end if;
end $$;
