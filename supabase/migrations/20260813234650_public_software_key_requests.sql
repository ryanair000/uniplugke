-- Durable, server-created requests for software not yet listed in the key store.
-- The public form writes through a server route using the service role. No
-- browser role can read or write this queue through the Data API.

create table if not exists public.uniplug_key_requests (
  id uuid primary key default gen_random_uuid(),
  request_reference text not null unique
    check (request_reference ~ '^REQ-[A-Z0-9-]{12,80}$'),
  software_name text not null
    check (char_length(software_name) between 2 and 120),
  platform text not null
    check (char_length(platform) between 2 and 80),
  customer_email text not null
    check (char_length(customer_email) between 5 and 254),
  customer_phone text not null
    check (char_length(customer_phone) between 9 and 20),
  notes text
    check (notes is null or char_length(notes) <= 1000),
  request_ip_hash text not null
    check (request_ip_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'quoted', 'sourced', 'closed')),
  admin_note text
    check (admin_note is null or char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.uniplug_key_requests enable row level security;
revoke all on table public.uniplug_key_requests from public, anon, authenticated;
grant select, insert, update on table public.uniplug_key_requests to service_role;

create index if not exists uniplug_key_requests_created_idx
  on public.uniplug_key_requests(created_at desc);
create index if not exists uniplug_key_requests_queue_idx
  on public.uniplug_key_requests(status, created_at);
create index if not exists uniplug_key_requests_email_rate_idx
  on public.uniplug_key_requests(customer_email, created_at desc);
create index if not exists uniplug_key_requests_ip_rate_idx
  on public.uniplug_key_requests(request_ip_hash, created_at desc);

comment on table public.uniplug_key_requests is
  'Private software-key sourcing queue written only by trusted server routes.';

-- Phase 2 records the exact advertised term language instead of the legacy
-- month/year token and preserves the material acknowledgement with the order.
alter table public.uniplug_key_orders
  drop constraint if exists uniplug_key_orders_licence_term_check;
alter table public.uniplug_key_orders
  add constraint uniplug_key_orders_licence_term_check
  check (char_length(licence_term) between 3 and 80);
alter table public.uniplug_key_orders
  add column if not exists terms_version text,
  add column if not exists payment_disclosure text,
  add column if not exists end_of_term_disclosure text,
  add column if not exists material_terms_acknowledged_at timestamptz,
  add column if not exists confirmation_email_sent_at timestamptz;

revoke all on table public.uniplug_key_orders from public, anon, authenticated;
grant all on table public.uniplug_key_orders to service_role;
