# UniPlug domain migration

Prepared 17 October 2026 (Africa/Nairobi) for `ryanair000/uniplugke`.

## Domain and DNS

Cloudflare Free zone: `40de29734ed6389b2e1aa82fe26b7838`.
Account: `c2b1ae47f21c062d0a366aab4866c5c9`.

At Truehost, replace the current nameservers for `uniplug.co.ke` with:

```text
bella.ns.cloudflare.com
benedict.ns.cloudflare.com
```

These nameservers were returned by Cloudflare when this specific zone was created.
The previous delegation returned SERVFAIL, with delegated servers refusing queries.
The new zone initially contained no DNS records. Existing mail/verification records
could not be recovered from the broken delegation; obtain any required records
from their providers before relying on email at the new domain.

| Type | Name | Target | Initial proxy state |
| --- | --- | --- | --- |
| A | uniplug.co.ke | 18.219.31.181 | DNS only |
| CNAME | www.uniplug.co.ke | uniplug.co.ke | DNS only |
| CNAME | vip.uniplug.co.ke | uniplug.co.ke | DNS only |

Cloudflare SSL mode is Full (strict). Keep DNS-only mode until Caddy has obtained
public certificates and direct HTTPS checks pass. If proxying is enabled later,
never cache authenticated responses or responses containing Set-Cookie.

## Application changes

- `lib/domains.ts` centralizes the public store and VIP origins. Set both public
  origin variables at build time and runtime.
- Both legacy and new VIP hosts retain private portal routing. Supabase browser,
  server, and proxy clients use the same cookie settings for the request domain.
  `.uniplug.co.ke` cookies cannot authenticate users on `.uniplug.shop`.
- Storefront payment returns use the configured storefront origin; member
  checkout and renewal returns stay on the configured VIP origin.
- Metadata, canonical product/home URLs, sitemap, robots, invitations and
  storefront links follow the configured origins. VIP remains excluded from search.
- Internal `@members.uniplug.shop` account identities remain unchanged. They are
  authentication identifiers, not public website links.
- Support addresses remain `support@uniplug.shop` pending separate mail setup.
  Do not replace them with an unconfigured new-domain inbox.

```dotenv
NEXT_PUBLIC_SITE_URL=https://uniplug.co.ke
NEXT_PUBLIC_VIP_SITE_URL=https://vip.uniplug.co.ke
```

## Deployment and activation

The current app runs at `/srv/aws-sites/uniplug/app`, systemd service
`aws-site-uniplug`, port 3103. Caddy serves HTTPS. Older Nginx/Lightsail docs do
not describe this current deployment. Stage a separate release and service on
port 3113 for the new domain; retain the existing app and its environment.

1. Wait for Cloudflare to report active and public NS/A lookups to resolve.
2. Verify Caddy certificates for apex, www and VIP. Route www directly to the new
   apex, preserving the URI; route new apex/VIP to the staged release.
3. In the existing Supabase project, add exact new callback URLs to Auth URL
   Configuration, including both `/auth/callback` destinations actually used.
   Keep old callbacks during transition, update Site URL deliberately, and review
   confirmation/reset templates. Do not create a new database or recreate users.
4. If Gmail OAuth is enabled, authorize
   `https://vip.uniplug.co.ke/api/admin/gmail/callback` in Google Cloud and update
   GOOGLE_GMAIL_REDIRECT_URI. Keep the existing encryption key.
5. Verify production credentials are present without printing them. If checkout
   credentials are missing, restore them from the owner's existing secret source
   before claiming payment readiness; domain configuration does not restore them.
6. Test normal and VIP login, logout, cross-subdomain cookies, registration and
   email confirmation, member links, physical/key checkout and payment returns,
   order status, admin access and renewal flows. Verify the Paystack webhook by
   signed delivery and the resulting order status; a browser return is insufficient.
7. Update Paystack's configured webhook to the new reachable URL once tested.
   Keep the old webhook endpoint processing POSTs directly during transition.
8. Only after these checks pass, redirect old public page GET/HEAD requests to
   their exact new paths with query strings preserved. Keep webhook POSTs, old
   auth callbacks and unexpired member-access flows on working handlers. PKCE
   verifiers stored on the old domain cannot simply be moved with a redirect.
9. Verify both Search Console domains, submit Change of Address and the new
   sitemap, and update advertised links. Keep the old domain/certificates and
   permanent redirects for at least a year, preferably longer.

Do not activate old-to-new redirects while the new domain fails DNS or HTTPS.
Existing browser carts are origin-local and will not transfer automatically;
existing account data, orders, subscriptions and credentials stay in the same DB.

## Verification and rollback

`npm run check` covers lint, types, existing regression scripts and production
build. `npm run test:domains` exercises both host families, cookie isolation,
untrusted lookalike domains and stable member identifiers. Also smoke-test the
built server using both new Host headers; compile success alone cannot prove
host-based portal behavior.

If a new-domain check fails before cutover, leave the old Caddy blocks and app
running. If redirects were activated, revert only the UniPlug blocks using the
saved Caddyfile, validate it, then reload Caddy. Keep both endpoints on the same
database throughout; do not restore an old database snapshot over new orders.

Sources: [Google site moves](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes),
[Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls),
[Supabase SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide),
[Paystack webhooks](https://paystack.com/docs/payments/webhooks/).
