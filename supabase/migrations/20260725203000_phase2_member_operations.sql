-- Phase 2: member self-service, operational requests, and account activity.

alter table public.uniplug_profiles
  add column if not exists renewal_reminders_enabled boolean not null default true,
  add column if not exists marketing_opt_in boolean not null default false;

create table if not exists public.uniplug_subscription_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.uniplug_member_subscriptions(id) on delete cascade,
  request_type text not null check (request_type in ('pause','cancel')),
  reason text check (reason is null or char_length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending','completed','declined')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniplug_subscription_requests_pending_idx
  on public.uniplug_subscription_requests(subscription_id, request_type)
  where status = 'pending';
create index if not exists uniplug_subscription_requests_user_idx
  on public.uniplug_subscription_requests(user_id, created_at desc);
create index if not exists uniplug_subscription_requests_status_idx
  on public.uniplug_subscription_requests(status, created_at);

create table if not exists public.uniplug_member_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('order_created','payment_confirmed','subscription_created','subscription_status','profile_updated','password_updated','request_created','request_resolved')),
  title text not null check (char_length(title) between 1 and 160),
  detail text check (detail is null or char_length(detail) <= 1000),
  entity_type text check (entity_type is null or entity_type in ('order','subscription','profile','request')),
  entity_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists uniplug_member_events_user_idx
  on public.uniplug_member_events(user_id, created_at desc);

create or replace function public.uniplug_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists uniplug_subscription_requests_touch on public.uniplug_subscription_requests;
create trigger uniplug_subscription_requests_touch
before update on public.uniplug_subscription_requests
for each row execute function public.uniplug_touch_updated_at();

create or replace function public.uniplug_update_member_profile(
  p_display_name text,
  p_username text,
  p_phone text,
  p_renewal_reminders_enabled boolean,
  p_marketing_opt_in boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_username text := lower(trim(coalesce(p_username, '')));
  v_display_name text := nullif(trim(coalesce(p_display_name, '')), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^+0-9]', '', 'g'), '');
begin
  if v_user_id is null or not public.is_uniplug_member() then
    raise exception 'Active UniPlug membership is required';
  end if;
  if v_username !~ '^[a-z0-9._-]{3,32}$' then
    raise exception 'Username must be 3 to 32 characters using letters, numbers, dots, underscores, or hyphens';
  end if;
  if v_display_name is not null and char_length(v_display_name) > 100 then
    raise exception 'Display name is too long';
  end if;
  if v_phone is not null and char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 9 then
    raise exception 'Enter a valid phone number';
  end if;

  update public.uniplug_profiles
  set display_name = v_display_name,
      username = v_username,
      phone = v_phone,
      renewal_reminders_enabled = coalesce(p_renewal_reminders_enabled, true),
      marketing_opt_in = coalesce(p_marketing_opt_in, false),
      updated_at = now()
  where user_id = v_user_id and status = 'active';

  insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
  values(v_user_id,'profile_updated','Profile settings updated','Your UniPlug profile and communication preferences were updated.','profile',v_user_id);
end;
$$;

create or replace function public.uniplug_request_subscription_action(
  p_subscription_id uuid,
  p_request_type text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_subscription public.uniplug_member_subscriptions%rowtype;
  v_request_id uuid;
begin
  if v_user_id is null or not public.is_uniplug_member() then
    raise exception 'Active UniPlug membership is required';
  end if;
  if p_request_type not in ('pause','cancel') then
    raise exception 'Unsupported subscription action';
  end if;

  select * into v_subscription
  from public.uniplug_member_subscriptions
  where id = p_subscription_id and user_id = v_user_id;

  if not found then raise exception 'Subscription not found'; end if;
  if p_request_type = 'pause' and v_subscription.status not in ('active','past_due') then
    raise exception 'Only active subscriptions can be paused';
  end if;
  if p_request_type = 'cancel' and v_subscription.status not in ('pending_activation','active','past_due','paused') then
    raise exception 'This subscription cannot be cancelled';
  end if;
  if exists (
    select 1 from public.uniplug_subscription_requests
    where subscription_id = p_subscription_id and request_type = p_request_type and status = 'pending'
  ) then
    raise exception 'A matching request is already pending';
  end if;

  insert into public.uniplug_subscription_requests(user_id,subscription_id,request_type,reason)
  values(v_user_id,p_subscription_id,p_request_type,nullif(trim(coalesce(p_reason, '')), ''))
  returning id into v_request_id;

  insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
  values(v_user_id,'request_created',initcap(p_request_type) || ' request submitted','The operations team will review this subscription request.','request',v_request_id);

  return v_request_id;
end;
$$;

create or replace function public.uniplug_resolve_subscription_request(
  p_request_id uuid,
  p_resolution text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.uniplug_subscription_requests%rowtype;
begin
  if not public.is_uniplug_admin() then raise exception 'UniPlug admin access required'; end if;
  if p_resolution not in ('completed','declined') then raise exception 'Invalid request resolution'; end if;

  select * into v_request
  from public.uniplug_subscription_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'Request has already been resolved'; end if;

  update public.uniplug_subscription_requests
  set status = p_resolution,
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      resolved_by = (select auth.uid()),
      resolved_at = now()
  where id = p_request_id;

  if p_resolution = 'completed' then
    update public.uniplug_member_subscriptions
    set status = case v_request.request_type when 'pause' then 'paused' else 'cancelled' end,
        updated_at = now()
    where id = v_request.subscription_id;
  end if;

  insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
  values(
    v_request.user_id,
    'request_resolved',
    initcap(v_request.request_type) || ' request ' || case when p_resolution = 'completed' then 'completed' else 'declined' end,
    nullif(trim(coalesce(p_admin_note, '')), ''),
    'request',
    p_request_id
  );
end;
$$;

create or replace function public.uniplug_log_order_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
    values(new.user_id,'order_created','Order ' || new.order_number || ' created','Payment is pending for this member order.','order',new.id);
  elsif old.payment_status is distinct from new.payment_status and new.payment_status = 'paid' then
    insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
    values(new.user_id,'payment_confirmed','Payment confirmed','Order ' || new.order_number || ' is ready for activation.','order',new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists uniplug_member_order_events on public.uniplug_member_orders;
create trigger uniplug_member_order_events
after insert or update of payment_status on public.uniplug_member_orders
for each row execute function public.uniplug_log_order_event();

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
  elsif old.status is distinct from new.status then
    insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
    values(new.user_id,'subscription_status','Subscription status updated','The service status is now ' || replace(new.status, '_', ' ') || '.','subscription',new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists uniplug_member_subscription_events on public.uniplug_member_subscriptions;
create trigger uniplug_member_subscription_events
after insert or update of status on public.uniplug_member_subscriptions
for each row execute function public.uniplug_log_subscription_event();

alter table public.uniplug_subscription_requests enable row level security;
alter table public.uniplug_member_events enable row level security;

drop policy if exists "members read own subscription requests" on public.uniplug_subscription_requests;
create policy "members read own subscription requests"
on public.uniplug_subscription_requests for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "admins manage subscription requests" on public.uniplug_subscription_requests;
create policy "admins manage subscription requests"
on public.uniplug_subscription_requests for all to authenticated
using (public.is_uniplug_admin()) with check (public.is_uniplug_admin());

drop policy if exists "members read own activity" on public.uniplug_member_events;
create policy "members read own activity"
on public.uniplug_member_events for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "admins read member activity" on public.uniplug_member_events;
create policy "admins read member activity"
on public.uniplug_member_events for select to authenticated
using (public.is_uniplug_admin());

revoke update on public.uniplug_profiles from authenticated;
grant update(display_name,username,phone,renewal_reminders_enabled,marketing_opt_in) on public.uniplug_profiles to authenticated;
grant select on public.uniplug_subscription_requests, public.uniplug_member_events to authenticated;
grant execute on function public.uniplug_update_member_profile(text,text,text,boolean,boolean) to authenticated;
grant execute on function public.uniplug_request_subscription_action(uuid,text,text) to authenticated;
grant execute on function public.uniplug_resolve_subscription_request(uuid,text,text) to authenticated;
revoke all on function public.uniplug_log_order_event() from public;
revoke all on function public.uniplug_log_subscription_event() from public;
