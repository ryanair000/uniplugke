-- Phase 1: guest-safe catalog, authenticated pricing, invite-only membership,
-- server-priced orders, and manual activation. Apply only during the standalone
-- UniPlug cutover because anonymous access to the legacy price table is revoked.
create extension if not exists pgcrypto;

create table if not exists public.uniplug_catalog_services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  category_slug text not null check (category_slug in ('streaming','music','creative','ai','productivity','cloud','security','gaming','learning')),
  name text not null,
  short_description text not null default '',
  description text not null default '',
  logo_text text not null default 'UP',
  accent_color text not null default '#6957ff' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  cover_image_url text,
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  supported_devices jsonb not null default '[]'::jsonb check (jsonb_typeof(supported_devices) = 'array'),
  setup_requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(setup_requirements) = 'array'),
  fulfillment_label text not null default 'Managed access',
  activation_window text not null default 'Activation details available after sign-in',
  replacement_summary text not null default 'Eligible issues can be reported from the member dashboard.',
  faqs jsonb not null default '[]'::jsonb check (jsonb_typeof(faqs) = 'array'),
  availability_status text not null default 'available' check (availability_status in ('available','limited','coming_soon')),
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uniplug_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  phone text,
  role text not null default 'client' check (role in ('client','support','admin')),
  invited_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.uniplug_profiles
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.uniplug_profiles'::regclass
      and conname = 'uniplug_profiles_status_check'
  ) then
    alter table public.uniplug_profiles
      add constraint uniplug_profiles_status_check
      check (status in ('active','suspended','pending'));
  end if;
end $$;

create table if not exists public.uniplug_invitations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  username text not null,
  display_name text not null,
  action_type text not null check (action_type in ('invite','recovery')),
  status text not null default 'created' check (status in ('created','opened','completed','expired','revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  completed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.uniplug_member_plans (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.uniplug_catalog_services(id) on delete cascade,
  plan_name text not null,
  plan_code text not null unique check (plan_code ~ '^[a-z0-9-]+$'),
  price_kes numeric(12,2) not null check (price_kes >= 1),
  compare_at_kes numeric(12,2) check (compare_at_kes is null or compare_at_kes >= price_kes),
  billing_cycle text not null check (billing_cycle in ('monthly','quarterly','yearly')),
  plan_features jsonb not null default '[]'::jsonb check (jsonb_typeof(plan_features) = 'array'),
  purchase_limit integer not null default 1 check (purchase_limit between 1 and 20),
  availability_status text not null default 'available' check (availability_status in ('available','limited','unavailable')),
  inventory_note text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uniplug_member_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  customer_email text not null,
  customer_phone text not null,
  subtotal_kes numeric(12,2) not null check (subtotal_kes >= 0),
  total_kes numeric(12,2) not null check (total_kes >= 0),
  currency text not null default 'KES' check (currency = 'KES'),
  payment_status text not null default 'pending' check (payment_status in ('pending','initialization_failed','paid','failed','amount_mismatch','refunded')),
  fulfillment_status text not null default 'pending_payment' check (fulfillment_status in ('pending_payment','pending_activation','processing','active','completed','cancelled','manual_review','refunded')),
  paystack_reference text not null unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uniplug_member_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.uniplug_member_orders(id) on delete cascade,
  plan_id uuid not null references public.uniplug_member_plans(id),
  service_id uuid not null references public.uniplug_catalog_services(id),
  service_name text not null,
  plan_name text not null,
  billing_cycle text not null check (billing_cycle in ('monthly','quarterly','yearly')),
  unit_price_kes numeric(12,2) not null check (unit_price_kes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.uniplug_member_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid not null references public.uniplug_catalog_services(id),
  plan_id uuid not null references public.uniplug_member_plans(id),
  order_item_id uuid unique references public.uniplug_member_order_items(id) on delete set null,
  status text not null default 'pending_activation' check (status in ('pending_activation','active','past_due','paused','cancelled','expired')),
  start_at timestamptz,
  current_period_end timestamptz,
  auto_renew boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uniplug_catalog_category_idx on public.uniplug_catalog_services(category_slug, sort_order) where is_active;
create index if not exists uniplug_profiles_email_idx on public.uniplug_profiles(lower(email));
create index if not exists uniplug_invitations_email_idx on public.uniplug_invitations(lower(email), created_at desc);
create index if not exists uniplug_member_plans_service_idx on public.uniplug_member_plans(service_id, sort_order) where is_active;
create index if not exists uniplug_member_orders_user_idx on public.uniplug_member_orders(user_id, created_at desc);
create index if not exists uniplug_member_items_order_idx on public.uniplug_member_order_items(order_id);
create index if not exists uniplug_member_subscriptions_user_idx on public.uniplug_member_subscriptions(user_id, status);

create or replace function public.is_uniplug_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.uniplug_profiles
    where user_id = (select auth.uid()) and status = 'active'
  );
$$;

create or replace function public.is_uniplug_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.uniplug_profiles
    where user_id = (select auth.uid()) and status = 'active' and role = 'admin'
  );
$$;

-- Preserve access for existing Account Hub administrators without relying on
-- the old role table after the UniPlug split.
insert into public.uniplug_profiles(user_id,email,display_name,username,role,status,onboarding_completed_at)
select distinct
  u.id,
  lower(u.email),
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
  'admin-' || substr(replace(u.id::text, '-', ''), 1, 12),
  'admin',
  'active',
  now()
from auth.users u
join public.user_roles r on r.user_id = u.id
where r.role in ('admin','co_admin') and u.email is not null
on conflict (user_id) do update
set email = excluded.email,
    role = 'admin',
    status = 'active',
    updated_at = now();

alter table public.uniplug_catalog_services enable row level security;
alter table public.uniplug_profiles enable row level security;
alter table public.uniplug_invitations enable row level security;
alter table public.uniplug_member_plans enable row level security;
alter table public.uniplug_member_orders enable row level security;
alter table public.uniplug_member_order_items enable row level security;
alter table public.uniplug_member_subscriptions enable row level security;

drop policy if exists "guest reads active uniplug catalog" on public.uniplug_catalog_services;
create policy "guest reads active uniplug catalog" on public.uniplug_catalog_services
  for select to anon, authenticated using (is_active);
drop policy if exists "admin manages uniplug catalog" on public.uniplug_catalog_services;
create policy "admin manages uniplug catalog" on public.uniplug_catalog_services
  for all to authenticated using (public.is_uniplug_admin()) with check (public.is_uniplug_admin());

drop policy if exists "client reads own uniplug profile" on public.uniplug_profiles;
drop policy if exists "client updates own uniplug profile" on public.uniplug_profiles;
drop policy if exists "lokimax admins manage uniplug profiles" on public.uniplug_profiles;
drop policy if exists "member reads own profile" on public.uniplug_profiles;
create policy "member reads own profile" on public.uniplug_profiles
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "member updates own profile" on public.uniplug_profiles;
create policy "member updates own profile" on public.uniplug_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and role = 'client');
drop policy if exists "admin manages uniplug profiles" on public.uniplug_profiles;
create policy "admin manages uniplug profiles" on public.uniplug_profiles
  for all to authenticated using (public.is_uniplug_admin()) with check (public.is_uniplug_admin());

drop policy if exists "admin reads invitations" on public.uniplug_invitations;
create policy "admin reads invitations" on public.uniplug_invitations
  for select to authenticated using (public.is_uniplug_admin());

drop policy if exists "active members read private plans" on public.uniplug_member_plans;
create policy "active members read private plans" on public.uniplug_member_plans
  for select to authenticated using (is_active and public.is_uniplug_member());
drop policy if exists "admin manages private plans" on public.uniplug_member_plans;
create policy "admin manages private plans" on public.uniplug_member_plans
  for all to authenticated using (public.is_uniplug_admin()) with check (public.is_uniplug_admin());

drop policy if exists "members read own orders" on public.uniplug_member_orders;
create policy "members read own orders" on public.uniplug_member_orders
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "admin manages member orders" on public.uniplug_member_orders;
create policy "admin manages member orders" on public.uniplug_member_orders
  for all to authenticated using (public.is_uniplug_admin()) with check (public.is_uniplug_admin());

drop policy if exists "members read own order items" on public.uniplug_member_order_items;
create policy "members read own order items" on public.uniplug_member_order_items
  for select to authenticated using (
    exists (
      select 1 from public.uniplug_member_orders o
      where o.id = order_id and o.user_id = (select auth.uid())
    )
  );
drop policy if exists "admin manages member order items" on public.uniplug_member_order_items;
create policy "admin manages member order items" on public.uniplug_member_order_items
  for all to authenticated using (public.is_uniplug_admin()) with check (public.is_uniplug_admin());

drop policy if exists "members read own subscriptions" on public.uniplug_member_subscriptions;
create policy "members read own subscriptions" on public.uniplug_member_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "admin manages member subscriptions" on public.uniplug_member_subscriptions;
create policy "admin manages member subscriptions" on public.uniplug_member_subscriptions
  for all to authenticated using (public.is_uniplug_admin()) with check (public.is_uniplug_admin());

revoke all on public.uniplug_catalog_services from anon, authenticated;
grant select on public.uniplug_catalog_services to anon;
grant select, insert, update, delete on public.uniplug_catalog_services to authenticated;

revoke all on public.uniplug_profiles from anon, authenticated;
grant select on public.uniplug_profiles to authenticated;
grant update (display_name, phone) on public.uniplug_profiles to authenticated;

revoke all on public.uniplug_invitations from anon, authenticated;
grant select on public.uniplug_invitations to authenticated;

revoke all on public.uniplug_member_plans from anon, authenticated;
grant select, insert, update, delete on public.uniplug_member_plans to authenticated;

revoke all on public.uniplug_member_orders from anon, authenticated;
grant select on public.uniplug_member_orders to authenticated;

revoke all on public.uniplug_member_order_items from anon, authenticated;
grant select on public.uniplug_member_order_items to authenticated;

revoke all on public.uniplug_member_subscriptions from anon, authenticated;
grant select on public.uniplug_member_subscriptions to authenticated;

grant all on public.uniplug_catalog_services, public.uniplug_profiles, public.uniplug_invitations,
  public.uniplug_member_plans, public.uniplug_member_orders,
  public.uniplug_member_order_items, public.uniplug_member_subscriptions to service_role;

revoke all on function public.is_uniplug_member() from public;
revoke all on function public.is_uniplug_admin() from public;
grant execute on function public.is_uniplug_member() to authenticated;
grant execute on function public.is_uniplug_admin() to authenticated;

create or replace function public.uniplug_complete_onboarding()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication is required'; end if;
  update public.uniplug_profiles
  set status = 'active', onboarding_completed_at = now(), updated_at = now()
  where user_id = v_user_id and status in ('pending','active');
  if not found then raise exception 'A pending UniPlug invitation was not found'; end if;

  update public.uniplug_invitations
  set status = 'completed', completed_at = now()
  where user_id = v_user_id and status = 'created';
end;
$$;
revoke all on function public.uniplug_complete_onboarding() from public;
grant execute on function public.uniplug_complete_onboarding() to authenticated;

create or replace function public.uniplug_create_member_order(p_plan_ids uuid[], p_phone text)
returns table(order_id uuid, order_number text, paystack_reference text, total_kes numeric, customer_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_total numeric(12,2);
  v_count integer;
  v_plan_ids uuid[];
  v_order_id uuid;
  v_order_number text;
  v_reference text;
begin
  if v_user_id is null or not public.is_uniplug_member() then
    raise exception 'Active UniPlug membership is required';
  end if;

  select array_agg(distinct item.plan_id)
  into v_plan_ids
  from unnest(p_plan_ids) as item(plan_id);

  if v_plan_ids is null or cardinality(v_plan_ids) = 0 or cardinality(v_plan_ids) > 20 then
    raise exception 'Select between one and twenty plans';
  end if;
  if length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9 then
    raise exception 'A valid phone number is required';
  end if;

  select email into v_email
  from public.uniplug_profiles
  where user_id = v_user_id and status = 'active';

  select count(*), coalesce(sum(price_kes), 0)
  into v_count, v_total
  from public.uniplug_member_plans
  where id = any(v_plan_ids) and is_active and availability_status <> 'unavailable';

  if v_count <> cardinality(v_plan_ids) then
    raise exception 'One or more plans are unavailable';
  end if;

  v_order_number := 'UNI-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_reference := 'UP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24));

  insert into public.uniplug_member_orders(
    order_number,user_id,customer_email,customer_phone,subtotal_kes,total_kes,paystack_reference
  ) values (
    v_order_number,v_user_id,v_email,p_phone,v_total,v_total,v_reference
  ) returning id into v_order_id;

  insert into public.uniplug_member_order_items(
    order_id,plan_id,service_id,service_name,plan_name,billing_cycle,unit_price_kes
  )
  select v_order_id,p.id,p.service_id,s.name,p.plan_name,p.billing_cycle,p.price_kes
  from public.uniplug_member_plans p
  join public.uniplug_catalog_services s on s.id = p.service_id
  where p.id = any(v_plan_ids);

  return query select v_order_id,v_order_number,v_reference,v_total,v_email;
end;
$$;
revoke all on function public.uniplug_create_member_order(uuid[], text) from public;
grant execute on function public.uniplug_create_member_order(uuid[], text) to authenticated;

create or replace function public.uniplug_activate_member_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.uniplug_member_orders%rowtype;
  v_activated integer := 0;
begin
  if not public.is_uniplug_admin() then raise exception 'Admin access is required'; end if;

  select * into v_order
  from public.uniplug_member_orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'Only a paid order can be activated'; end if;

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
  on conflict (order_item_id) do update
  set status = 'active',
      start_at = coalesce(public.uniplug_member_subscriptions.start_at, excluded.start_at),
      current_period_end = excluded.current_period_end,
      updated_at = now();

  get diagnostics v_activated = row_count;
  update public.uniplug_member_orders
  set fulfillment_status = 'active', updated_at = now()
  where id = v_order.id;

  return v_activated;
end;
$$;
revoke all on function public.uniplug_activate_member_order(uuid) from public;
grant execute on function public.uniplug_activate_member_order(uuid) to authenticated;

-- Migrate the current service table. Pricing is copied into the protected plan
-- table at migration time and is never hard-coded in this repository.
do $$
begin
  if to_regclass('public.uniplug_services') is not null then
    insert into public.uniplug_catalog_services(
      id,slug,category_slug,name,short_description,description,logo_text,
      accent_color,features,setup_requirements,fulfillment_label,is_active,sort_order
    )
    select
      id,slug,
      case when category_slug = 'business' then 'productivity' else category_slug end,
      name,short_description,description,logo_text,accent_color,features,setup_requirements,
      case fulfillment_type
        when 'activation_code' then 'Activation code'
        when 'customer_account' then 'Customer account activation'
        when 'family_slot' then 'Managed membership slot'
        else 'Managed access'
      end,
      is_active,sort_order
    from public.uniplug_services
    on conflict (slug) do update
    set name = excluded.name,
        short_description = excluded.short_description,
        description = excluded.description,
        logo_text = excluded.logo_text,
        accent_color = excluded.accent_color,
        features = excluded.features,
        setup_requirements = excluded.setup_requirements,
        fulfillment_label = excluded.fulfillment_label,
        is_active = excluded.is_active,
        sort_order = excluded.sort_order,
        updated_at = now();

    insert into public.uniplug_member_plans(
      service_id,plan_name,plan_code,price_kes,compare_at_kes,billing_cycle,
      plan_features,is_active,sort_order
    )
    select
      c.id,
      s.name || ' Member Plan',
      s.slug || '-member',
      s.price_kes,
      s.compare_at_kes,
      s.billing_cycle,
      s.features,
      s.is_active,
      s.sort_order
    from public.uniplug_services s
    join public.uniplug_catalog_services c on c.slug = s.slug
    on conflict (plan_code) do update
    set service_id = excluded.service_id,
        plan_name = excluded.plan_name,
        price_kes = excluded.price_kes,
        compare_at_kes = excluded.compare_at_kes,
        billing_cycle = excluded.billing_cycle,
        plan_features = excluded.plan_features,
        is_active = excluded.is_active,
        sort_order = excluded.sort_order,
        updated_at = now();

    drop policy if exists "public reads active uniplug services" on public.uniplug_services;
    drop policy if exists "active members read legacy uniplug services" on public.uniplug_services;
    create policy "active members read legacy uniplug services" on public.uniplug_services
      for select to authenticated using (is_active and public.is_uniplug_member());
    revoke select on public.uniplug_services from public, anon;
    grant select on public.uniplug_services to authenticated;
  end if;
end $$;

-- Enrich the known starter catalog without adding any price values.
insert into public.uniplug_catalog_services(
  slug,category_slug,name,short_description,description,logo_text,accent_color,
  features,supported_devices,setup_requirements,fulfillment_label,
  activation_window,replacement_summary,faqs,availability_status,is_featured,sort_order
)
values
('netflix-premium','streaming','Netflix Premium','Premium entertainment managed through one simple member dashboard.','Enjoy a polished streaming setup with activation guidance, renewal tracking, and member support.','N','#e50914','["Premium viewing experience","Renewal tracking","Member support"]','["Smart TV","Mobile","Tablet","Browser"]','["A supported device","Stable internet connection"]','Managed access','Usually activated after account verification','Eligible access issues can be replaced from the member dashboard.','[{"question":"How do I receive access?","answer":"Activation details appear securely in your dashboard once ready."}]','available',true,10),
('spotify-premium','music','Spotify Premium','Ad-free music, downloads, and member-managed access.','Keep your listening experience organised with activation support and clear renewal dates.','S','#1db954','["Ad-free listening","Offline listening","Account support"]','["Mobile","Tablet","Desktop","Browser"]','["Spotify application","Internet connection for activation"]','Managed membership','Normally completed after member verification','Eligible account faults can be reported and tracked online.','[]','available',true,20),
('canva-pro','creative','Canva Pro','Premium creative tools for individuals, creators, and small teams.','Access a richer design workspace with premium creative tools and guided activation.','C','#7d2ae8','["Premium templates","Background tools","Brand workspace"]','["Browser","Mobile","Tablet","Desktop"]','["An email address you can access"]','Team invitation','Invitation delivered after verification','Invitation and access issues can be reported from the dashboard.','[]','available',true,30),
('icloud-plus-200','cloud','iCloud+ 200GB','More space for photos, files, backups, and everyday device use.','A clear cloud-storage option with setup guidance and renewal visibility.','i+','#0a84ff','["Expanded storage","Backup support","Family-ready options"]','["iPhone","iPad","Mac","Browser"]','["Compatible Apple account and device"]','Customer account activation','Activation time depends on account verification','Support reviews account-specific problems before replacement.','[]','limited',false,40),
('game-pass-ultimate','gaming','Game Pass Ultimate','A broad gaming membership for console, PC, and supported cloud play.','Discover a managed gaming membership with clear device requirements and activation tracking.','X','#107c10','["Console library","PC library","Online multiplayer"]','["Xbox","Windows PC","Supported mobile devices"]','["Compatible account","Supported region and device"]','Account activation','Activation follows account and region verification','Account faults are checked for eligibility before replacement.','[]','available',true,50),
('microsoft-365','productivity','Microsoft 365','Office applications and cloud storage for work, school, and home.','Manage productivity access, activation progress, renewal dates, and support from one portal.','M','#f25022','["Office applications","Cloud storage","Multi-device use"]','["Windows","Mac","Mobile","Browser"]','["Compatible device","Email access"]','Managed activation','Normally completed after member verification','Access problems can be reported and followed from the dashboard.','[]','available',true,60)
on conflict (slug) do update
set category_slug = excluded.category_slug,
    name = excluded.name,
    short_description = excluded.short_description,
    description = excluded.description,
    logo_text = excluded.logo_text,
    accent_color = excluded.accent_color,
    features = excluded.features,
    supported_devices = excluded.supported_devices,
    setup_requirements = excluded.setup_requirements,
    fulfillment_label = excluded.fulfillment_label,
    activation_window = excluded.activation_window,
    replacement_summary = excluded.replacement_summary,
    faqs = excluded.faqs,
    availability_status = excluded.availability_status,
    is_featured = excluded.is_featured,
    sort_order = excluded.sort_order,
    updated_at = now();
