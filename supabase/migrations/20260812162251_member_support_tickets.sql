create table if not exists public.uniplug_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uniplug_support_tickets_user_idx
  on public.uniplug_support_tickets(user_id, created_at desc);
create index if not exists uniplug_support_tickets_queue_idx
  on public.uniplug_support_tickets(status, created_at);

alter table public.uniplug_support_tickets enable row level security;

create policy "members create own support tickets"
  on public.uniplug_support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_uniplug_member()));
create policy "members read own support tickets"
  on public.uniplug_support_tickets for select to authenticated
  using (user_id = (select auth.uid()));
create policy "admins manage support tickets"
  on public.uniplug_support_tickets for all to authenticated
  using ((select public.is_uniplug_admin()))
  with check ((select public.is_uniplug_admin()));

grant select, insert on public.uniplug_support_tickets to authenticated;
grant all on public.uniplug_support_tickets to service_role;
