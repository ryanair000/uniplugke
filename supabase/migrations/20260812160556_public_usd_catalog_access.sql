-- Visitors may browse active catalog entries and their deliberately public USD
-- starting prices. Exact KSh plan pricing remains protected in
-- uniplug_member_plans and is available only to active members.
drop policy if exists "guest reads active uniplug catalog"
  on public.uniplug_catalog_services;

create policy "guest reads active uniplug catalog"
  on public.uniplug_catalog_services
  for select
  to anon
  using (is_active);

grant select on public.uniplug_catalog_services to anon;

comment on column public.uniplug_catalog_services.starting_price_usd is
  'Public visitor-facing starting price in USD. This is not used for checkout.';
