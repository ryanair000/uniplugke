-- Ticket inserts use the public-id sequence through the column default.
-- USAGE permits nextval during inserts; ticket authorization remains enforced by RLS.
grant usage on sequence public.uniplug_support_ticket_number_seq to authenticated;
grant usage on sequence public.uniplug_support_ticket_number_seq to service_role;
