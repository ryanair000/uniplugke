-- A subscription renewal belongs to the client. The assigned slot expiry is
-- operational account-pool metadata and can legitimately lag behind it.
-- Patch the existing normalized sync function without duplicating its large,
-- security-reviewed body, then rebuild every portal projection.
do $migration$
declare
  v_definition text;
  v_old_precedence constant text := E'v_next_renewal_date := coalesce(\n      v_slot_renewal_date,\n      v_item_renewal_date,\n      v_row.renewal_date\n    );';
  v_new_precedence constant text := E'v_next_renewal_date := coalesce(\n      v_item_renewal_date,\n      v_slot_renewal_date,\n      v_row.renewal_date\n    );';
begin
  select pg_get_functiondef('public.hub_sync_subscription(uuid)'::regprocedure)
  into v_definition;

  if strpos(v_definition, v_new_precedence) > 0 then
    return;
  end if;

  if strpos(v_definition, v_old_precedence) = 0 then
    raise exception 'hub_sync_subscription renewal precedence block was not found';
  end if;

  execute replace(v_definition, v_old_precedence, v_new_precedence);
end;
$migration$;

comment on function public.hub_sync_subscription(uuid) is
  'Projects Lokimax subscriptions into the UniPlug portal; explicit per-client item renewal dates take precedence over assigned slot expiry dates.';

-- Repair existing rows immediately. The sync is idempotent and also reconciles
-- the associated client_renewals row and derived subscription status.
do $$
declare
  v_source record;
begin
  for v_source in select id from public.subscriptions order by created_at, id
  loop
    perform public.hub_sync_subscription(v_source.id);
  end loop;
end;
$$;

-- Fail the migration atomically if any visible projection still disagrees with
-- the precedence used by hub_sync_subscription.
do $$
declare
  v_mismatches bigint;
begin
  with source_items as (
    select
      source.id as source_id,
      source.renewal_date as source_renewal_date,
      source.status as source_status,
      source.slot_id as source_slot_id,
      item.value as item,
      item.ordinality::integer as item_index
    from public.subscriptions as source
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(public.hub_try_jsonb(source.service_type)) = 'array'
          and jsonb_array_length(public.hub_try_jsonb(source.service_type)) > 0
        then public.hub_try_jsonb(source.service_type)
        else jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'slot_id', source.slot_id,
          'renewal_date', source.renewal_date
        )))
      end
    ) with ordinality as item(value, ordinality)
  ), expected as (
    select
      source_items.source_id,
      source_items.item_index,
      coalesce(
        public.hub_try_date(source_items.item->>'renewal_date'),
        slot.expiry_date,
        source_items.source_renewal_date
      ) as renewal_date,
      public.hub_source_subscription_status(
        coalesce(slot.status, source_items.source_status),
        coalesce(
          public.hub_try_date(source_items.item->>'renewal_date'),
          slot.expiry_date,
          source_items.source_renewal_date
        )
      ) as subscription_status
    from source_items
    left join public.slots as slot
      on slot.id = case
        when source_items.item_index = 1 then coalesce(
          public.hub_try_uuid(source_items.item->>'slot_id'),
          source_items.source_slot_id
        )
        else public.hub_try_uuid(source_items.item->>'slot_id')
      end
  )
  select count(*)
  into v_mismatches
  from expected
  join public.client_subscriptions as hub
    on hub.metadata->>'legacy_table' = 'subscriptions'
   and hub.metadata->>'legacy_id' = expected.source_id::text
   and coalesce((hub.metadata->>'bundle_item_index')::integer, 1) = expected.item_index
   and coalesce(hub.metadata->>'portal_hidden', 'false') <> 'true'
  where hub.next_renewal_date is distinct from expected.renewal_date
     or hub.status is distinct from expected.subscription_status;

  if v_mismatches > 0 then
    raise exception 'Lokimax portal renewal sync left % mismatched projections',
      v_mismatches;
  end if;
end;
$$;
