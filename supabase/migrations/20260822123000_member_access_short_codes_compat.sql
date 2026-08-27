-- Add friendly short codes without replacing the existing hashed-token access-link model.
-- Both link formats are limited by use count rather than elapsed time.

alter table public.uniplug_member_access_links
  add column if not exists code text;

create unique index if not exists uniplug_member_access_links_code_unique_idx
  on public.uniplug_member_access_links(code)
  where code is not null;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uniplug_member_access_links_code_format'
      AND conrelid = 'public.uniplug_member_access_links'::regclass
  ) THEN
    ALTER TABLE public.uniplug_member_access_links
      ADD CONSTRAINT uniplug_member_access_links_code_format
      CHECK (code IS NULL OR code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$');
  END IF;
END
$$;

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
      last_used_at = now(),
      revoked_at = case
        when link.use_count + 1 >= link.max_uses then now()
        else link.revoked_at
      end
  where link.code = upper(btrim(p_code))
    and link.revoked_at is null
    and link.use_count < link.max_uses
  returning link.user_id, link.subscription_id, link.use_count, link.max_uses, link.expires_at;
end;
$$;

revoke all on function public.uniplug_consume_member_access_link(text) from public, anon, authenticated;
grant execute on function public.uniplug_consume_member_access_link(text) to service_role;

comment on column public.uniplug_member_access_links.code is
  'Optional human-friendly 10-character access code for private three-use member links.';
