-- UniPlug compatibility layer for the shared LokiMax client identity graph.
-- LokiMax owns identity discovery/seeding; UniPlug owns the portal-facing access policy.

create table if not exists public.client_identity_aliases (
  alias_client_id uuid primary key references public.clients(id) on delete cascade,
  canonical_client_id uuid not null references public.clients(id) on delete cascade,
  reason text not null default 'manual',
  confidence numeric(5,4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (alias_client_id <> canonical_client_id),
  check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists client_identity_aliases_canonical_idx
  on public.client_identity_aliases(canonical_client_id);

alter table public.client_identity_aliases enable row level security;
revoke all on public.client_identity_aliases from anon, authenticated;
grant all on public.client_identity_aliases to service_role;

create or replace function public.hub_resolve_client_id(p_client_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_current uuid := p_client_id;
  v_next uuid;
  v_seen uuid[] := array[]::uuid[];
begin
  if v_current is null then return null; end if;
  for i in 1..16 loop
    if v_current = any(v_seen) then return v_current; end if;
    v_seen := array_append(v_seen, v_current);
    select canonical_client_id into v_next
    from public.client_identity_aliases
    where alias_client_id = v_current;
    if v_next is null then return v_current; end if;
    v_current := v_next;
  end loop;
  return v_current;
end;
$$;

revoke all on function public.hub_resolve_client_id(uuid) from public, anon, authenticated;
grant execute on function public.hub_resolve_client_id(uuid) to service_role;

update public.client_identity_aliases as alias
set canonical_client_id = public.hub_resolve_client_id(alias.canonical_client_id),
    updated_at = now()
where alias.canonical_client_id is distinct from public.hub_resolve_client_id(alias.canonical_client_id);

create or replace function public.hub_guard_client_identity_alias()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_canonical uuid;
begin
  if new.alias_client_id is null or new.canonical_client_id is null then
    raise exception 'Alias and canonical client ids are required';
  end if;
  v_canonical := public.hub_resolve_client_id(new.canonical_client_id);
  if v_canonical = new.alias_client_id then
    raise exception 'Client identity alias would create a cycle';
  end if;
  new.canonical_client_id := v_canonical;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.hub_guard_client_identity_alias() from public, anon, authenticated;
grant execute on function public.hub_guard_client_identity_alias() to service_role;

drop trigger if exists client_identity_aliases_guard on public.client_identity_aliases;
create trigger client_identity_aliases_guard
before insert or update of alias_client_id, canonical_client_id
on public.client_identity_aliases
for each row execute function public.hub_guard_client_identity_alias();

create or replace function public.hub_same_client_family(p_left uuid, p_right uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_left is not null
     and p_right is not null
     and public.hub_resolve_client_id(p_left) = public.hub_resolve_client_id(p_right);
$$;

revoke all on function public.hub_same_client_family(uuid, uuid) from public, anon;
grant execute on function public.hub_same_client_family(uuid, uuid) to authenticated, service_role;

drop policy if exists "Portal users read own subscriptions" on public.client_subscriptions;
create policy "Portal users read own subscriptions"
on public.client_subscriptions
for select
to authenticated
using (
  coalesce(client_subscriptions.metadata->>'portal_hidden', 'false') <> 'true'
  and coalesce(client_subscriptions.metadata->>'interest_only', 'false') <> 'true'
  and exists (
    select 1
    from public.client_portal_accounts portal
    where portal.user_id = (select auth.uid())
      and portal.must_change_password = false
      and public.hub_same_client_family(portal.client_id, client_subscriptions.client_id)
  )
);

drop policy if exists "Portal users read own services" on public.client_services;
create policy "Portal users read own services"
on public.client_services
for select
to authenticated
using (
  exists (
    select 1
    from public.client_subscriptions subscription
    join public.client_portal_accounts portal
      on public.hub_same_client_family(portal.client_id, subscription.client_id)
    where portal.user_id = (select auth.uid())
      and portal.must_change_password = false
      and subscription.service_id = client_services.id
      and coalesce(subscription.metadata->>'portal_hidden', 'false') <> 'true'
      and coalesce(subscription.metadata->>'interest_only', 'false') <> 'true'
  )
);

update public.client_portal_accounts portal
set client_id = public.hub_resolve_client_id(portal.client_id),
    updated_at = now()
where portal.client_id is distinct from public.hub_resolve_client_id(portal.client_id);
