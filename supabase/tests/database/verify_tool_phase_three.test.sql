begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

select has_column(
  'public', 'client_subscriptions', 'verify_enabled',
  'subscriptions have an explicit VeriFy operations switch'
);
select has_column(
  'public', 'client_subscriptions', 'verify_updated_at',
  'subscription VeriFy control changes are timestamped'
);
select has_table(
  'public', 'uniplug_verify_admin_events',
  'VeriFy administrative audit events exist'
);
select has_table(
  'public', 'uniplug_verify_alerts',
  'VeriFy operational alerts exist'
);
select ok(
  not has_table_privilege('anon', 'public.uniplug_verify_admin_events', 'select'),
  'anonymous callers cannot read VeriFy admin audit events'
);
select ok(
  not has_table_privilege('authenticated', 'public.uniplug_verify_admin_events', 'select'),
  'authenticated callers cannot read VeriFy admin audit events'
);
select ok(
  has_table_privilege('service_role', 'public.uniplug_verify_admin_events', 'select'),
  'the server-side service role can read VeriFy admin audit events'
);
select ok(
  not has_table_privilege('anon', 'public.uniplug_verify_alerts', 'select'),
  'anonymous callers cannot read VeriFy operational alerts'
);
select ok(
  not has_table_privilege('authenticated', 'public.uniplug_verify_alerts', 'select'),
  'authenticated callers cannot read VeriFy operational alerts'
);
select ok(
  has_table_privilege('service_role', 'public.uniplug_verify_alerts', 'select'),
  'the server-side service role can read VeriFy operational alerts'
);
select col_default_is(
  'public', 'client_subscriptions', 'verify_enabled', 'true',
  'existing and new subscriptions keep VeriFy enabled unless an admin disables it'
);

select * from finish();
rollback;
