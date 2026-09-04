begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

-- Execute the status expression from the installed sync function, rather than
-- duplicating its precedence in a test helper. This fails with the old function.
create function pg_temp.project_status(client_status text, slot_status text, renewal date)
returns text language plpgsql as $$
declare
  expression text;
  result text;
begin
  expression := substring(
    pg_get_functiondef('public.hub_sync_subscription(uuid)'::regprocedure)
    from 'v_subscription_status := ([^;]+);'
  );
  if expression is null then
    raise exception 'Sync status expression not found';
  end if;
  expression := replace(expression, 'v_row.status', '$1');
  expression := replace(expression, 'v_slot_status', '$2');
  expression := replace(expression, 'v_next_renewal_date', '$3');
  execute 'select ' || expression into result using client_status, slot_status, renewal;
  return result;
end;
$$;

select is(pg_temp.project_status('active', 'expired', current_date + 30), 'active',
  'renewed Netflix remains active despite an expired inventory slot');
select is(pg_temp.project_status('active', 'inactive', current_date + 30), 'active',
  'inactive inventory does not expire paid client access');
select is(pg_temp.project_status('active', 'expired', current_date + 3), 'due_soon',
  'client renewal date still controls due-soon status');
select is(pg_temp.project_status('active', 'active', current_date - 1), 'expired',
  'past client renewal still expires access');
select is(pg_temp.project_status('cancelled', 'active', current_date + 30), 'cancelled',
  'active inventory cannot reactivate a cancelled client');
select is(pg_temp.project_status('paused', 'active', current_date + 30), 'paused',
  'active inventory cannot reactivate a paused client');
select is(pg_temp.project_status('expired', 'active', current_date + 30), 'expired',
  'explicit client expiry remains authoritative');
select is(pg_temp.project_status('active', null, current_date + 30), 'active',
  'subscriptions without a slot remain supported');

select * from finish();
rollback;
