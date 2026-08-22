-- Keep the existing /admin/requests support controls compatible with Support V2.
-- When legacy admin tooling changes admin_note, mirror that note into the
-- threaded message table unless the new Support inbox already inserted it.

create or replace function public.uniplug_bridge_legacy_support_admin_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.admin_note is null
     or btrim(new.admin_note) = ''
     or new.admin_note is not distinct from old.admin_note then
    return new;
  end if;

  if not exists (
    select 1
    from public.uniplug_support_messages m
    where m.ticket_id = new.id
      and m.sender_role = 'admin'
      and m.body = new.admin_note
      and m.created_at >= now() - interval '10 seconds'
  ) then
    insert into public.uniplug_support_messages(ticket_id, sender_id, sender_role, body)
    values(new.id, new.resolved_by, 'admin', new.admin_note);
  end if;

  return new;
end;
$$;

drop trigger if exists uniplug_bridge_legacy_support_admin_note_trigger
  on public.uniplug_support_tickets;
create trigger uniplug_bridge_legacy_support_admin_note_trigger
after update of admin_note on public.uniplug_support_tickets
for each row execute function public.uniplug_bridge_legacy_support_admin_note();

revoke all on function public.uniplug_bridge_legacy_support_admin_note() from public;
