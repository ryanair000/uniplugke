-- Phase 2 RPC surface hardening: Lokimax has explicit default EXECUTE grants
-- for API roles, so revoking only from PUBLIC is insufficient.

revoke all on function public.is_uniplug_member() from public, anon, authenticated;
revoke all on function public.is_uniplug_admin() from public, anon, authenticated;
revoke all on function public.uniplug_complete_onboarding() from public, anon, authenticated;
revoke all on function public.uniplug_create_member_order(uuid[], text) from public, anon, authenticated;
revoke all on function public.uniplug_create_renewal_order(uuid, text) from public, anon, authenticated;
revoke all on function public.uniplug_log_order_event() from public, anon, authenticated;
revoke all on function public.uniplug_log_subscription_event() from public, anon, authenticated;
revoke all on function public.uniplug_touch_updated_at() from public, anon, authenticated;

grant execute on function public.is_uniplug_member() to authenticated;
grant execute on function public.is_uniplug_admin() to authenticated;
grant execute on function public.uniplug_complete_onboarding() to authenticated;
grant execute on function public.uniplug_create_member_order(uuid[], text) to authenticated;
grant execute on function public.uniplug_create_renewal_order(uuid, text) to authenticated;
