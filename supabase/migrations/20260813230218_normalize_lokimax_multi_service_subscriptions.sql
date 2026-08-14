-- Normalize Lokimax's legacy JSON service bundles into one portal subscription
-- per service. The first generated item keeps the original hub subscription
-- code so existing IDs and related operational history remain attached.

create or replace function public.hub_try_jsonb(p_value text)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then
    return null;
  end if;
  return p_value::jsonb;
exception when others then
  return null;
end;
$$;

create or replace function public.hub_try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then
    return null;
  end if;
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.hub_try_date(p_value text)
returns date
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then
    return null;
  end if;
  return p_value::date;
exception when others then
  return null;
end;
$$;

revoke all on function public.hub_try_jsonb(text) from public, anon, authenticated;
revoke all on function public.hub_try_uuid(text) from public, anon, authenticated;
revoke all on function public.hub_try_date(text) from public, anon, authenticated;
grant execute on function public.hub_try_jsonb(text) to service_role;
grant execute on function public.hub_try_uuid(text) to service_role;
grant execute on function public.hub_try_date(text) to service_role;

create or replace function public.hub_sync_subscription(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.subscriptions%rowtype;
  v_client_id uuid;
  v_company_id uuid;
  v_service_id uuid;
  v_subscription_id uuid;
  v_billing_cycle text;
  v_subscription_status text;
  v_service_name text;
  v_items jsonb;
  v_item jsonb;
  v_item_record record;
  v_item_count integer;
  v_item_index integer;
  v_subscription_code text;
  v_slot_id uuid;
  v_slot_service_id uuid;
  v_item_service_id uuid;
  v_account_id uuid;
  v_slot_renewal_date date;
  v_item_renewal_date date;
  v_next_renewal_date date;
  v_slot_status text;
  v_slot_account text;
  v_slot_service_name text;
  v_account_mail text;
  v_account_reference text;
  v_service_identifier text;
  v_item_amount numeric(14,2);
  v_metadata jsonb;
begin
  select * into v_row
  from public.subscriptions
  where id = p_id;
  if not found then
    return null;
  end if;

  v_company_id := public.hub_get_company_id('lmx-hub');
  v_billing_cycle := case lower(coalesce(v_row.renewal_period, 'monthly'))
    when 'weekly' then 'weekly'
    when 'quarterly' then 'quarterly'
    when 'semiannual' then 'semiannual'
    when 'annual' then 'annual'
    when 'custom' then 'custom'
    else 'monthly'
  end;

  -- Once a legacy subscription has been exposed through a portal account,
  -- preserve that established owner. CRM deduping may later resolve the source
  -- row to another client, but moving a live subscription would orphan its
  -- renewals and make it disappear from the invited customer's wallet.
  select hub.client_id, hub.company_id
  into v_client_id, v_company_id
  from public.client_subscriptions as hub
  where hub.subscription_code = 'legacy-subscriptions:' || v_row.id::text
  limit 1;

  if v_client_id is null then
    if v_row.crm_profile_id is not null then
      v_client_id := public.hub_sync_crm_profile(v_row.crm_profile_id);
    end if;
    if v_client_id is null then
      v_client_id := public.hub_sync_source_client(
        'lmx-hub',
        'lmx_hub',
        'subscriptions',
        v_row.id::text,
        v_row.username,
        null,
        v_row.phone_number,
        v_row.status,
        v_row.created_at,
        v_row.updated_at,
        to_jsonb(v_row)
      );
    end if;
    v_company_id := public.hub_get_company_id('lmx-hub');
  end if;

  v_items := public.hub_try_jsonb(v_row.service_type);
  if coalesce(jsonb_typeof(v_items), '') <> 'array' or jsonb_array_length(v_items) = 0 then
    v_items := jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'service_type', public.hub_safe_subscription_service_name(v_row.service_type, v_row.plan),
      'service_mail', v_row.service_mail,
      'slot_id', v_row.slot_id,
      'account_id', v_row.account_id,
      'renewal_date', v_row.renewal_date
    )));
  end if;
  v_item_count := jsonb_array_length(v_items);

  for v_item_record in
    select entry.value as item, entry.ordinality::integer as item_index
    from jsonb_array_elements(v_items) with ordinality as entry(value, ordinality)
  loop
    v_item := v_item_record.item;
    v_item_index := v_item_record.item_index;
    v_slot_id := public.hub_try_uuid(v_item->>'slot_id');
    v_account_id := public.hub_try_uuid(v_item->>'account_id');
    v_item_service_id := public.hub_try_uuid(v_item->>'service_id');

    if v_item_index = 1 then
      v_slot_id := coalesce(v_slot_id, v_row.slot_id);
      v_account_id := coalesce(v_account_id, v_row.account_id);
    end if;

    v_slot_renewal_date := null;
    v_slot_status := null;
    v_slot_account := null;
    v_slot_service_id := null;
    v_slot_service_name := null;
    if v_slot_id is not null then
      select slot.expiry_date, slot.status, nullif(btrim(slot.account), ''), slot.service_id,
             nullif(btrim(source_service.service_name), '')
      into v_slot_renewal_date, v_slot_status, v_slot_account, v_slot_service_id,
           v_slot_service_name
      from public.slots as slot
      left join public.services as source_service on source_service.id = slot.service_id
      where slot.id = v_slot_id;
    end if;

    if v_slot_service_name is null and v_item_service_id is not null then
      select nullif(btrim(source_service.service_name), '')
      into v_slot_service_name
      from public.services as source_service
      where source_service.id = v_item_service_id;
    end if;

    v_service_name := coalesce(
      v_slot_service_name,
      nullif(btrim(v_item->>'service_type'), ''),
      public.hub_safe_subscription_service_name(v_row.service_type, v_row.plan)
    );
    v_item_renewal_date := public.hub_try_date(v_item->>'renewal_date');
    v_next_renewal_date := coalesce(
      v_slot_renewal_date,
      v_item_renewal_date,
      v_row.renewal_date
    );
    v_subscription_status := public.hub_source_subscription_status(
      coalesce(v_slot_status, v_row.status),
      v_next_renewal_date
    );
    v_service_id := public.hub_get_or_create_service(
      'lmx-hub',
      v_service_name,
      'renewal',
      v_billing_cycle
    );

    v_account_mail := null;
    if v_account_id is not null then
      select nullif(btrim(account.account_mail), '')
      into v_account_mail
      from public.accounts as account
      where account.id = v_account_id;
    end if;
    v_service_identifier := coalesce(
      nullif(btrim(v_item->>'service_mail'), ''),
      nullif(btrim(v_item->>'account_mail'), ''),
      v_slot_account,
      case when v_item_count = 1 then public.hub_clean_contact_text(v_row.service_mail) end
    );
    v_account_reference := coalesce(
      v_slot_account,
      v_account_mail,
      v_service_identifier,
      case when v_item_count = 1 then public.hub_clean_contact_text(v_row.username) end
    );

    -- The legacy row stores one total for the whole bundle. Keep that total on
    -- the first item only so operational renewal totals are not multiplied.
    v_item_amount := case
      when v_item_count > 1 and v_item_index > 1 then 0
      else coalesce(v_row.bill_amount, 0)
    end;
    v_subscription_code := 'legacy-subscriptions:' || v_row.id::text ||
      case when v_item_index = 1 then '' else ':item:' || v_item_index::text end;
    v_metadata := jsonb_strip_nulls(jsonb_build_object(
      'legacy_table', 'subscriptions',
      'legacy_id', v_row.id::text,
      'legacy', public.hub_sanitize_legacy_source('subscriptions', to_jsonb(v_row)),
      'last_live_sync_at', now(),
      'sync_version', 2,
      'bundle_item_count', v_item_count,
      'bundle_item_index', v_item_index,
      'bundle_total_amount', coalesce(v_row.bill_amount, 0),
      'bundle_total_currency', 'KES',
      'source_service_name', v_service_name,
      'assigned_slot_id', v_slot_id,
      'assigned_account_id', v_account_id,
      'portal_hidden', false
    ));

    insert into public.client_subscriptions (
      client_id,
      company_id,
      service_id,
      subscription_code,
      service_identifier,
      account_reference,
      start_date,
      next_renewal_date,
      billing_cycle,
      amount,
      currency,
      status,
      notes,
      metadata,
      created_at,
      updated_at
    ) values (
      v_client_id,
      v_company_id,
      v_service_id,
      v_subscription_code,
      v_service_identifier,
      v_account_reference,
      v_row.created_at::date,
      v_next_renewal_date,
      v_billing_cycle,
      v_item_amount,
      'KES',
      v_subscription_status,
      public.hub_clean_contact_text(v_row.plan),
      v_metadata,
      coalesce(v_row.created_at, now()),
      coalesce(v_row.updated_at, now())
    )
    on conflict (subscription_code) do update
    set
      service_id = excluded.service_id,
      service_identifier = excluded.service_identifier,
      account_reference = excluded.account_reference,
      next_renewal_date = excluded.next_renewal_date,
      billing_cycle = excluded.billing_cycle,
      amount = excluded.amount,
      status = excluded.status,
      notes = excluded.notes,
      metadata = (
        coalesce(public.client_subscriptions.metadata, '{}'::jsonb)
          - 'assigned_slot_id'
          - 'assigned_account_id'
          - 'portal_hidden'
      ) || excluded.metadata,
      updated_at = now()
    returning id into v_subscription_id;

    update public.client_renewals as renewal
    set
      status = 'cancelled',
      metadata = coalesce(renewal.metadata, '{}'::jsonb) || jsonb_build_object(
        'superseded_by_live_sync', true,
        'superseded_at', now()
      ),
      updated_at = now()
    where renewal.subscription_id = v_subscription_id
      and renewal.due_date is distinct from v_next_renewal_date
      and renewal.status <> 'paid'
      and renewal.metadata->>'legacy_table' = 'subscriptions'
      and renewal.metadata->>'legacy_id' = v_row.id::text;

    if v_next_renewal_date is not null then
      insert into public.client_renewals (
        subscription_id,
        client_id,
        company_id,
        due_date,
        amount_due,
        amount_paid,
        currency,
        status,
        metadata,
        created_at,
        updated_at
      ) values (
        v_subscription_id,
        v_client_id,
        v_company_id,
        v_next_renewal_date,
        v_item_amount,
        0,
        'KES',
        public.hub_source_renewal_status(v_next_renewal_date, v_subscription_status),
        jsonb_build_object(
          'legacy_table', 'subscriptions',
          'legacy_id', v_row.id::text,
          'bundle_item_index', v_item_index,
          'created_by_live_sync', true
        ),
        coalesce(v_row.created_at, now()),
        coalesce(v_row.updated_at, now())
      )
      on conflict (subscription_id, due_date) do update
      set
        client_id = excluded.client_id,
        company_id = excluded.company_id,
        amount_due = excluded.amount_due,
        status = case
          when public.client_renewals.status = 'paid' then 'paid'
          else excluded.status
        end,
        metadata = coalesce(public.client_renewals.metadata, '{}'::jsonb) || excluded.metadata,
        updated_at = now();
    end if;
  end loop;

  -- Keep historical child IDs but hide any service item removed from the
  -- source bundle so related replacement and support history is not deleted.
  update public.client_subscriptions as hub
  set
    status = 'cancelled',
    metadata = coalesce(hub.metadata, '{}'::jsonb) || jsonb_build_object(
      'portal_hidden', true,
      'removed_from_source_at', now()
    ),
    updated_at = now()
  where hub.metadata->>'legacy_table' = 'subscriptions'
    and hub.metadata->>'legacy_id' = v_row.id::text
    and hub.subscription_code like 'legacy-subscriptions:' || v_row.id::text || ':item:%'
    and coalesce((hub.metadata->>'bundle_item_index')::integer, 0) > v_item_count;

  return v_client_id;
end;
$$;

revoke all on function public.hub_sync_subscription(uuid) from public, anon, authenticated;
grant execute on function public.hub_sync_subscription(uuid) to service_role;

-- The original account-only trigger duplicates the complete sync trigger and
-- only updates the unsplit parent row. The complete sync now handles accounts.
drop trigger if exists hub_uniplug_subscription_account_sync on public.subscriptions;

create index if not exists idx_client_subscriptions_assigned_slot
  on public.client_subscriptions ((metadata->>'assigned_slot_id'))
  where metadata->>'legacy_table' = 'subscriptions';

create or replace function public.hub_sync_slot_subscription_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_legacy_id text;
begin
  for v_legacy_id in
    select distinct subscription.metadata->>'legacy_id'
    from public.client_subscriptions as subscription
    where subscription.metadata->>'legacy_table' = 'subscriptions'
      and subscription.metadata->>'assigned_slot_id' = new.id::text
      and subscription.metadata->>'legacy_id' is not null
  loop
    perform public.hub_sync_subscription(public.hub_try_uuid(v_legacy_id));
  end loop;
  return new;
end;
$$;

revoke all on function public.hub_sync_slot_subscription_trigger()
  from public, anon, authenticated;
grant execute on function public.hub_sync_slot_subscription_trigger() to service_role;

drop trigger if exists hub_live_sync_slots_to_portal on public.slots;
create trigger hub_live_sync_slots_to_portal
after insert or update on public.slots
for each row execute function public.hub_sync_slot_subscription_trigger();

-- Resolve service-specific credentials from a normalized assigned slot before
-- falling back to the newer account pool or account-reference lookup.
create or replace function private.uniplug_get_client_account_access(
  p_client_subscription_id uuid
)
returns table(
  service_name text,
  account_email text,
  account_password text,
  verification_code text,
  profile_name text
)
language plpgsql
security definer
set search_path = pg_catalog, public, vault, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_account_id uuid;
  v_slot_id uuid;
  v_account_reference text;
  v_service_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select portal.client_id
  into v_client_id
  from public.client_portal_accounts as portal
  where portal.user_id = v_user_id
    and portal.must_change_password = false;
  if v_client_id is null then
    raise exception 'Complete password setup first';
  end if;

  select
    public.hub_try_uuid(subscription.metadata->>'assigned_account_id'),
    public.hub_try_uuid(subscription.metadata->>'assigned_slot_id'),
    subscription.account_reference,
    coalesce(service.name, subscription.service_identifier, 'Tracked service')
  into v_account_id, v_slot_id, v_account_reference, v_service_name
  from public.client_subscriptions as subscription
  left join public.client_services as service on service.id = subscription.service_id
  where subscription.id = p_client_subscription_id
    and subscription.client_id = v_client_id
    and subscription.status in ('active', 'due_soon', 'trial')
    and coalesce(subscription.metadata->>'portal_hidden', 'false') <> 'true';
  if not found then
    raise exception 'An active tracked service was not found';
  end if;

  if v_account_id is not null then
    return query
    select
      v_service_name,
      account.account_mail,
      coalesce(secret.decrypted_secret, account.account_password),
      account.verification_code,
      account.profile_name
    from public.accounts as account
    left join vault.decrypted_secrets as secret on secret.id = account.password_secret_id
    where account.id = v_account_id
    limit 1;
    if found then
      return;
    end if;
  end if;

  if v_slot_id is not null then
    return query
    select
      v_service_name,
      slot.account,
      slot.password,
      null::text,
      null::text
    from public.slots as slot
    where slot.id = v_slot_id
      and slot.status = 'active'
    limit 1;
    if found then
      return;
    end if;
  end if;

  return query
  select
    v_service_name,
    account.account_mail,
    coalesce(secret.decrypted_secret, account.account_password),
    account.verification_code,
    account.profile_name
  from public.accounts as account
  left join vault.decrypted_secrets as secret on secret.id = account.password_secret_id
  where lower(account.account_mail) = lower(v_account_reference)
  limit 1;
end;
$$;

revoke all on function private.uniplug_get_client_account_access(uuid)
  from public, anon, authenticated;
grant execute on function private.uniplug_get_client_account_access(uuid)
  to authenticated, service_role;

revoke all on function public.hub_sync_subscription_trigger()
  from public, anon, authenticated;
grant execute on function public.hub_sync_subscription_trigger() to service_role;

-- Rebuild all legacy subscription projections. This is idempotent and keeps
-- the original first-item subscription IDs through the stable parent code.
do $$
declare
  v_source record;
begin
  for v_source in select id from public.subscriptions order by created_at, id
  loop
    perform public.hub_sync_subscription(v_source.id);
  end loop;
end;
$$;

-- Abort atomically if the backfill dropped items, multiplied bundle totals, or
-- left a JSON bundle attached to the generic fallback service.
do $$
declare
  v_expected_items bigint;
  v_actual_items bigint;
  v_mismatched_totals bigint;
  v_generic_bundles bigint;
begin
  select sum(
    case
      when jsonb_typeof(public.hub_try_jsonb(source.service_type)) = 'array'
        and jsonb_array_length(public.hub_try_jsonb(source.service_type)) > 0
      then jsonb_array_length(public.hub_try_jsonb(source.service_type))
      else 1
    end
  )
  into v_expected_items
  from public.subscriptions as source;

  select count(*)
  into v_actual_items
  from public.client_subscriptions as hub
  where hub.metadata->>'legacy_table' = 'subscriptions'
    and hub.metadata->>'sync_version' = '2'
    and coalesce(hub.metadata->>'portal_hidden', 'false') <> 'true';

  if v_actual_items <> v_expected_items then
    raise exception 'Lokimax portal backfill item mismatch: expected %, found %',
      v_expected_items, v_actual_items;
  end if;

  select count(*)
  into v_mismatched_totals
  from (
    select source.id
    from public.subscriptions as source
    join public.client_subscriptions as hub
      on public.hub_try_uuid(hub.metadata->>'legacy_id') = source.id
     and hub.metadata->>'legacy_table' = 'subscriptions'
     and hub.metadata->>'sync_version' = '2'
     and coalesce(hub.metadata->>'portal_hidden', 'false') <> 'true'
    group by source.id, source.bill_amount
    having sum(hub.amount) <> coalesce(source.bill_amount, 0)
  ) as mismatched;

  if v_mismatched_totals > 0 then
    raise exception 'Lokimax portal backfill multiplied % bundle totals',
      v_mismatched_totals;
  end if;

  select count(*)
  into v_generic_bundles
  from public.client_subscriptions as hub
  join public.subscriptions as source
    on source.id = public.hub_try_uuid(hub.metadata->>'legacy_id')
  join public.client_services as service on service.id = hub.service_id
  where jsonb_typeof(public.hub_try_jsonb(source.service_type)) = 'array'
    and lower(service.name) = 'general renewal'
    and coalesce(hub.metadata->>'portal_hidden', 'false') <> 'true';

  if v_generic_bundles > 0 then
    raise exception 'Lokimax portal backfill left % bundled services as General renewal',
      v_generic_bundles;
  end if;
end;
$$;
