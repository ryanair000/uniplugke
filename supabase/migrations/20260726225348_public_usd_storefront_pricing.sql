-- Visitors see a deliberately public USD starting price. Exact KSh plan prices
-- remain in uniplug_member_plans and retain their active-member RLS boundary.
alter table public.uniplug_catalog_services
  add column if not exists starting_price_usd numeric(12,2);

alter table public.uniplug_catalog_services
  drop constraint if exists uniplug_catalog_services_starting_price_usd_check;

alter table public.uniplug_catalog_services
  add constraint uniplug_catalog_services_starting_price_usd_check
  check (starting_price_usd is null or starting_price_usd > 0);

comment on column public.uniplug_catalog_services.starting_price_usd is
  'Public visitor-facing starting price in USD. This is not used for checkout.';

-- Seed existing services from their lowest active member plan once. The
-- 130 KSh/USD merchandising rate is only an initial display value; admins can
-- manage the public USD price independently of exact KSh member plans.
update public.uniplug_catalog_services as service
set starting_price_usd = derived.starting_price_usd
from (
  select
    service_id,
    round(min(price_kes) / 130.0, 2) as starting_price_usd
  from public.uniplug_member_plans
  where is_active
    and availability_status <> 'unavailable'
  group by service_id
) as derived
where service.id = derived.service_id
  and service.starting_price_usd is null;
