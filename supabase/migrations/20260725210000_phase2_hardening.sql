-- Phase 2 hardening: make paid-order activation idempotent, keep privileged
-- RPCs out of the anonymous API surface, and require validated profile writes.

revoke update on public.uniplug_profiles from authenticated;
revoke update(display_name,username,phone,renewal_reminders_enabled,marketing_opt_in)
  on public.uniplug_profiles from authenticated;

revoke all on function public.uniplug_update_member_profile(text,text,text,boolean,boolean) from public, anon;
revoke all on function public.uniplug_request_subscription_action(uuid,text,text) from public, anon;
revoke all on function public.uniplug_resolve_subscription_request(uuid,text,text) from public, anon;
revoke all on function public.uniplug_set_member_status(uuid,text) from public, anon;
revoke all on function public.uniplug_record_password_update() from public, anon;

grant execute on function public.uniplug_update_member_profile(text,text,text,boolean,boolean) to authenticated;
grant execute on function public.uniplug_request_subscription_action(uuid,text,text) to authenticated;
grant execute on function public.uniplug_resolve_subscription_request(uuid,text,text) to authenticated;
grant execute on function public.uniplug_set_member_status(uuid,text) to authenticated;
grant execute on function public.uniplug_record_password_update() to authenticated;

create or replace function public.uniplug_activate_member_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.uniplug_member_orders%rowtype;
  v_renewed integer := 0;
  v_created integer := 0;
begin
  if not public.is_uniplug_admin() then raise exception 'Admin access is required'; end if;

  select * into v_order
  from public.uniplug_member_orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'Only a paid order can be activated'; end if;
  if v_order.fulfillment_status in ('active', 'completed') then return 0; end if;

  with renewed as (
    update public.uniplug_member_subscriptions s
    set status = 'active',
        start_at = coalesce(s.start_at, now()),
        current_period_end = greatest(coalesce(s.current_period_end, now()), now()) +
          case i.billing_cycle
            when 'yearly' then interval '1 year'
            when 'quarterly' then interval '3 months'
            else interval '1 month'
          end,
        updated_at = now()
    from public.uniplug_member_order_items i
    where i.order_id = v_order.id
      and i.renewal_subscription_id = s.id
      and s.user_id = v_order.user_id
    returning s.id
  )
  select count(*) into v_renewed from renewed;

  insert into public.uniplug_member_subscriptions(
    user_id,service_id,plan_id,order_item_id,status,start_at,current_period_end
  )
  select
    v_order.user_id,
    i.service_id,
    i.plan_id,
    i.id,
    'active',
    now(),
    case i.billing_cycle
      when 'yearly' then now() + interval '1 year'
      when 'quarterly' then now() + interval '3 months'
      else now() + interval '1 month'
    end
  from public.uniplug_member_order_items i
  where i.order_id = v_order.id
    and i.renewal_subscription_id is null
  on conflict (order_item_id) do update
  set status = 'active',
      start_at = coalesce(public.uniplug_member_subscriptions.start_at, excluded.start_at),
      current_period_end = excluded.current_period_end,
      updated_at = now();

  get diagnostics v_created = row_count;

  update public.uniplug_member_orders
  set fulfillment_status = 'active', updated_at = now()
  where id = v_order.id;

  return v_renewed + v_created;
end;
$$;

revoke all on function public.uniplug_activate_member_order(uuid) from public, anon;
grant execute on function public.uniplug_activate_member_order(uuid) to authenticated;
