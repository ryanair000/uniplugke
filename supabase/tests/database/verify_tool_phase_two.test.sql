begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_column(
  'public', 'client_services', 'verify_enabled',
  'service catalog has an explicit VeriFy capability flag'
);
select has_column(
  'public', 'client_services', 'verify_provider',
  'service catalog has an allowlisted VeriFy provider'
);
select has_column(
  'public', 'uniplug_household_events', 'ip_hash',
  'audit events store only a hashed IP signal'
);
select has_column(
  'public', 'uniplug_household_events', 'latency_ms',
  'audit events record request latency'
);
select has_column(
  'public', 'uniplug_household_events', 'failure_category',
  'audit events record structured failure categories'
);
select has_table(
  'public', 'uniplug_verify_message_receipts',
  'code-free idempotency receipts exist'
);

select ok(
  not has_table_privilege('anon', 'public.uniplug_verify_message_receipts', 'select'),
  'anonymous callers cannot read idempotency receipts'
);
select ok(
  not has_table_privilege('authenticated', 'public.uniplug_verify_message_receipts', 'select'),
  'authenticated callers cannot read idempotency receipts'
);
select ok(
  has_table_privilege('service_role', 'public.uniplug_verify_message_receipts', 'select'),
  'the server-side service role can read idempotency receipts'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.uniplug_reserve_verify_request(uuid,uuid,text,text,integer,integer,integer,integer)',
    'execute'
  ),
  'anonymous callers cannot reserve VeriFy requests'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.uniplug_reserve_verify_request(uuid,uuid,text,text,integer,integer,integer,integer)',
    'execute'
  ),
  'authenticated callers cannot bypass the server route to reserve requests'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.uniplug_reserve_verify_request(uuid,uuid,text,text,integer,integer,integer,integer)',
    'execute'
  ),
  'the server-side service role can reserve VeriFy requests'
);

select * from finish();
rollback;
