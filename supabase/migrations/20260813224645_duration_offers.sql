-- Server-authoritative prepaid offers for 1, 3, 6, 12 and 24 months.
-- Public visitors continue to see deliberately public USD merchandising prices;
-- exact KSh totals remain protected behind active-member RLS.

alter table public.uniplug_member_order_items
  drop constraint if exists uniplug_member_order_items_duration_months_check;
alter table public.uniplug_member_order_items
  add constraint uniplug_member_order_items_duration_months_check
  check (duration_months in (1, 3, 6, 12, 24, 36));

alter table public.uniplug_member_subscriptions
  drop constraint if exists uniplug_member_subscriptions_duration_months_check;
alter table public.uniplug_member_subscriptions
  add constraint uniplug_member_subscriptions_duration_months_check
  check (duration_months in (1, 3, 6, 12, 24, 36));

create table if not exists public.uniplug_plan_duration_offers (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.uniplug_member_plans(id) on delete cascade,
  duration_months integer not null check (duration_months in (1, 3, 6, 12, 24)),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 90),
  badge text check (badge is null or char_length(badge) between 1 and 40),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, duration_months)
);

comment on table public.uniplug_plan_duration_offers is
  'Protected prepaid duration discounts. Checkout derives totals from the plan monthly KSh price and these rows.';

create index if not exists uniplug_plan_duration_offers_plan_active_idx
  on public.uniplug_plan_duration_offers(plan_id, is_active, sort_order);

create or replace function public.uniplug_seed_plan_duration_offers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.uniplug_plan_duration_offers(
    plan_id, duration_months, discount_percent, badge, sort_order
  ) values
    (new.id, 1, 0, 'Most flexible', 10),
    (new.id, 3, 3, null, 20),
    (new.id, 6, 8, 'Popular', 30),
    (new.id, 12, 13, 'Best value', 40),
    (new.id, 24, 17, 'Lowest monthly', 50)
  on conflict (plan_id, duration_months) do nothing;
  return new;
end;
$$;

drop trigger if exists uniplug_seed_plan_duration_offers_trigger
  on public.uniplug_member_plans;
create trigger uniplug_seed_plan_duration_offers_trigger
after insert on public.uniplug_member_plans
for each row execute function public.uniplug_seed_plan_duration_offers();

insert into public.uniplug_plan_duration_offers(
  plan_id, duration_months, discount_percent, badge, sort_order
)
select plan.id, offer.duration_months, offer.discount_percent, offer.badge, offer.sort_order
from public.uniplug_member_plans plan
cross join (values
  (1, 0::numeric, 'Most flexible'::text, 10),
  (3, 3::numeric, null::text, 20),
  (6, 8::numeric, 'Popular'::text, 30),
  (12, 13::numeric, 'Best value'::text, 40),
  (24, 17::numeric, 'Lowest monthly'::text, 50)
) as offer(duration_months, discount_percent, badge, sort_order)
on conflict (plan_id, duration_months) do nothing;

alter table public.uniplug_plan_duration_offers enable row level security;

drop policy if exists "active members read duration offers"
  on public.uniplug_plan_duration_offers;
create policy "active members read duration offers"
  on public.uniplug_plan_duration_offers
  for select to authenticated
  using (
    is_active
    and public.is_uniplug_member()
    and exists (
      select 1 from public.uniplug_member_plans plan
      where plan.id = plan_id and plan.is_active
    )
  );

drop policy if exists "admins manage duration offers"
  on public.uniplug_plan_duration_offers;
create policy "admins manage duration offers"
  on public.uniplug_plan_duration_offers
  for all to authenticated
  using (public.is_uniplug_admin())
  with check (public.is_uniplug_admin());

revoke all on public.uniplug_plan_duration_offers from public, anon, authenticated;
grant select, insert, update, delete on public.uniplug_plan_duration_offers to authenticated;
grant all on public.uniplug_plan_duration_offers to service_role;
revoke all on function public.uniplug_seed_plan_duration_offers() from public, anon, authenticated;

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
      or coalesce(item.value->>'durationMonths', '') not in ('1', '3', '6', '12', '24')
  ) then
    raise exception 'Every plan requires a valid duration';
  end if;

  if (
    select count(distinct item.value->>'planId')
    from jsonb_array_elements(p_selections) as item(value)
  ) <> v_selection_count then
    raise exception 'A plan can only be selected once';
  end if;

  select profile.email into v_email
  from public.uniplug_profiles profile
  where profile.user_id = v_user_id and profile.status = 'active';

  select
    count(*),
    coalesce(sum(round(
      plan.price_kes * offer.duration_months * (1 - offer.discount_percent / 100),
      2
    )), 0)
  into v_count, v_total
  from jsonb_array_elements(p_selections) as item(value)
  join public.uniplug_member_plans plan
    on plan.id = (item.value->>'planId')::uuid
   and plan.is_active
   and plan.availability_status <> 'unavailable'
  join public.uniplug_plan_duration_offers offer
    on offer.plan_id = plan.id
   and offer.duration_months = (item.value->>'durationMonths')::integer
   and offer.is_active;

  if v_count <> v_selection_count then
    raise exception 'One or more selected offers are unavailable';
  end if;

  v_order_number := 'UNI-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_reference := 'UP-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24));

  insert into public.uniplug_member_orders(
    order_number, user_id, customer_email, customer_phone,
    subtotal_kes, total_kes, paystack_reference
  ) values (
    v_order_number, v_user_id, v_email, p_phone,
    v_total, v_total, v_reference
  ) returning id into v_order_id;

  insert into public.uniplug_member_order_items(
    order_id, plan_id, service_id, service_name, plan_name,
    billing_cycle, duration_months, unit_price_kes
  )
  select
    v_order_id,
    plan.id,
    plan.service_id,
    service.name,
    plan.plan_name,
    plan.billing_cycle,
    offer.duration_months,
    round(plan.price_kes * offer.duration_months * (1 - offer.discount_percent / 100), 2)
  from jsonb_array_elements(p_selections) as item(value)
  join public.uniplug_member_plans plan
    on plan.id = (item.value->>'planId')::uuid
  join public.uniplug_catalog_services service on service.id = plan.service_id
  join public.uniplug_plan_duration_offers offer
    on offer.plan_id = plan.id
   and offer.duration_months = (item.value->>'durationMonths')::integer
   and offer.is_active;

  return query select v_order_id, v_order_number, v_reference, v_total, v_email;
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
    profile.email,
    subscription.service_id,
    subscription.plan_id,
    catalog.name,
    plan.plan_name,
    plan.billing_cycle,
    subscription.duration_months,
    round(
      plan.price_kes * subscription.duration_months *
      (1 - coalesce(offer.discount_percent, 0) / 100),
      2
    )
  into
    v_email, v_service_id, v_plan_id, v_service_name, v_plan_name,
    v_billing_cycle, v_duration_months, v_price
  from public.uniplug_member_subscriptions subscription
  join public.uniplug_profiles profile
    on profile.user_id = subscription.user_id and profile.status = 'active'
  join public.uniplug_member_plans plan
    on plan.id = subscription.plan_id and plan.is_active
   and plan.availability_status <> 'unavailable'
  join public.uniplug_catalog_services catalog
    on catalog.id = subscription.service_id and catalog.is_active
  left join public.uniplug_plan_duration_offers offer
    on offer.plan_id = plan.id
   and offer.duration_months = subscription.duration_months
   and offer.is_active
  where subscription.id = p_subscription_id
    and subscription.user_id = v_user_id
    and subscription.status in ('active', 'past_due', 'paused', 'expired');

  if not found then
    raise exception 'This subscription is not currently eligible for renewal';
  end if;

  v_order_number := 'UNI-R-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_reference := 'UP-R-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 22));

  insert into public.uniplug_member_orders(
    order_number, user_id, customer_email, customer_phone,
    subtotal_kes, total_kes, paystack_reference
  ) values (
    v_order_number, v_user_id, v_email, p_phone,
    v_price, v_price, v_reference
  ) returning id into v_order_id;

  insert into public.uniplug_member_order_items(
    order_id, plan_id, service_id, service_name, plan_name,
    billing_cycle, duration_months, unit_price_kes, renewal_subscription_id
  ) values (
    v_order_id, v_plan_id, v_service_id, v_service_name, v_plan_name,
    v_billing_cycle, v_duration_months, v_price, p_subscription_id
  );

  return query select v_order_id, v_order_number, v_reference, v_price, v_email;
end;
$$;

revoke all on function public.uniplug_create_renewal_order(uuid, text)
  from public, anon, authenticated;
grant execute on function public.uniplug_create_renewal_order(uuid, text)
  to authenticated;
