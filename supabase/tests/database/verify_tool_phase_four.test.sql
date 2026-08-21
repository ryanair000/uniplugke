begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

select has_table('public', 'uniplug_verify_provider_rollouts', 'provider rollout governance exists');
select has_table('public', 'uniplug_verify_provider_cohorts', 'provider pilot cohorts exist');
select ok(not has_table_privilege('anon', 'public.uniplug_verify_provider_rollouts', 'select'), 'anonymous callers cannot read provider governance');
select ok(not has_table_privilege('authenticated', 'public.uniplug_verify_provider_rollouts', 'select'), 'members cannot read provider governance');
select ok(has_table_privilege('service_role', 'public.uniplug_verify_provider_rollouts', 'select'), 'server can read provider governance');
select ok(not has_table_privilege('anon', 'public.uniplug_verify_provider_cohorts', 'select'), 'anonymous callers cannot read pilot cohorts');
select ok(not has_table_privilege('authenticated', 'public.uniplug_verify_provider_cohorts', 'select'), 'members cannot read pilot cohorts');
select ok(has_table_privilege('service_role', 'public.uniplug_verify_provider_cohorts', 'select'), 'server can read pilot cohorts');
select results_eq(
  $$select operational_status from public.uniplug_verify_provider_rollouts where provider = 'netflix'$$,
  array['live'::text],
  'the existing reviewed Netflix service remains live after governance migration'
);
select results_eq(
  $$select authorization_status from public.uniplug_verify_provider_rollouts where provider = 'netflix'$$,
  array['approved'::text],
  'the existing Netflix authorization model is documented'
);
select results_eq(
  $$select incident_owner from public.uniplug_verify_provider_rollouts where provider = 'netflix'$$,
  array['UniPlug operations'::text],
  'the existing provider has an incident owner'
);
select throws_ok(
  $$update public.uniplug_verify_provider_rollouts set operational_status = 'pilot', sender_allowlist_reviewed = false where provider = 'netflix'$$,
  '23514',
  null,
  'a provider cannot enter pilot without every readiness gate'
);
select throws_ok(
  $$update public.uniplug_verify_provider_rollouts set operational_status = 'live', authorization_status = 'revoked' where provider = 'netflix'$$,
  '23514',
  null,
  'a provider cannot remain live after authorization is revoked'
);
select col_is_pk('public', 'uniplug_verify_provider_rollouts', 'provider', 'provider rollout records are unique by provider');
select col_is_fk('public', 'uniplug_verify_provider_cohorts', 'client_subscription_id', 'cohort subscriptions retain referential integrity');

select * from finish();
rollback;
