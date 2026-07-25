-- Phase 2: record password changes without storing password material.

create or replace function public.uniplug_record_password_update()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or not public.is_uniplug_member() then
    raise exception 'Active UniPlug membership is required';
  end if;
  insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
  values(v_user_id,'password_updated','Private password updated','Your UniPlug sign-in password was changed.','profile',v_user_id);
end;
$$;

grant execute on function public.uniplug_record_password_update() to authenticated;
