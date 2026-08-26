-- Admin-created member links are temporary service grants. The use limit controls
-- how many times the secret link can be consumed; it must not revoke an already
-- authenticated member's grant before the 48-hour expiry.

create or replace function public.uniplug_consume_member_access_link(p_code text)
returns table (
  user_id uuid,
  subscription_id uuid,
  use_count smallint,
  max_uses smallint,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_code is null or p_code !~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$' then
    return;
  end if;

  return query
  update public.uniplug_member_access_links as link
  set use_count = (link.use_count + 1)::smallint,
      last_used_at = now()
  where link.code = upper(btrim(p_code))
    and link.revoked_at is null
    and link.expires_at > now()
    and link.use_count < link.max_uses
  returning link.user_id, link.subscription_id, link.use_count, link.max_uses, link.expires_at;
end;
$$;

revoke all on function public.uniplug_consume_member_access_link(text) from public, anon, authenticated;
grant execute on function public.uniplug_consume_member_access_link(text) to service_role;

create or replace function public.uniplug_has_member_access_grant(p_subscription_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.uniplug_member_access_links as link
    where link.user_id = auth.uid()
      and link.last_used_at is not null
      and link.use_count > 0
      and link.expires_at > now()
      and link.revoked_at is null
      and (p_subscription_id is null or link.subscription_id = p_subscription_id)
  );
$$;

revoke all on function public.uniplug_has_member_access_grant(uuid) from public, anon;
grant execute on function public.uniplug_has_member_access_grant(uuid) to authenticated, service_role;

comment on function public.uniplug_has_member_access_grant(uuid) is
  'Returns true when the authenticated member has consumed a non-revoked admin access link that remains inside its time-to-live. max_uses limits future link opens, not the active grant.';

-- Existing links that were auto-revoked exactly when they consumed their final
-- allowed open were not manually revoked. Preserve their still-valid grants;
-- the use_count predicate continues to prevent a fourth link consumption.
update public.uniplug_member_access_links
set revoked_at = null
where last_used_at is not null
  and revoked_at = last_used_at
  and use_count >= max_uses
  and expires_at > now();

-- The credential RPC should accept either a normal active entitlement or the
-- temporary admin-issued grant for this exact subscription.
do $migration$
declare
  v_definition text;
  v_old constant text := 'and subscription.status in (''active'', ''due_soon'', ''trial'')';
  v_new constant text := E'and (subscription.status in (''active'', ''due_soon'', ''trial'')\n      or public.uniplug_has_member_access_grant(p_client_subscription_id))';
begin
  select pg_get_functiondef('private.uniplug_get_client_account_access(uuid)'::regprocedure)
  into v_definition;

  if strpos(v_definition, v_new) > 0 then
    return;
  end if;

  if strpos(v_definition, v_old) = 0 then
    raise exception 'UniPlug account-access status predicate was not found';
  end if;

  execute replace(v_definition, v_old, v_new);
end;
$migration$;
