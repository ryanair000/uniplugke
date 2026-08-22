create table if not exists public.uniplug_member_access_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.client_subscriptions(id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  max_uses smallint not null default 3 check (max_uses between 1 and 20),
  use_count smallint not null default 0 check (use_count >= 0 and use_count <= max_uses),
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists uniplug_member_access_links_user_subscription_idx
  on public.uniplug_member_access_links(user_id, subscription_id, created_at desc);
create index if not exists uniplug_member_access_links_active_idx
  on public.uniplug_member_access_links(expires_at)
  where revoked_at is null;

alter table public.uniplug_member_access_links enable row level security;
revoke all on public.uniplug_member_access_links from public, anon, authenticated;
grant all on public.uniplug_member_access_links to service_role;

create or replace function public.uniplug_consume_member_access_link(
  p_token_hash text,
  p_subscription_id uuid
)
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
  if p_token_hash is null or char_length(p_token_hash) <> 64 or p_subscription_id is null then
    return;
  end if;

  return query
  update public.uniplug_member_access_links as link
  set use_count = (link.use_count + 1)::smallint,
      last_used_at = now(),
      revoked_at = case
        when link.use_count + 1 >= link.max_uses then now()
        else link.revoked_at
      end
  where link.token_hash = p_token_hash
    and link.subscription_id = p_subscription_id
    and link.revoked_at is null
    and link.expires_at > now()
    and link.use_count < link.max_uses
  returning link.user_id, link.subscription_id, link.use_count, link.max_uses, link.expires_at;
end;
$$;

revoke all on function public.uniplug_consume_member_access_link(text, uuid) from public, anon, authenticated;
grant execute on function public.uniplug_consume_member_access_link(text, uuid) to service_role;

create or replace function public.uniplug_revoke_member_access_links_on_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status not in ('active', 'pending') then
    update public.uniplug_member_access_links
    set revoked_at = coalesce(revoked_at, now())
    where user_id = new.user_id and revoked_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists uniplug_revoke_member_access_links_on_profile_status on public.uniplug_profiles;
create trigger uniplug_revoke_member_access_links_on_profile_status
after update of status on public.uniplug_profiles
for each row execute function public.uniplug_revoke_member_access_links_on_profile_status();

create or replace function public.uniplug_revoke_member_access_links_on_password_reset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.must_change_password = true and new.must_change_password is distinct from old.must_change_password then
    update public.uniplug_member_access_links
    set revoked_at = coalesce(revoked_at, now())
    where user_id = new.user_id and revoked_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists uniplug_revoke_member_access_links_on_password_reset on public.client_portal_accounts;
create trigger uniplug_revoke_member_access_links_on_password_reset
after update of must_change_password on public.client_portal_accounts
for each row execute function public.uniplug_revoke_member_access_links_on_password_reset();

revoke all on function public.uniplug_revoke_member_access_links_on_profile_status() from public, anon, authenticated;
revoke all on function public.uniplug_revoke_member_access_links_on_password_reset() from public, anon, authenticated;

drop function if exists public.vip_consume_access_link(text);

comment on table public.uniplug_member_access_links is
  'Private UniPlug member sign-in links scoped to one subscription, with server-enforced expiry and usage limits.';
comment on function public.uniplug_consume_member_access_link(text, uuid) is
  'Atomically consumes one successful use of a private UniPlug member access link.';
