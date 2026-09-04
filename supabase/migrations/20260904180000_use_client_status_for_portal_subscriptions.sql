-- Slot status describes shared inventory, not a customer's paid entitlement.
-- A renewed Netflix client must not disappear because the assigned slot still
-- says expired. Keep renewal-date expiry and explicit client cancellation.
do $migration$
declare
  v_definition text;
  v_old constant text := 'coalesce(v_slot_status, v_row.status)';
  v_new constant text := 'v_row.status /* client status, independent of slot inventory */';
begin
  select pg_get_functiondef('public.hub_sync_subscription(uuid)'::regprocedure)
    into v_definition;
  if strpos(v_definition, v_new) > 0 then
    return;
  end if;
  if strpos(v_definition, v_old) = 0 then
    raise exception 'hub_sync_subscription slot-status precedence block was not found';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$migration$;

-- Rebuild affected projections through the normal sync so renewal records agree
-- too. Preserve the existing IDs, ownership, account assignments and history.
do $repair$
declare
  v_source record;
begin
  for v_source in
    select distinct source.id
    from public.subscriptions as source
    join public.client_subscriptions as hub
      on hub.metadata->>'legacy_table' = 'subscriptions'
     and hub.metadata->>'legacy_id' = source.id::text
    where coalesce(hub.metadata->>'portal_hidden', 'false') <> 'true'
      and hub.status is distinct from
        public.hub_source_subscription_status(source.status, hub.next_renewal_date)
  loop
    perform public.hub_sync_subscription(v_source.id);
  end loop;

  if exists (
    select 1
    from public.subscriptions as source
    join public.client_subscriptions as hub
      on hub.metadata->>'legacy_table' = 'subscriptions'
     and hub.metadata->>'legacy_id' = source.id::text
    where coalesce(hub.metadata->>'portal_hidden', 'false') <> 'true'
      and hub.status is distinct from
        public.hub_source_subscription_status(source.status, hub.next_renewal_date)
  ) then
    raise exception 'Portal subscription statuses still disagree with client entitlements';
  end if;
end;
$repair$;
