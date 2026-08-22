-- Link support requests to a member order without exposing order details from another account.

alter table public.uniplug_support_tickets
  add column if not exists order_id uuid,
  add column if not exists order_number text;

alter table public.uniplug_support_tickets
  drop constraint if exists uniplug_support_tickets_order_number_check;
alter table public.uniplug_support_tickets
  add constraint uniplug_support_tickets_order_number_check
  check (order_number is null or char_length(order_number) <= 80);

create index if not exists uniplug_support_tickets_order_idx
  on public.uniplug_support_tickets(user_id, order_id)
  where order_id is not null;
