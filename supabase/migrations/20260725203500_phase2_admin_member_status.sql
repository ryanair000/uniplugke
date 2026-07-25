-- Phase 2: allow UniPlug admins to change member status without granting clients direct status updates.

create or replace function public.uniplug_set_member_status(
  p_user_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_uniplug_admin() then raise exception 'UniPlug admin access required'; end if;
  if p_status not in ('active','suspended','pending') then raise exception 'Invalid member status'; end if;
  if p_user_id = (select auth.uid()) and p_status <> 'active' then
    raise exception 'You cannot suspend your own administrator account';
  end if;

  update public.uniplug_profiles
  set status = p_status,
      updated_at = now()
  where user_id = p_user_id;

  if not found then raise exception 'Member profile not found'; end if;

  insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
  values(
    p_user_id,
    'profile_updated',
    'Membership status updated',
    'Your UniPlug membership status is now ' || p_status || '.',
    'profile',
    p_user_id
  );
end;
$$;

grant execute on function public.uniplug_set_member_status(uuid,text) to authenticated;
