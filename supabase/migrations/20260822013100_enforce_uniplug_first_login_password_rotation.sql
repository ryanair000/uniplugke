-- Preserve the forced-password-rotation flag during onboarding. The flag is
-- cleared only after Supabase Auth has actually accepted a new password.

create or replace function public.uniplug_complete_onboarding()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication is required'; end if;

  update public.uniplug_profiles
  set status = 'active',
      onboarding_completed_at = coalesce(onboarding_completed_at, now()),
      updated_at = now()
  where user_id = v_user_id and status in ('pending','active');
  if not found then raise exception 'A pending UniPlug invitation was not found'; end if;

  update public.client_portal_accounts
  set last_login_at = now(),
      updated_at = now()
  where user_id = v_user_id;

  update public.uniplug_invitations
  set status = 'completed',
      completed_at = coalesce(completed_at, now())
  where user_id = v_user_id and status = 'created';
end;
$$;

create or replace function public.uniplug_record_password_update()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or not public.is_uniplug_member() then
    raise exception 'Active UniPlug membership is required';
  end if;

  update public.client_portal_accounts
  set must_change_password = false,
      updated_at = now()
  where user_id = v_user_id;

  insert into public.uniplug_member_events(user_id,event_type,title,detail,entity_type,entity_id)
  values(
    v_user_id,
    'password_updated',
    'Private password updated',
    'Your UniPlug sign-in password was changed.',
    'profile',
    v_user_id
  );
end;
$$;
