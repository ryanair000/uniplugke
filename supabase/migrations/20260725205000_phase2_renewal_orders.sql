-- Phase 2: renewal orders extend an existing subscription instead of creating duplicates.

alter table public.uniplug_member_order_items
  add column if not exists renewal_subscription_id uuid
  references public.uniplug_member_subscriptions(id) on delete set null;

create index if not exists uniplug_member_order_items_renewal_idx
  on public.uniplug_member_order_items(renewal_subscription_id)
  where renewal_subscription_id is not null;

create or replace function public.uniplug_create_renewal_order(
  p_subscription_id uuid,
  p_phone text
)
returns table(order_id uuid, order_number text, paystack_reference text, total_kes numeric, customer_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_service_id uuid;
  v_plan_id uuid;
  v_service_name text;
  v_plan_name text;
  v_billing_cycle text;
  v_price numeric(12,2);
  v_order_id uuid;
  v_order_number text;
  v_reference text;
begin
  if v_user_id is null or not public.is_uniplug_member() then
    raise exception 'Active UniPlug membership is required';
  end if;
  if length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9 then
    raise exception 'A valid phone number is required';
  end if;

  select pr.email, s.service_id, s.plan_id, c.name, p.plan_name, p.billing_cycle, p.price_kes
  into v_email, v_service_id, v_plan_id, v_service_name, v_plan_name, v_billing_cycle, v_price
  from public.uniplug_member_subscriptions s
  join public.uniplug_profiles pr on pr.user_id = s.user_id and pr.status = 'active'
  join public.uniplug_member_plans p on p.id = s.plan_id and p.is_active and p.availability_status <> 'unavailable'
  join public.uniplug_catalog_services c on c.id = s.service_id and c.is_active
  where s.id = p_subscription_id
    and s.user_id = v_user_id
    and s.status in ('active','past_due','paused','expired');

  if not found then raise exception 'This subscription is not currently eligible for renewal'; end if;

  v_order_number := 'UNI-R-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_reference := 'UP-R-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 22));

  insert into public.uniplug_member_orders(
    order_number,user_id,customer_email,customer_phone,subtotal_kes,total_kes,paystack_reference
  ) values (
    v_order_number,v_user_id,v_email,p_phone,v_price,v_price,v_reference
  ) returning id into v_order_id;

  insert into public.uniplug_member_order_items(
    order_id,plan_id,service_id,service_name,plan_name,billing_cycle,unit_price_kes,renewal_subscription_id
  ) values (
    v_order_id,v_plan_id,v_service_id,v_service_name,v_plan_name,v_billing_cycle,v_price,p_subscription_id
  );

  return query select v_order_id,v_order_number,v_reference,v_price,v_email;
end;
$$;

revoke all on function public.uniplug_create_renewal_order(uuid,text) from public;
grant execute on function public.uniplug_create_renewal_order(uuid,text) to authenticated;

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

revoke all on function public.uniplug_activate_member_order(uuid) from public;
grant execute on function public.uniplug_activate_member_order(uuid) to authenticated;

create or replace function public.uniplug_log_subscription_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
    values(new.user_id,'subscription_created','Service added to My UniPlug','Activation and renewal information is now available in your dashboard.','subscription',new.id);
  elsif old.current_period_end is distinct from new.current_period_end and new.current_period_end > coalesce(old.current_period_end, '-infinity'::timestamptz) then
    insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
    values(new.user_id,'subscription_status','Renewal applied','Your service period was extended to ' || to_char(new.current_period_end, 'DD Mon YYYY') || '.','subscription',new.id);
  elsif old.status is distinct from new.status then
    insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
    values(new.user_id,'subscription_status','Subscription status updated','The service status is now ' || replace(new.status, '_', ' ') || '.','subscription',new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists uniplug_member_subscription_events on public.uniplug_member_subscriptions;
create trigger uniplug_member_subscription_events
after insert or update of status,current_period_end on public.uniplug_member_subscriptions
for each row execute function public.uniplug_log_subscription_event();
