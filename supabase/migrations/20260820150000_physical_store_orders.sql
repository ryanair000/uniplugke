create table if not exists public.uniplug_store_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  paystack_reference text not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  delivery_county text not null,
  delivery_city text not null,
  delivery_address text not null,
  delivery_notes text,
  subtotal_kes numeric(12,2) not null check (subtotal_kes > 0),
  delivery_fee_kes numeric(12,2) not null default 0 check (delivery_fee_kes >= 0),
  total_kes numeric(12,2) not null check (total_kes > 0),
  payment_status text not null default 'pending',
  fulfillment_status text not null default 'awaiting_payment',
  paid_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uniplug_store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.uniplug_store_orders(id) on delete cascade,
  product_source text not null check (product_source in ('uniplug_products', 'catalog')),
  product_source_id uuid not null,
  product_slug text not null,
  product_name text not null,
  category_label text not null,
  image_url text,
  unit_price_kes numeric(12,2) not null check (unit_price_kes > 0),
  quantity integer not null check (quantity between 1 and 10),
  line_total_kes numeric(12,2) not null check (line_total_kes > 0),
  created_at timestamptz not null default now()
);

alter table public.uniplug_store_orders enable row level security;
alter table public.uniplug_store_order_items enable row level security;

revoke all on table public.uniplug_store_orders from public, anon, authenticated;
revoke all on table public.uniplug_store_order_items from public, anon, authenticated;
grant all on table public.uniplug_store_orders to service_role;
grant all on table public.uniplug_store_order_items to service_role;

create index if not exists uniplug_store_orders_created_idx
  on public.uniplug_store_orders(created_at desc);
create index if not exists uniplug_store_orders_payment_idx
  on public.uniplug_store_orders(payment_status, fulfillment_status);
create index if not exists uniplug_store_order_items_order_idx
  on public.uniplug_store_order_items(order_id);

comment on table public.uniplug_store_orders is 'Server-created UniPlug physical-product orders; inaccessible through the anonymous Data API.';
comment on table public.uniplug_store_order_items is 'Server-validated physical order price snapshots sourced from the shared ChezaHub catalog.';
