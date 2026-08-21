begin;

create extension if not exists pgtap with schema extensions;
select plan(3);

select ok(
  not has_table_privilege('anon', 'public.uniplug_mailbox_credentials', 'select'),
  'anonymous callers cannot read mailbox credentials'
);

select ok(
  not has_table_privilege('authenticated', 'public.uniplug_mailbox_credentials', 'select'),
  'authenticated callers cannot read encrypted mailbox credentials'
);

select ok(
  has_table_privilege('service_role', 'public.uniplug_mailbox_credentials', 'select'),
  'the server-side service role retains mailbox access'
);

select * from finish();
rollback;
