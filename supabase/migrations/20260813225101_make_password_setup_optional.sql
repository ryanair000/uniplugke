-- A temporary invitation password no longer blocks access to the member
-- dashboard. Complete onboarding on the first authenticated session and leave
-- a reminder in the member's notification feed instead.
create or replace function public.uniplug_complete_onboarding()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_first_login boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  update public.uniplug_profiles
  set status = 'active',
      onboarding_completed_at = coalesce(onboarding_completed_at, now()),
      updated_at = now()
  where user_id = v_user_id
    and status in ('pending', 'active');
  if not found then
    raise exception 'A UniPlug membership was not found';
  end if;

  update public.client_portal_accounts
  set must_change_password = false,
      last_login_at = now(),
      updated_at = now()
  where user_id = v_user_id
    and must_change_password = true;
  v_first_login := found;

  update public.uniplug_invitations
  set status = 'completed', completed_at = coalesce(completed_at, now())
  where user_id = v_user_id and status = 'created';

  if v_first_login then
    insert into public.uniplug_member_events(
      user_id, event_type, title, detail, entity_type, entity_id
    ) values (
      v_user_id,
      'profile_updated',
      'Update your private password',
      'You are signed in with the password from your invitation. You can change it anytime in Account settings.',
      'profile',
      v_user_id
    );
  end if;
end;
$$;

revoke all on function public.uniplug_complete_onboarding() from public, anon;
grant execute on function public.uniplug_complete_onboarding() to authenticated;

comment on function public.uniplug_complete_onboarding() is
  'Activates an authenticated invitation without requiring an immediate password change and records a one-time password reminder.';
