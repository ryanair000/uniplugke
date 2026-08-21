-- Avoid evaluating two permissive SELECT policies for active administrators.
-- Active admins already read through the member policy; these policies retain
-- their write access without adding a second SELECT path.

drop policy if exists "admins manage duration offers"
  on public.uniplug_plan_duration_offers;

drop policy if exists "admins insert duration offers"
  on public.uniplug_plan_duration_offers;
create policy "admins insert duration offers"
  on public.uniplug_plan_duration_offers
  for insert to authenticated
  with check (public.is_uniplug_admin());

drop policy if exists "admins update duration offers"
  on public.uniplug_plan_duration_offers;
create policy "admins update duration offers"
  on public.uniplug_plan_duration_offers
  for update to authenticated
  using (public.is_uniplug_admin())
  with check (public.is_uniplug_admin());

drop policy if exists "admins delete duration offers"
  on public.uniplug_plan_duration_offers;
create policy "admins delete duration offers"
  on public.uniplug_plan_duration_offers
  for delete to authenticated
  using (public.is_uniplug_admin());
