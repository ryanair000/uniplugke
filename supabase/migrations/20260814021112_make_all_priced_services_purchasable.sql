-- Materialize every visible, priced Lokimax entertainment service into the
-- protected UniPlug catalog and give it a server-authoritative monthly KSh
-- member plan. The existing plan trigger creates the supported 1, 3, 6, 12
-- and 24 month offers for every inserted plan.

do $$
declare
  source record;
  member_service_id uuid;
begin
  for source in
    with profiles(service_key, slug, category_slug, display_name, logo_text, accent_color) as (
      values
        ('applemusic', 'apple-music', 'music', 'Apple Music', 'AM', '#fa243c'),
        ('appletv', 'apple-tv-plus', 'streaming', 'Apple TV+', 'TV+', '#111111'),
        ('betplus', 'bet-plus', 'streaming', 'BET+', 'B+', '#111111'),
        ('cinemax', 'cinemax', 'streaming', 'Cinemax', 'C', '#111111'),
        ('crunchyroll', 'crunchyroll', 'streaming', 'Crunchyroll', 'CR', '#f47521'),
        ('disneyplus', 'disney-plus', 'streaming', 'Disney+', 'D+', '#113ccf'),
        ('f1tv', 'f1-tv', 'streaming', 'F1 TV', 'F1', '#e10600'),
        ('foxnation', 'fox-nation', 'streaming', 'Fox Nation', 'FN', '#003366'),
        ('fubo', 'fubo', 'streaming', 'Fubo', 'F', '#fa4616'),
        ('hbomax', 'hbo-max', 'streaming', 'HBO Max', 'H', '#6f2cff'),
        ('hulu', 'hulu', 'streaming', 'Hulu', 'H', '#1ce783'),
        ('nbaleaguepass', 'nba-league-pass', 'streaming', 'NBA League Pass', 'NBA', '#1d428a'),
        ('netflix', 'netflix-premium', 'streaming', 'Netflix Premium', 'N', '#e50914'),
        ('nordvpn', 'nordvpn', 'security', 'NordVPN', 'N', '#4687ff'),
        ('peacock', 'peacock', 'streaming', 'Peacock', 'P', '#111111'),
        ('primevideo', 'prime-video', 'streaming', 'Prime Video', 'PV', '#00a8e1'),
        ('showmax', 'showmax', 'streaming', 'Showmax', 'S', '#7b2cff'),
        ('showtime', 'showtime', 'streaming', 'Showtime', 'SH', '#e31837'),
        ('starz', 'starz', 'streaming', 'Starz', 'S', '#111111'),
        ('youtube', 'youtube-premium', 'streaming', 'YouTube Premium', 'YT', '#ff0000')
    ),
    normalized as (
      select
        catalog.*,
        regexp_replace(lower(catalog.name), '[^a-z0-9]+', '', 'g') as raw_key
      from public.catalog
      where catalog.category = 'entertainment'
        and catalog.selling_price_1_month > 0
    ),
    canonical as (
      select
        normalized.*,
        case raw_key
          when 'f1' then 'f1tv'
          when 'fubotv' then 'fubo'
          when 'nba' then 'nbaleaguepass'
          when 'prime' then 'primevideo'
          else raw_key
        end as service_key
      from normalized
    ),
    ranked as (
      select
        canonical.*,
        row_number() over (
          partition by service_key
          order by created_at desc, id desc
        ) as source_rank
      from canonical
    )
    select
      ranked.id as source_id,
      ranked.selling_price_1_month as monthly_price_kes,
      ranked.stock_quantity,
      profiles.*
    from ranked
    join profiles using (service_key)
    where ranked.source_rank = 1
  loop
    insert into public.uniplug_catalog_services(
      id, slug, category_slug, name, short_description, description,
      logo_text, accent_color, features, supported_devices,
      setup_requirements, fulfillment_label, activation_window,
      replacement_summary, faqs, availability_status, is_active,
      starting_price_usd
    ) values (
      source.source_id,
      source.slug,
      source.category_slug,
      source.display_name,
      source.display_name || ' access with activation tracking and local member support.',
      source.display_name || ' access managed through the UniPlug member dashboard.',
      source.logo_text,
      source.accent_color,
      jsonb_build_array('Managed access', 'Renewal tracking', 'Member support'),
      jsonb_build_array('Smart TV', 'Mobile', 'Tablet', 'Browser'),
      jsonb_build_array('An active UniPlug membership', 'A supported device'),
      'Managed access',
      'Confirmed after account verification',
      'Eligible access issues can be reported from the member dashboard.',
      jsonb_build_array(jsonb_build_object(
        'question', 'How do I receive access?',
        'answer', 'Activation details appear securely in your dashboard once the service is ready.'
      )),
      case
        when coalesce(source.stock_quantity, 0) <= 0 then 'coming_soon'
        when source.stock_quantity <= 5 then 'limited'
        else 'available'
      end,
      true,
      round(source.monthly_price_kes / 130.0, 2)
    )
    on conflict (slug) do update
      set starting_price_usd = excluded.starting_price_usd,
          availability_status = excluded.availability_status,
          updated_at = now();

    select id into member_service_id
    from public.uniplug_catalog_services
    where slug = source.slug;

    if not exists (
      select 1
      from public.uniplug_member_plans plan
      where plan.service_id = member_service_id
        and plan.is_active
    ) then
      insert into public.uniplug_member_plans(
        service_id, plan_name, plan_code, price_kes, billing_cycle,
        plan_features, availability_status, is_active, sort_order
      ) values (
        member_service_id,
        source.display_name || ' Member Plan',
        source.slug || '-member',
        source.monthly_price_kes,
        'monthly',
        jsonb_build_array('Managed access', 'Renewal tracking', 'Member support'),
        case
          when coalesce(source.stock_quantity, 0) <= 0 then 'unavailable'
          when source.stock_quantity <= 5 then 'limited'
          else 'available'
        end,
        true,
        100
      )
      on conflict (plan_code) do update
        set service_id = excluded.service_id,
            plan_name = excluded.plan_name,
            price_kes = excluded.price_kes,
            plan_features = excluded.plan_features,
            availability_status = excluded.availability_status,
            is_active = true,
            updated_at = now();
    end if;
  end loop;
end
$$;

-- Repair duration coverage as well as creating it for newly inserted plans.
insert into public.uniplug_plan_duration_offers(
  plan_id, duration_months, discount_percent, badge, sort_order
)
select
  plan.id,
  offer.duration_months,
  offer.discount_percent,
  offer.badge,
  offer.sort_order
from public.uniplug_member_plans plan
cross join (values
  (1, 0::numeric, 'Most flexible'::text, 10),
  (3, 3::numeric, null::text, 20),
  (6, 8::numeric, 'Popular'::text, 30),
  (12, 13::numeric, 'Best value'::text, 40),
  (24, 17::numeric, 'Lowest monthly'::text, 50)
) as offer(duration_months, discount_percent, badge, sort_order)
where plan.is_active
on conflict (plan_id, duration_months) do nothing;
