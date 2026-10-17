# UniPlug migration status

Verified 17 October 2026, 23:33 Africa/Nairobi.

## Completed

- Cloudflare Free zone `40de29734ed6389b2e1aa82fe26b7838` created for `uniplug.co.ke`.
- Assigned nameservers: `bella.ns.cloudflare.com`, `benedict.ns.cloudflare.com`.
- Apex A record points to `18.219.31.181`; www and VIP are CNAMEs to the apex.
  Records are DNS only for certificate provisioning. SSL mode is Full (strict).
- Migration source pushed to `codex/uniplug-co-ke-migration` in
  `ryanair000/uniplugke`. No PR was created; the PR tool displayed a submission form.
- Release `ce5931775728acef5a97c56f4d402882e3971016` built and staged at
  `/srv/aws-sites/uniplug/releases/co-ke-ce5931775728acef5a97c56f4d402882e3971016`.
- `aws-site-uniplug-co-ke` is active on loopback port 3113. Caddy has validated
  new apex/VIP routes and a www-to-apex redirect. Existing UniPlug routes remain
  on port 3103. Caddy backup:
  `/etc/caddy/Caddyfile.before-uniplug-co-ke-ce5931775728acef5a97c56f4d402882e3971016`.

## Verification

- Local `npm run check` passed: lint, types, existing regression scripts and
  production build. Lint reports two existing warnings (OpenGraph img and unused
  password-rotation parameter). `npm run test:domains` passed locally and on AWS.
- Actual staged AWS HTTP requests with new Host headers: homepage, product page,
  robots, sitemap and VIP login returned 200; unauthenticated VIP dashboard
  returned 307 to login. Canonicals and sitemap use `.co.ke`; VIP robots blocks
  indexing. These tests do not establish successful authenticated sessions.
- Both `https://uniplug.shop` and `https://vip.uniplug.shop` still returned 200
  after the Caddy reload. No old-to-new redirects have been activated.
- The supplied Cloudflare credential is absent from tracked files.

## Still required

1. Save the assigned Cloudflare nameservers in Truehost. At the latest check,
   Cloudflare status remained `pending` and public DNS still returned SERVFAIL
   from the old delegation. Public HTTPS on the new domain is not verified.
2. Once delegated, verify new apex, www and VIP certificates and public behavior.
3. Update Supabase Auth callback allowlists/Site URL and test confirmation and
   password flows. Real sign-in and cross-subdomain session continuity are not
   yet verified. Browser access remained unavailable to the agent.
4. Restore existing production integration credentials from the owner's secret
   source. The original AWS process had no PAYSTACK_SECRET_KEY or
   SUPABASE_SERVICE_ROLE_KEY; its .env.production contained only the public site
   URL and public Supabase URL/key. The staged release preserves this state.
   Checkout, signed webhooks, admin operations, and real renewals remain unverified.
5. Review enabled Gmail/cron integrations and their provider configuration.
6. Complete the checks in DOMAIN_MIGRATION.md before activating legacy redirects,
   updating the Paystack webhook and submitting Search Console Change of Address.

This is a staged migration, not a completed public cutover.
