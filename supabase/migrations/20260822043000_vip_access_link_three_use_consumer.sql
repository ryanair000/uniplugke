create or replace function public.vip_consume_access_link(p_token_hash text)
returns table (
  user_id uuid,
  use_count smallint,
  max_uses smallint,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    return;
  end if;

  return query
  update public.vip_access_links as link
  set use_count = (link.use_count + 1)::smallint,
      last_used_at = now(),
      revoked_at = case
        when link.use_count + 1 >= link.max_uses then now()
        else link.revoked_at
      end
  where link.token_hash = p_token_hash
    and link.revoked_at is null
    and link.expires_at > now()
    and link.use_count < link.max_uses
  returning link.user_id, link.use_count, link.max_uses, link.expires_at;
end;
$$;

revoke all on function public.vip_consume_access_link(text) from public, anon, authenticated;
grant execute on function public.vip_consume_access_link(text) to service_role;

comment on function public.vip_consume_access_link(text) is
  'Atomically consumes one use of a private VIP access link. The row is revoked when its configured use limit is reached.';
