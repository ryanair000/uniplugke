create table if not exists public.uniplug_key_orders (
  id uuid primary key default gen_random_uuid(),
  paystack_reference text not null unique,
  product_slug text not null check (product_slug in ('adobe-acrobat', 'windows-11-pro')),
  product_name text not null,
  licence_term text not null check (licence_term in ('month', 'year')),
  amount_kes numeric(12,2) not null check (amount_kes > 0),
  customer_email text not null,
  customer_phone text not null,
  payment_status text not null default 'pending',
  fulfillment_status text not null default 'awaiting_payment',
  paid_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.uniplug_key_orders enable row level security;
revoke all on table public.uniplug_key_orders from public, anon, authenticated;
grant all on table public.uniplug_key_orders to service_role;
create index if not exists uniplug_key_orders_created_idx on public.uniplug_key_orders(created_at desc);
create index if not exists uniplug_key_orders_fulfillment_idx on public.uniplug_key_orders(payment_status, fulfillment_status);

comment on table public.uniplug_key_orders is 'Server-created public software-key orders; inaccessible through the anonymous Data API.';
