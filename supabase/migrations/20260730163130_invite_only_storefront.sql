-- Make the entire UniPlug storefront invitation-only at the data boundary.
-- The application request proxy separately redirects non-members to /login.
drop policy if exists "guest reads active uniplug catalog"
  on public.uniplug_catalog_services;
drop policy if exists "active members read uniplug catalog"
  on public.uniplug_catalog_services;

create policy "active members read uniplug catalog"
  on public.uniplug_catalog_services
  for select
  to authenticated
  using (is_active and (select public.is_uniplug_member()));

revoke all on public.uniplug_catalog_services from anon;
grant select on public.uniplug_catalog_services to authenticated;

comment on column public.uniplug_catalog_services.starting_price_usd is
  'Legacy merchandising value retained for compatibility. The private storefront derives the displayed USD equivalent from the authoritative KSh member-plan price.';
