-- Friendly, short-lived member access links.
-- The public URL carries only a random short code. The server consumes that code
-- atomically, then creates a fresh one-time Supabase magic link internally.

create table if not exists public.uniplug_member_access_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.client_subscriptions(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  max_uses smallint not null default 3,
  use_count smallint not null default 0,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint uniplug_member_access_links_code_format
    check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$'),
  constraint uniplug_member_access_links_max_uses
    check (max_uses between 1 and 10),
  constraint uniplug_member_access_links_use_count
    check (use_count between 0 and max_uses),
  constraint uniplug_member_access_links_expiry
    check (expires_at > created_at)
);

create index if not exists uniplug_member_access_links_member_idx
  on public.uniplug_member_access_links(user_id, subscription_id, created_at desc);

create index if not exists uniplug_member_access_links_active_idx
  on public.uniplug_member_access_links(expires_at)
  where revoked_at is null;

alter table public.uniplug_member_access_links enable row level security;

-- No browser role can read the link registry directly. Access is server-only.
revoke all on public.uniplug_member_access_links from public, anon, authenticated;

create or replace function public.uniplug_consume_member_access_link(p_code text)
returns table(user_id uuid, subscription_id uuid)
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
begin
  return query
  update public.uniplug_member_access_links link
  set
    use_count = link.use_count + 1,
    last_used_at = now()
  where link.code = upper(btrim(p_code))
    and link.revoked_at is null
    and link.expires_at > now()
    and link.use_count < link.max_uses
  returning link.user_id, link.subscription_id;
end;
$$;

revoke all on function public.uniplug_consume_member_access_link(text) from public, anon, authenticated;
grant execute on function public.uniplug_consume_member_access_link(text) to service_role;
