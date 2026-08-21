-- Purchase terms are selected independently from the monthly base plan.
-- This keeps one private price per service while supporting prepaid terms.

alter table public.uniplug_member_order_items
  add column duration_months integer;

update public.uniplug_member_order_items
set duration_months = case billing_cycle
  when 'yearly' then 12
  when 'quarterly' then 3
  else 1
end
where duration_months is null;

alter table public.uniplug_member_order_items
  alter column duration_months set default 1,
  alter column duration_months set not null,
  add constraint uniplug_member_order_items_duration_months_check
    check (duration_months in (1, 3, 6, 12, 36));

alter table public.uniplug_member_subscriptions
  add column duration_months integer;

update public.uniplug_member_subscriptions s
set duration_months = case p.billing_cycle
  when 'yearly' then 12
  when 'quarterly' then 3
  else 1
end
from public.uniplug_member_plans p
where p.id = s.plan_id
  and s.duration_months is null;

update public.uniplug_member_subscriptions
set duration_months = 1
where duration_months is null;

alter table public.uniplug_member_subscriptions
  alter column duration_months set default 1,
  alter column duration_months set not null,
  add constraint uniplug_member_subscriptions_duration_months_check
    check (duration_months in (1, 3, 6, 12, 36));

create or replace function public.uniplug_create_member_order_v2(
  p_selections jsonb,
  p_phone text
)
returns table(
  order_id uuid,
  order_number text,
  paystack_reference text,
  total_kes numeric,
  customer_email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_total numeric(12,2);
  v_count integer;
  v_selection_count integer;
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
  if coalesce(jsonb_typeof(p_selections), '') <> 'array' then
    raise exception 'Plan selections must be an array';
  end if;

  v_selection_count := jsonb_array_length(p_selections);
  if v_selection_count < 1 or v_selection_count > 20 then
    raise exception 'Select between one and twenty plans';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_selections) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or coalesce(item.value->>'planId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(item.value->>'durationMonths', '') not in ('3', '6', '12', '36')
  ) then
    raise exception 'Every plan requires a valid duration';
  end if;

  if (
    select count(distinct item.value->>'planId')
    from jsonb_array_elements(p_selections) as item(value)
  ) <> v_selection_count then
    raise exception 'A plan can only be selected once';
  end if;

  select pr.email into v_email
  from public.uniplug_profiles pr
  where pr.user_id = v_user_id
    and pr.status = 'active';

  select count(*), coalesce(sum(p.price_kes * (item.value->>'durationMonths')::integer), 0)
  into v_count, v_total
  from jsonb_array_elements(p_selections) as item(value)
  join public.uniplug_member_plans p
    on p.id = (item.value->>'planId')::uuid
   and p.is_active
   and p.availability_status <> 'unavailable';

  if v_count <> v_selection_count then
    raise exception 'One or more plans are unavailable';
  end if;

  v_order_number := 'UNI-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_reference := 'UP-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24));

  insert into public.uniplug_member_orders(
    order_number,
    user_id,
    customer_email,
    customer_phone,
    subtotal_kes,
    total_kes,
    paystack_reference
  ) values (
    v_order_number,
    v_user_id,
    v_email,
    p_phone,
    v_total,
    v_total,
    v_reference
  )
  returning id into v_order_id;

  insert into public.uniplug_member_order_items(
    order_id,
    plan_id,
    service_id,
    service_name,
    plan_name,
    billing_cycle,
    duration_months,
    unit_price_kes
  )
  select
    v_order_id,
    p.id,
    p.service_id,
    s.name,
    p.plan_name,
    p.billing_cycle,
    (item.value->>'durationMonths')::integer,
    p.price_kes * (item.value->>'durationMonths')::integer
  from jsonb_array_elements(p_selections) as item(value)
  join public.uniplug_member_plans p on p.id = (item.value->>'planId')::uuid
  join public.uniplug_catalog_services s on s.id = p.service_id;

  return query
    select v_order_id, v_order_number, v_reference, v_total, v_email;
end;
$$;

revoke all on function public.uniplug_create_member_order_v2(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.uniplug_create_member_order_v2(jsonb, text)
  to authenticated;

create or replace function public.uniplug_create_renewal_order(
  p_subscription_id uuid,
  p_phone text
)
returns table(
  order_id uuid,
  order_number text,
  paystack_reference text,
  total_kes numeric,
  customer_email text
)
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
  v_duration_months integer;
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

  select
    pr.email,
    s.service_id,
    s.plan_id,
    c.name,
    p.plan_name,
    p.billing_cycle,
    s.duration_months,
    p.price_kes * s.duration_months
  into
    v_email,
    v_service_id,
    v_plan_id,
    v_service_name,
    v_plan_name,
    v_billing_cycle,
    v_duration_months,
    v_price
  from public.uniplug_member_subscriptions s
  join public.uniplug_profiles pr
    on pr.user_id = s.user_id
   and pr.status = 'active'
  join public.uniplug_member_plans p
    on p.id = s.plan_id
   and p.is_active
   and p.availability_status <> 'unavailable'
  join public.uniplug_catalog_services c
    on c.id = s.service_id
   and c.is_active
  where s.id = p_subscription_id
    and s.user_id = v_user_id
    and s.status in ('active', 'past_due', 'paused', 'expired');

  if not found then
    raise exception 'This subscription is not currently eligible for renewal';
  end if;

  v_order_number := 'UNI-R-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_reference := 'UP-R-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 22));

  insert into public.uniplug_member_orders(
    order_number,
    user_id,
    customer_email,
    customer_phone,
    subtotal_kes,
    total_kes,
    paystack_reference
  ) values (
    v_order_number,
    v_user_id,
    v_email,
    p_phone,
    v_price,
    v_price,
    v_reference
  )
  returning id into v_order_id;

  insert into public.uniplug_member_order_items(
    order_id,
    plan_id,
    service_id,
    service_name,
    plan_name,
    billing_cycle,
    duration_months,
    unit_price_kes,
    renewal_subscription_id
  ) values (
    v_order_id,
    v_plan_id,
    v_service_id,
    v_service_name,
    v_plan_name,
    v_billing_cycle,
    v_duration_months,
    v_price,
    p_subscription_id
  );

  return query
    select v_order_id, v_order_number, v_reference, v_price, v_email;
end;
$$;

revoke all on function public.uniplug_create_renewal_order(uuid, text)
  from public, anon, authenticated;
grant execute on function public.uniplug_create_renewal_order(uuid, text)
  to authenticated;

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
  if not public.is_uniplug_admin() then
    raise exception 'Admin access is required';
  end if;

  select * into v_order
  from public.uniplug_member_orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status <> 'paid' then
    raise exception 'Only a paid order can be activated';
  end if;
  if v_order.fulfillment_status in ('active', 'completed') then
    return 0;
  end if;

  with renewed as (
    update public.uniplug_member_subscriptions s
    set status = 'active',
        start_at = coalesce(s.start_at, now()),
        duration_months = i.duration_months,
        current_period_end =
          greatest(coalesce(s.current_period_end, now()), now()) +
          make_interval(months => i.duration_months),
        updated_at = now()
    from public.uniplug_member_order_items i
    where i.order_id = v_order.id
      and i.renewal_subscription_id = s.id
      and s.user_id = v_order.user_id
    returning s.id
  )
  select count(*) into v_renewed from renewed;

  insert into public.uniplug_member_subscriptions(
    user_id,
    service_id,
    plan_id,
    order_item_id,
    status,
    start_at,
    current_period_end,
    duration_months
  )
  select
    v_order.user_id,
    i.service_id,
    i.plan_id,
    i.id,
    'active',
    now(),
    now() + make_interval(months => i.duration_months),
    i.duration_months
  from public.uniplug_member_order_items i
  where i.order_id = v_order.id
    and i.renewal_subscription_id is null
  on conflict (order_item_id) do update
  set status = 'active',
      start_at = coalesce(public.uniplug_member_subscriptions.start_at, excluded.start_at),
      current_period_end = excluded.current_period_end,
      duration_months = excluded.duration_months,
      updated_at = now();

  get diagnostics v_created = row_count;

  update public.uniplug_member_orders
  set fulfillment_status = 'active',
      updated_at = now()
  where id = v_order.id;

  return v_renewed + v_created;
end;
$$;

revoke all on function public.uniplug_activate_member_order(uuid)
  from public, anon, authenticated;
grant execute on function public.uniplug_activate_member_order(uuid)
  to authenticated;
