-- Lokimax renew actions update the bundle's top-level renewal_date. Keep
-- every dated service in a multi-service bundle aligned by applying the same
-- day shift, while preserving intentional offsets between individual items.
-- Explicit service edits already submit a changed service_type payload and are
-- therefore left untouched.
create or replace function public.sync_single_service_subscription_metadata()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  payload jsonb;
  v_item_count integer;
  v_renewal_shift integer;
begin
  if new.service_type is null or btrim(new.service_type) = '' then
    return new;
  end if;

  begin
    payload := new.service_type::jsonb;
  exception when others then
    -- Legacy plain-text service values remain supported.
    return new;
  end;

  if jsonb_typeof(payload) <> 'array' then
    return new;
  end if;

  v_item_count := jsonb_array_length(payload);

  if v_item_count > 1 then
    if tg_op = 'UPDATE' then
      if new.renewal_date is distinct from old.renewal_date
         and new.renewal_date is not null
         and old.renewal_date is not null
         and new.service_type is not distinct from old.service_type then
        v_renewal_shift := new.renewal_date - old.renewal_date;

        select jsonb_agg(
          case
            when public.hub_try_date(item.value->>'renewal_date') is null
              then item.value
            else jsonb_set(
              item.value,
              '{renewal_date}',
              to_jsonb((
                public.hub_try_date(item.value->>'renewal_date')
                  + v_renewal_shift
              )::text),
              true
            )
          end
          order by item.ordinality
        )
        into payload
        from jsonb_array_elements(payload) with ordinality as item(value, ordinality);

        new.service_type := payload::text;
      end if;
    end if;

    return new;
  end if;

  if v_item_count <> 1 or jsonb_typeof(payload -> 0) <> 'object' then
    return new;
  end if;

  if new.renewal_date is not null then
    payload := jsonb_set(
      payload,
      '{0,renewal_date}',
      to_jsonb(new.renewal_date::text),
      true
    );
  end if;

  if nullif(btrim(coalesce(new.service_mail, '')), '') is not null then
    payload := jsonb_set(
      payload,
      '{0,service_mail}',
      to_jsonb(new.service_mail),
      true
    );
  end if;

  if new.account_id is not null then
    payload := jsonb_set(
      payload,
      '{0,account_id}',
      to_jsonb(new.account_id::text),
      true
    );
  end if;

  if new.slot_id is not null then
    payload := jsonb_set(
      payload,
      '{0,slot_id}',
      to_jsonb(new.slot_id::text),
      true
    );
  elsif (payload -> 0) ? 'slot_id' then
    payload := jsonb_set(payload, '{0,slot_id}', '""'::jsonb, true);
  end if;

  new.service_type := payload::text;
  return new;
end;
$$;

comment on function public.sync_single_service_subscription_metadata() is
  'Keeps single-service metadata authoritative and shifts nested multi-service renewal dates when a bundle is renewed.';

drop trigger if exists sync_single_service_subscription_metadata_before_write
  on public.subscriptions;

create trigger sync_single_service_subscription_metadata_before_write
before insert or update of service_type, service_mail, renewal_date, account_id, slot_id
on public.subscriptions
for each row
execute function public.sync_single_service_subscription_metadata();
