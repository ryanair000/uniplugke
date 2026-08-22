-- Support V2 hardening: human-friendly IDs, canonical account context, and DB-side rate limits.

create sequence if not exists public.uniplug_support_ticket_number_seq start with 1001;

alter table public.uniplug_support_tickets
  add column if not exists public_id text;

update public.uniplug_support_tickets
set public_id = 'UNI-' || lpad(nextval('public.uniplug_support_ticket_number_seq')::text, 6, '0')
where public_id is null;

alter table public.uniplug_support_tickets
  alter column public_id set default ('UNI-' || lpad(nextval('public.uniplug_support_ticket_number_seq')::text, 6, '0')),
  alter column public_id set not null;

alter table public.uniplug_support_tickets
  drop constraint if exists uniplug_support_tickets_public_id_check;
alter table public.uniplug_support_tickets
  add constraint uniplug_support_tickets_public_id_check
  check (public_id ~ '^UNI-[0-9]{6,}$');

create unique index if not exists uniplug_support_tickets_public_id_key
  on public.uniplug_support_tickets(public_id);

create or replace function public.uniplug_validate_support_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_service_name text;
  v_order_number text;
begin
  -- Server/service-role maintenance and authenticated admins are trusted.
  if v_uid is null or public.is_uniplug_admin() then
    return new;
  end if;

  if new.order_id is not null then
    select o.order_number
      into v_order_number
    from public.uniplug_member_orders o
    where o.id = new.order_id
      and o.user_id = v_uid;

    if not found then
      new.order_id := null;
      new.order_number := null;
    else
      new.order_number := left(v_order_number, 80);
    end if;
  else
    new.order_number := null;
  end if;

  if new.subscription_id is not null and new.subscription_source = 'member' then
    select s.name
      into v_service_name
    from public.uniplug_member_subscriptions ms
    join public.uniplug_catalog_services s on s.id = ms.service_id
    where ms.id = new.subscription_id
      and ms.user_id = v_uid;
  elsif new.subscription_id is not null and new.subscription_source = 'tracked' then
    select cs.name
      into v_service_name
    from public.client_portal_accounts portal
    join public.client_subscriptions subscription on subscription.client_id = portal.client_id
    left join public.client_services cs on cs.id = subscription.service_id
    where portal.user_id = v_uid
      and subscription.id = new.subscription_id
    limit 1;
  elsif new.subscription_id is not null then
    v_service_name := null;
  end if;

  if new.subscription_id is not null then
    if v_service_name is null then
      new.subscription_id := null;
      new.subscription_source := null;
    else
      new.service_name := left(v_service_name, 120);
    end if;
  elsif new.subscription_source is not null then
    new.subscription_source := null;
  end if;

  return new;
end;
$$;

revoke all on function public.uniplug_validate_support_context() from public;

drop trigger if exists uniplug_validate_support_context_trigger
  on public.uniplug_support_tickets;
create trigger uniplug_validate_support_context_trigger
before insert or update of order_id, subscription_id, subscription_source
on public.uniplug_support_tickets
for each row execute function public.uniplug_validate_support_context();

create or replace function public.uniplug_enforce_support_ticket_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null or public.is_uniplug_admin() then
    return new;
  end if;

  select count(*)::integer into v_count
  from public.uniplug_support_tickets t
  where t.user_id = v_uid
    and t.created_at >= now() - interval '10 minutes';

  if v_count >= 5 then
    raise exception 'Support ticket rate limit exceeded' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.uniplug_enforce_support_ticket_rate_limit() from public;

drop trigger if exists uniplug_support_ticket_rate_limit_trigger
  on public.uniplug_support_tickets;
create trigger uniplug_support_ticket_rate_limit_trigger
before insert on public.uniplug_support_tickets
for each row execute function public.uniplug_enforce_support_ticket_rate_limit();

create or replace function public.uniplug_enforce_support_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if new.sender_role <> 'member' or v_uid is null then
    return new;
  end if;

  select count(*)::integer into v_count
  from public.uniplug_support_messages m
  where m.sender_id = v_uid
    and m.created_at >= now() - interval '1 minute';

  if v_count >= 8 then
    raise exception 'Support reply rate limit exceeded' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.uniplug_enforce_support_message_rate_limit() from public;

drop trigger if exists uniplug_support_message_rate_limit_trigger
  on public.uniplug_support_messages;
create trigger uniplug_support_message_rate_limit_trigger
before insert on public.uniplug_support_messages
for each row execute function public.uniplug_enforce_support_message_rate_limit();

-- An attachment must point to a message in the same owned ticket.
drop policy if exists "members attach to own support tickets"
  on public.uniplug_support_attachments;
create policy "members attach to own support tickets"
  on public.uniplug_support_attachments for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.uniplug_support_tickets t
      where t.id = ticket_id and t.user_id = (select auth.uid())
    )
    and (
      message_id is null
      or exists (
        select 1 from public.uniplug_support_messages m
        where m.id = message_id and m.ticket_id = ticket_id
      )
    )
  );
