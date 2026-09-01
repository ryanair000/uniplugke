-- Make Lokimax's active subscription catalog the single source of truth for
-- the UniPlug storefront. Store exact term prices; never derive them from a
-- monthly price or a percentage discount.
begin;

alter table public.uniplug_member_plans
  add column if not exists catalog_id uuid references public.catalog(id) on delete restrict;

create unique index if not exists uniplug_member_plans_active_catalog_idx
  on public.uniplug_member_plans(catalog_id) where is_active and catalog_id is not null;

alter table public.uniplug_plan_duration_offers
  add column if not exists price_kes numeric(12,2);

alter table public.uniplug_plan_duration_offers
  drop constraint if exists uniplug_plan_duration_offers_duration_months_check;
alter table public.uniplug_plan_duration_offers
  add constraint uniplug_plan_duration_offers_duration_months_check
  check (duration_months in (1,3,6,12,24,36));

alter table public.uniplug_member_order_items
  add column if not exists catalog_id uuid references public.catalog(id) on delete set null,
  add column if not exists list_price_kes numeric(12,2),
  add column if not exists price_source text not null default 'legacy_plan_price';

alter table public.uniplug_catalog_services
  drop constraint if exists uniplug_catalog_services_category_slug_check;
alter table public.uniplug_catalog_services
  add constraint uniplug_catalog_services_category_slug_check
  check (category_slug in ('streaming','sports','music','creative','ai','productivity','cloud','security','gaming','learning'));

-- The old trigger created five invented discounted terms for every new plan.
drop trigger if exists uniplug_seed_plan_duration_offers_trigger on public.uniplug_member_plans;
drop trigger if exists seed_plan_duration_offers on public.uniplug_member_plans;

create or replace function public.uniplug_storefront_slug(value text)
returns text language sql immutable strict as $$
  select trim(both '-' from regexp_replace(lower(value), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.uniplug_sync_catalog_product(p_catalog_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.catalog%rowtype;
  v_service_id uuid;
  v_plan_id uuid;
  v_public_name text;
  v_slug text;
  v_plan_name text;
  v_category text;
  v_base_price numeric;
  v_first_months integer;
  term record;
begin
  select * into c from public.catalog where id=p_catalog_id;
  if not found then return; end if;

  if c.deleted_at is not null or coalesce(c.pricing_status,'inactive') <> 'active'
     or greatest(coalesce(c.selling_price_1_month,0),coalesce(c.selling_price_3_months,0),
       coalesce(c.selling_price_6_months,0),coalesce(c.selling_price_1_year,0),
       coalesce(c.selling_price_2_years,0),coalesce(c.selling_price_3_years,0)) <= 0 then
    select service_id into v_service_id from public.uniplug_member_plans where catalog_id=c.id limit 1;
    update public.uniplug_member_plans set is_active=false,availability_status='unavailable',updated_at=now()
    where catalog_id=c.id;
    if v_service_id is not null and not exists (
      select 1 from public.uniplug_member_plans p where p.service_id=v_service_id and p.is_active
    ) then
      update public.uniplug_catalog_services set is_active=false,updated_at=now() where id=v_service_id;
    end if;
    return;
  end if;

  v_public_name := case when lower(c.name) like 'dstv%' then 'Live Stream (Sports)' else c.name end;
  v_slug := case when lower(c.name) like 'dstv%' then 'live-stream-sports'
    when lower(c.name)='netflix' then 'netflix'
    else public.uniplug_storefront_slug(c.name) end;
  v_plan_name := case when lower(c.name) like 'dstv%' then coalesce(nullif(c.plan,''),regexp_replace(c.name,'^DStv\s*','','i'))
    else coalesce(nullif(c.plan,''),'Standard') end;
  v_category := case
    when upper(coalesce(c.subscription_group,''))='DSTV' then 'sports'
    when upper(coalesce(c.subscription_group,'')) like 'VPN,%' then 'security'
    when upper(coalesce(c.subscription_group,'')) like 'MUSIC,%' then 'music'
    when upper(coalesce(c.subscription_group,'')) like 'AI &%' then 'ai'
    when upper(coalesce(c.subscription_group,'')) like 'GAMING &%' then 'gaming'
    when upper(coalesce(c.subscription_group,'')) like 'CREATIVE,%' then 'creative'
    when upper(coalesce(c.subscription_group,'')) like 'PRODUCTIVITY,%' then 'productivity'
    when upper(coalesce(c.subscription_group,'')) like 'EDUCATION &%' then 'learning'
    when upper(coalesce(c.subscription_group,''))='SPORTS' then 'sports'
    when lower(c.name) ~ 'cloud|drive|dropbox|icloud|google one' then 'cloud'
    else 'streaming' end;

  select id into v_service_id from public.uniplug_catalog_services
  where slug=v_slug or lower(name)=lower(v_public_name)
     or (lower(c.name)='netflix' and slug='netflix-premium')
  order by case when slug=v_slug then 0 else 1 end limit 1;

  if v_service_id is null then
    insert into public.uniplug_catalog_services(
      slug,category_slug,name,short_description,description,logo_text,accent_color,
      features,supported_devices,setup_requirements,fulfillment_label,activation_window,
      replacement_summary,faqs,availability_status,is_featured,is_active,sort_order,starting_price_usd
    ) values (
      v_slug,v_category,v_public_name,
      v_public_name||' prepaid access with exact catalogue pricing and renewal tracking.',
      coalesce(nullif(c.description,''),'Choose an available package and prepaid period. Access and support are managed through your UniPlug account.'),
      upper(left(v_public_name,2)),'#6957ff',
      jsonb_build_array('Exact prepaid pricing','Renewal tracking','Member support'),
      jsonb_build_array('Mobile','Browser','Compatible devices'),
      jsonb_build_array('A supported account and device','Stable internet connection'),
      'Managed access','Usually activated after order verification',
      'Eligible access issues can be reported from the member dashboard.',
      jsonb_build_array(jsonb_build_object('question','How is pricing calculated?','answer','Each displayed period uses the exact current catalogue price.')),
      'available',coalesce(c.is_featured,false),true,coalesce(c.featured_order,0),1
    ) returning id into v_service_id;
  else
    update public.uniplug_catalog_services set
      slug=v_slug,category_slug=v_category,name=v_public_name,availability_status='available',is_active=true,
      is_featured=coalesce(c.is_featured,false),updated_at=now()
    where id=v_service_id;
  end if;

  select id into v_plan_id from public.uniplug_member_plans where catalog_id=c.id order by is_active desc limit 1;
  if v_plan_id is null and lower(c.name) not like 'dstv%' then
    select id into v_plan_id from public.uniplug_member_plans
    where service_id=v_service_id and catalog_id is null order by is_active desc,created_at limit 1;
  end if;

  select price,months into v_base_price,v_first_months from (values
    (c.selling_price_1_month,1),(c.selling_price_3_months,3),(c.selling_price_6_months,6),
    (c.selling_price_1_year,12),(c.selling_price_2_years,24),(c.selling_price_3_years,36)
  ) t(price,months) where price>0 order by months limit 1;

  if v_plan_id is null then
    insert into public.uniplug_member_plans(service_id,catalog_id,plan_name,plan_code,price_kes,billing_cycle,
      plan_features,purchase_limit,availability_status,is_active,sort_order)
    values(v_service_id,c.id,v_plan_name,v_slug||'-'||left(replace(c.id::text,'-',''),8),v_base_price,
      case when v_first_months=12 then 'yearly' when v_first_months=3 then 'quarterly' else 'monthly' end,
      jsonb_build_array('Prepaid access','Exact catalogue price'),1,'available',true,
      case v_plan_name when 'Compact' then 1 when 'Compact Plus' then 2 when 'Premium' then 3 else coalesce(c.featured_order,0) end)
    returning id into v_plan_id;
  else
    update public.uniplug_member_plans set service_id=v_service_id,catalog_id=c.id,plan_name=v_plan_name,
      price_kes=v_base_price,compare_at_kes=null,billing_cycle=case when v_first_months=12 then 'yearly' when v_first_months=3 then 'quarterly' else 'monthly' end,
      availability_status='available',is_active=true,
      sort_order=case v_plan_name when 'Compact' then 1 when 'Compact Plus' then 2 when 'Premium' then 3 else coalesce(c.featured_order,0) end,
      updated_at=now()
    where id=v_plan_id;
  end if;

  update public.uniplug_plan_duration_offers set is_active=false,updated_at=now() where plan_id=v_plan_id;
  for term in select * from (values
    (1,c.selling_price_1_month),(3,c.selling_price_3_months),(6,c.selling_price_6_months),
    (12,c.selling_price_1_year),(24,c.selling_price_2_years),(36,c.selling_price_3_years)
  ) t(months,price) where price>0 loop
    insert into public.uniplug_plan_duration_offers(plan_id,duration_months,discount_percent,price_kes,badge,is_active,sort_order)
    values(v_plan_id,term.months,0,term.price,
      case when term.months=1 then 'Most flexible' when term.months=(select max(x.months) from (values
        (1,c.selling_price_1_month),(3,c.selling_price_3_months),(6,c.selling_price_6_months),
        (12,c.selling_price_1_year),(24,c.selling_price_2_years),(36,c.selling_price_3_years)) x(months,price) where x.price>0) then 'Best value' end,
      true,term.months)
    on conflict(plan_id,duration_months) do update set price_kes=excluded.price_kes,discount_percent=0,
      badge=excluded.badge,is_active=true,sort_order=excluded.sort_order,updated_at=now();
  end loop;

  select min(price/months)/130 into v_base_price from (values
    (c.selling_price_1_month,1),(c.selling_price_3_months,3),(c.selling_price_6_months,6),
    (c.selling_price_1_year,12),(c.selling_price_2_years,24),(c.selling_price_3_years,36)
  ) t(price,months) where price>0;
  update public.uniplug_catalog_services set starting_price_usd=round(v_base_price,2),updated_at=now() where id=v_service_id;
end;
$$;

do $$ declare r record; begin
  for r in select c.id from public.catalog c where c.category='entertainment'
    or exists(select 1 from public.uniplug_member_plans p where p.catalog_id=c.id)
  loop perform public.uniplug_sync_catalog_product(r.id); end loop;
end $$;

update public.uniplug_member_plans p set is_active=false,availability_status='unavailable',updated_at=now()
where p.catalog_id is null or not exists (
  select 1 from public.catalog c where c.id=p.catalog_id and c.deleted_at is null and c.pricing_status='active'
);
update public.uniplug_catalog_services s set is_active=false,updated_at=now()
where not exists(select 1 from public.uniplug_member_plans p where p.service_id=s.id and p.is_active);

alter table public.uniplug_plan_duration_offers
  drop constraint if exists uniplug_plan_duration_offers_price_kes_check;
alter table public.uniplug_plan_duration_offers
  add constraint uniplug_plan_duration_offers_price_kes_check check (not is_active or price_kes>=1);

drop trigger if exists uniplug_sync_catalog_to_storefront on public.catalog;
create or replace function public.uniplug_sync_catalog_product_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.uniplug_sync_catalog_product(new.id);
  return new;
end $$;
create trigger uniplug_sync_catalog_to_storefront
after insert or update of name,plan,description,is_featured,featured_order,deleted_at,pricing_status,
  selling_price_1_month,selling_price_3_months,selling_price_6_months,selling_price_1_year,
  selling_price_2_years,selling_price_3_years,subscription_group
on public.catalog for each row execute function public.uniplug_sync_catalog_product_trigger();

-- Guest-safe view: intentionally excludes supplier, buying cost, internal DStv
-- product names, and every other operational field.
create or replace view public.uniplug_public_catalog_offers as
select s.id service_id,s.slug,s.name,p.id plan_id,p.plan_name,p.plan_code,
  o.duration_months,o.price_kes,o.badge
from public.uniplug_catalog_services s
join public.uniplug_member_plans p on p.service_id=s.id and p.is_active and p.availability_status<>'unavailable'
join public.uniplug_plan_duration_offers o on o.plan_id=p.id and o.is_active and o.price_kes>0
join public.catalog c on c.id=p.catalog_id and c.deleted_at is null and c.pricing_status='active'
where s.is_active and s.availability_status<>'coming_soon';
grant select on public.uniplug_public_catalog_offers to anon,authenticated;

create or replace function public.uniplug_create_member_order_v2(p_selections jsonb,p_phone text)
returns table(order_id uuid,order_number text,paystack_reference text,total_kes numeric,customer_email text)
language plpgsql security definer set search_path=public as $$
declare v_user_id uuid:=(select auth.uid()); v_email text; v_total numeric(12,2); v_count int;
  v_selection_count int; v_order_id uuid; v_order_number text; v_reference text;
begin
  if v_user_id is null or not public.is_uniplug_member() then raise exception 'Active UniPlug membership is required'; end if;
  if length(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'))<9 then raise exception 'A valid phone number is required'; end if;
  if coalesce(jsonb_typeof(p_selections),'')<>'array' then raise exception 'Plan selections must be an array'; end if;
  v_selection_count:=jsonb_array_length(p_selections);
  if v_selection_count<1 or v_selection_count>20 then raise exception 'Select between one and twenty plans'; end if;
  if exists(select 1 from jsonb_array_elements(p_selections) item where jsonb_typeof(item.value)<>'object'
    or coalesce(item.value->>'planId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(item.value->>'durationMonths','') not in ('1','3','6','12','24','36')) then raise exception 'Every plan requires a valid duration'; end if;
  if (select count(distinct item.value->>'planId') from jsonb_array_elements(p_selections) item)<>v_selection_count then raise exception 'A plan can only be selected once'; end if;
  select email into v_email from public.uniplug_profiles where user_id=v_user_id and status='active';
  select count(*),coalesce(sum(o.price_kes),0) into v_count,v_total
  from jsonb_array_elements(p_selections) item
  join public.uniplug_member_plans p on p.id=(item.value->>'planId')::uuid and p.is_active and p.availability_status<>'unavailable'
  join public.uniplug_plan_duration_offers o on o.plan_id=p.id and o.duration_months=(item.value->>'durationMonths')::int and o.is_active and o.price_kes>0
  join public.catalog c on c.id=p.catalog_id and c.deleted_at is null and c.pricing_status='active';
  if v_count<>v_selection_count then raise exception 'One or more plans or periods are unavailable'; end if;
  v_order_number:='UNI-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  v_reference:='UP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,24));
  insert into public.uniplug_member_orders(order_number,user_id,customer_email,customer_phone,subtotal_kes,total_kes,paystack_reference)
  values(v_order_number,v_user_id,v_email,p_phone,v_total,v_total,v_reference) returning id into v_order_id;
  insert into public.uniplug_member_order_items(order_id,plan_id,service_id,catalog_id,service_name,plan_name,billing_cycle,duration_months,unit_price_kes,list_price_kes,price_source)
  select v_order_id,p.id,p.service_id,p.catalog_id,s.name,p.plan_name,p.billing_cycle,o.duration_months,o.price_kes,o.price_kes,'catalog_exact'
  from jsonb_array_elements(p_selections) item join public.uniplug_member_plans p on p.id=(item.value->>'planId')::uuid
  join public.uniplug_plan_duration_offers o on o.plan_id=p.id and o.duration_months=(item.value->>'durationMonths')::int
  join public.uniplug_catalog_services s on s.id=p.service_id;
  return query select v_order_id,v_order_number,v_reference,v_total,v_email;
end $$;
revoke all on function public.uniplug_create_member_order_v2(jsonb,text) from public,anon,authenticated;
grant execute on function public.uniplug_create_member_order_v2(jsonb,text) to authenticated;

create or replace function public.uniplug_create_renewal_order(p_subscription_id uuid,p_phone text)
returns table(order_id uuid,order_number text,paystack_reference text,total_kes numeric,customer_email text)
language plpgsql security definer set search_path=public as $$
declare v_user_id uuid:=(select auth.uid()); v_email text; v_service_id uuid; v_plan_id uuid; v_catalog_id uuid;
 v_service_name text; v_plan_name text; v_billing_cycle text; v_duration_months int; v_price numeric(12,2);
 v_order_id uuid; v_order_number text; v_reference text;
begin
 if v_user_id is null or not public.is_uniplug_member() then raise exception 'Active UniPlug membership is required'; end if;
 if length(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'))<9 then raise exception 'A valid phone number is required'; end if;
 select pr.email,s.service_id,s.plan_id,p.catalog_id,c.name,p.plan_name,p.billing_cycle,s.duration_months,o.price_kes
 into v_email,v_service_id,v_plan_id,v_catalog_id,v_service_name,v_plan_name,v_billing_cycle,v_duration_months,v_price
 from public.uniplug_member_subscriptions s join public.uniplug_profiles pr on pr.user_id=s.user_id and pr.status='active'
 join public.uniplug_member_plans p on p.id=s.plan_id and p.is_active and p.availability_status<>'unavailable'
 join public.uniplug_catalog_services c on c.id=s.service_id and c.is_active
 join public.uniplug_plan_duration_offers o on o.plan_id=p.id and o.duration_months=s.duration_months and o.is_active and o.price_kes>0
 where s.id=p_subscription_id and s.user_id=v_user_id and s.status in ('active','past_due','paused','expired');
 if not found then raise exception 'This subscription is not currently eligible for renewal'; end if;
 v_order_number:='UNI-R-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 v_reference:='UP-R-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,22));
 insert into public.uniplug_member_orders(order_number,user_id,customer_email,customer_phone,subtotal_kes,total_kes,paystack_reference)
 values(v_order_number,v_user_id,v_email,p_phone,v_price,v_price,v_reference) returning id into v_order_id;
 insert into public.uniplug_member_order_items(order_id,plan_id,service_id,catalog_id,service_name,plan_name,billing_cycle,duration_months,unit_price_kes,list_price_kes,price_source,renewal_subscription_id)
 values(v_order_id,v_plan_id,v_service_id,v_catalog_id,v_service_name,v_plan_name,v_billing_cycle,v_duration_months,v_price,v_price,'catalog_exact',p_subscription_id);
 return query select v_order_id,v_order_number,v_reference,v_price,v_email;
end $$;
revoke all on function public.uniplug_create_renewal_order(uuid,text) from public,anon,authenticated;
grant execute on function public.uniplug_create_renewal_order(uuid,text) to authenticated;

commit;
