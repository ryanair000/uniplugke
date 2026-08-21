begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

select ok(
  not has_function_privilege('anon', 'public.uniplug_update_member_profile(text,text,text,boolean,boolean)', 'execute'),
  'anonymous callers cannot execute the profile update RPC'
);
select ok(
  not has_function_privilege('anon', 'public.uniplug_request_subscription_action(uuid,text,text)', 'execute'),
  'anonymous callers cannot execute the subscription request RPC'
);
select ok(
  not has_function_privilege('anon', 'public.uniplug_resolve_subscription_request(uuid,text,text)', 'execute'),
  'anonymous callers cannot execute the request resolution RPC'
);
select ok(
  not has_function_privilege('anon', 'public.uniplug_set_member_status(uuid,text)', 'execute'),
  'anonymous callers cannot execute the member status RPC'
);
select ok(
  not has_function_privilege('anon', 'public.uniplug_record_password_update()', 'execute'),
  'anonymous callers cannot execute the password activity RPC'
);
select ok(
  not exists (
    select 1
    from information_schema.column_privileges
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'uniplug_profiles'
      and privilege_type = 'UPDATE'
  ),
  'authenticated clients cannot bypass validated profile updates'
);
select ok(
  not has_function_privilege('anon', 'public.is_uniplug_member()', 'execute'),
  'anonymous callers cannot execute the membership helper'
);
select ok(
  not has_function_privilege('anon', 'public.is_uniplug_admin()', 'execute'),
  'anonymous callers cannot execute the administrator helper'
);
select ok(
  not has_function_privilege('anon', 'public.uniplug_complete_onboarding()', 'execute'),
  'anonymous callers cannot complete onboarding'
);
select ok(
  not has_function_privilege('anon', 'public.uniplug_create_member_order(uuid[],text)', 'execute'),
  'anonymous callers cannot create member orders'
);
select ok(
  not has_function_privilege('anon', 'public.uniplug_create_renewal_order(uuid,text)', 'execute'),
  'anonymous callers cannot create renewal orders'
);
select ok(
  not has_function_privilege('anon', 'public.uniplug_log_order_event()', 'execute'),
  'anonymous callers cannot invoke the order event trigger'
);
select ok(
  not has_function_privilege('anon', 'public.uniplug_log_subscription_event()', 'execute'),
  'anonymous callers cannot invoke the subscription event trigger'
);
select ok(
  not has_function_privilege('anon', 'public.uniplug_touch_updated_at()', 'execute'),
  'anonymous callers cannot invoke the timestamp trigger'
);
select ok(
  not has_function_privilege('authenticated', 'public.uniplug_log_order_event()', 'execute'),
  'authenticated callers cannot directly invoke the order event trigger'
);
select ok(
  not has_function_privilege('authenticated', 'public.uniplug_log_subscription_event()', 'execute'),
  'authenticated callers cannot directly invoke the subscription event trigger'
);
select ok(
  not has_function_privilege('authenticated', 'public.uniplug_touch_updated_at()', 'execute'),
  'authenticated callers cannot directly invoke the timestamp trigger'
);

insert into auth.users(id,email)
values
  ('10000000-0000-4000-8000-000000000001', 'phase2-admin@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'phase2-member@example.test');

insert into public.uniplug_profiles(user_id,email,username,role,status)
values
  ('10000000-0000-4000-8000-000000000001', 'phase2-admin@example.test', 'phase2-admin', 'admin', 'active'),
  ('10000000-0000-4000-8000-000000000002', 'phase2-member@example.test', 'phase2-member', 'client', 'active');

insert into public.uniplug_catalog_services(id,slug,category_slug,name,is_active)
values ('20000000-0000-4000-8000-000000000001', 'phase2-test-service', 'productivity', 'Phase 2 Test Service', true);

insert into public.uniplug_member_plans(id,service_id,plan_name,plan_code,price_kes,billing_cycle,is_active)
values (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Monthly',
  'phase2-test-monthly',
  100,
  'monthly',
  true
);

insert into public.uniplug_member_subscriptions(
  id,user_id,service_id,plan_id,status,start_at,current_period_end
)
values (
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'active',
  '2029-12-01 00:00:00+00',
  '2030-01-01 00:00:00+00'
);

insert into public.uniplug_member_orders(
  id,order_number,user_id,customer_email,customer_phone,subtotal_kes,total_kes,
  payment_status,fulfillment_status,paystack_reference
)
values (
  '50000000-0000-4000-8000-000000000001',
  'UNI-R-TEST-0001',
  '10000000-0000-4000-8000-000000000002',
  'phase2-member@example.test',
  '+254700000000',
  100,
  100,
  'paid',
  'pending_activation',
  'UP-R-TEST-000000000001'
);

insert into public.uniplug_member_order_items(
  id,order_id,plan_id,service_id,service_name,plan_name,billing_cycle,unit_price_kes,
  renewal_subscription_id
)
values (
  '60000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Phase 2 Test Service',
  'Monthly',
  'monthly',
  100,
  '40000000-0000-4000-8000-000000000001'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';

select is(
  public.uniplug_activate_member_order('50000000-0000-4000-8000-000000000001'),
  1,
  'the first paid renewal activation updates one subscription'
);
select is(
  public.uniplug_activate_member_order('50000000-0000-4000-8000-000000000001'),
  0,
  'a repeated activation of the same paid order is a no-op'
);
select is(
  (
    select current_period_end
    from public.uniplug_member_subscriptions
    where id = '40000000-0000-4000-8000-000000000001'
  ),
  '2030-02-01 00:00:00+00'::timestamptz,
  'one payment extends the subscription by exactly one billing period'
);

select * from finish();
rollback;
