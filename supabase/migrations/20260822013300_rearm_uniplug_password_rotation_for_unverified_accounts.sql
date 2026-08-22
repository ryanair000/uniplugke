-- Historical onboarding code could clear must_change_password before a real
-- password update. Re-arm the flag for active non-admin accounts that have no
-- recorded successful password-update event.

update public.client_portal_accounts portal
set must_change_password = true,
    updated_at = now()
from public.uniplug_profiles profile
where profile.user_id = portal.user_id
  and profile.status = 'active'
  and profile.role <> 'admin'
  and portal.must_change_password = false
  and not exists (
    select 1
    from public.uniplug_member_events event
    where event.user_id = portal.user_id
      and event.event_type = 'password_updated'
  );
