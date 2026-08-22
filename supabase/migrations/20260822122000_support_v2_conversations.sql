-- UniPlug Support V2: threaded conversations, service context, unread state, and private attachments.

alter table public.uniplug_support_tickets
  add column if not exists category text not null default 'other',
  add column if not exists service_name text,
  add column if not exists subscription_id uuid,
  add column if not exists subscription_source text,
  add column if not exists last_message_at timestamptz,
  add column if not exists member_unread boolean not null default false,
  add column if not exists admin_unread boolean not null default true;

alter table public.uniplug_support_tickets
  drop constraint if exists uniplug_support_tickets_status_check;
alter table public.uniplug_support_tickets
  add constraint uniplug_support_tickets_status_check
  check (status in ('open','in_progress','waiting_customer','resolved','closed'));

alter table public.uniplug_support_tickets
  drop constraint if exists uniplug_support_tickets_category_check;
alter table public.uniplug_support_tickets
  add constraint uniplug_support_tickets_category_check
  check (category in ('login','service','verification','billing','account','other'));

alter table public.uniplug_support_tickets
  drop constraint if exists uniplug_support_tickets_subscription_source_check;
alter table public.uniplug_support_tickets
  add constraint uniplug_support_tickets_subscription_source_check
  check (subscription_source is null or subscription_source in ('member','tracked'));

alter table public.uniplug_support_tickets
  drop constraint if exists uniplug_support_tickets_service_name_check;
alter table public.uniplug_support_tickets
  add constraint uniplug_support_tickets_service_name_check
  check (service_name is null or char_length(service_name) <= 120);

update public.uniplug_support_tickets
set last_message_at = coalesce(last_message_at, updated_at, created_at)
where last_message_at is null;

create index if not exists uniplug_support_tickets_recent_idx
  on public.uniplug_support_tickets(user_id, last_message_at desc);
create index if not exists uniplug_support_tickets_admin_unread_idx
  on public.uniplug_support_tickets(admin_unread, last_message_at desc)
  where admin_unread = true;

create table if not exists public.uniplug_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.uniplug_support_tickets(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('member','admin')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists uniplug_support_messages_ticket_idx
  on public.uniplug_support_messages(ticket_id, created_at);

create table if not exists public.uniplug_support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.uniplug_support_tickets(id) on delete cascade,
  message_id uuid references public.uniplug_support_messages(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 180),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  file_size integer not null check (file_size > 0 and file_size <= 5242880),
  created_at timestamptz not null default now()
);

create index if not exists uniplug_support_attachments_ticket_idx
  on public.uniplug_support_attachments(ticket_id, created_at);
create index if not exists uniplug_support_attachments_message_idx
  on public.uniplug_support_attachments(message_id, created_at);

-- Preserve every existing ticket as the opening message in the new thread model.
insert into public.uniplug_support_messages(ticket_id, sender_id, sender_role, body, created_at)
select t.id, t.user_id, 'member', t.message, t.created_at
from public.uniplug_support_tickets t
where not exists (
  select 1 from public.uniplug_support_messages m
  where m.ticket_id = t.id and m.sender_role = 'member'
);

insert into public.uniplug_support_messages(ticket_id, sender_id, sender_role, body, created_at)
select t.id, t.resolved_by, 'admin', t.admin_note, coalesce(t.resolved_at, t.updated_at, t.created_at)
from public.uniplug_support_tickets t
where t.admin_note is not null
  and btrim(t.admin_note) <> ''
  and not exists (
    select 1 from public.uniplug_support_messages m
    where m.ticket_id = t.id and m.sender_role = 'admin'
  );

alter table public.uniplug_support_messages enable row level security;
alter table public.uniplug_support_attachments enable row level security;

create policy "members read own support messages"
  on public.uniplug_support_messages for select to authenticated
  using (
    exists (
      select 1 from public.uniplug_support_tickets t
      where t.id = ticket_id and t.user_id = (select auth.uid())
    )
  );
create policy "members reply to own support tickets"
  on public.uniplug_support_messages for insert to authenticated
  with check (
    sender_role = 'member'
    and sender_id = (select auth.uid())
    and exists (
      select 1 from public.uniplug_support_tickets t
      where t.id = ticket_id and t.user_id = (select auth.uid())
    )
  );
create policy "admins manage support messages"
  on public.uniplug_support_messages for all to authenticated
  using ((select public.is_uniplug_admin()))
  with check ((select public.is_uniplug_admin()));

create policy "members read own support attachments"
  on public.uniplug_support_attachments for select to authenticated
  using (
    exists (
      select 1 from public.uniplug_support_tickets t
      where t.id = ticket_id and t.user_id = (select auth.uid())
    )
  );
create policy "members attach to own support tickets"
  on public.uniplug_support_attachments for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.uniplug_support_tickets t
      where t.id = ticket_id and t.user_id = (select auth.uid())
    )
  );
create policy "admins manage support attachments"
  on public.uniplug_support_attachments for all to authenticated
  using ((select public.is_uniplug_admin()))
  with check ((select public.is_uniplug_admin()));

-- Add support replies to the existing account notification stream.
alter table public.uniplug_member_events
  drop constraint if exists uniplug_member_events_event_type_check;
alter table public.uniplug_member_events
  add constraint uniplug_member_events_event_type_check
  check (event_type in ('order_created','payment_confirmed','subscription_created','subscription_status','profile_updated','password_updated','request_created','request_resolved','support_reply'));

alter table public.uniplug_member_events
  drop constraint if exists uniplug_member_events_entity_type_check;
alter table public.uniplug_member_events
  add constraint uniplug_member_events_entity_type_check
  check (entity_type is null or entity_type in ('order','subscription','profile','request','support_ticket'));

create or replace function public.uniplug_support_message_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_subject text;
begin
  select user_id, subject into v_user_id, v_subject
  from public.uniplug_support_tickets
  where id = new.ticket_id;

  if new.sender_role = 'admin' then
    update public.uniplug_support_tickets
    set member_unread = true,
        admin_unread = false,
        last_message_at = new.created_at,
        updated_at = now()
    where id = new.ticket_id;

    insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
    values(
      v_user_id,
      'support_reply',
      'UniPlug Support replied',
      left(coalesce(v_subject, 'Support request'), 160),
      'support_ticket',
      new.ticket_id
    );
  else
    update public.uniplug_support_tickets
    set admin_unread = true,
        member_unread = false,
        last_message_at = new.created_at,
        status = case when status in ('waiting_customer','resolved','closed') then 'open' else status end,
        resolved_by = case when status in ('waiting_customer','resolved','closed') then null else resolved_by end,
        resolved_at = case when status in ('waiting_customer','resolved','closed') then null else resolved_at end,
        updated_at = now()
    where id = new.ticket_id;
  end if;

  return new;
end;
$$;

drop trigger if exists uniplug_support_message_activity_trigger on public.uniplug_support_messages;
create trigger uniplug_support_message_activity_trigger
after insert on public.uniplug_support_messages
for each row execute function public.uniplug_support_message_activity();

create or replace function public.uniplug_mark_support_ticket_read(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if public.is_uniplug_admin() then
    update public.uniplug_support_tickets
    set admin_unread = false
    where id = p_ticket_id;
    return;
  end if;

  update public.uniplug_support_tickets
  set member_unread = false
  where id = p_ticket_id and user_id = v_user_id;
end;
$$;

revoke all on function public.uniplug_support_message_activity() from public;
revoke all on function public.uniplug_mark_support_ticket_read(uuid) from public;
grant execute on function public.uniplug_mark_support_ticket_read(uuid) to authenticated;

grant select, insert on public.uniplug_support_messages to authenticated;
grant select, insert on public.uniplug_support_attachments to authenticated;
grant update on public.uniplug_support_tickets to authenticated;
grant all on public.uniplug_support_messages, public.uniplug_support_attachments to service_role;

-- Private screenshot bucket. Files are stored under <ticket-id>/... and access is tied to ticket ownership.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uniplug-support',
  'uniplug-support',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members upload own support screenshots" on storage.objects;
create policy "members upload own support screenshots"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'uniplug-support'
    and exists (
      select 1 from public.uniplug_support_tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (t.user_id = (select auth.uid()) or (select public.is_uniplug_admin()))
    )
  );

drop policy if exists "members read own support screenshots" on storage.objects;
create policy "members read own support screenshots"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'uniplug-support'
    and exists (
      select 1 from public.uniplug_support_tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (t.user_id = (select auth.uid()) or (select public.is_uniplug_admin()))
    )
  );

drop policy if exists "admins delete support screenshots" on storage.objects;
create policy "admins delete support screenshots"
  on storage.objects for delete to authenticated
  using (bucket_id = 'uniplug-support' and (select public.is_uniplug_admin()));
