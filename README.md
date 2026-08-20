# UniPlug Kenya

One deployment serving two deliberately separated UniPlug experiences:

- `uniplug.shop`: public software, gaming, devices, and accessories store with physical delivery, digital fulfilment, registration, and sign-in.
- `vip.uniplug.shop`: the private digital-services portal for users linked to at least one Lokimax service.

## Storefront

- Unified software and physical-product catalog with category browsing, search, pagination, and owned UniPlug branding.
- Physical cart and server-priced Paystack checkout with Nairobi and nationwide delivery rules.
- VIP service catalog and dashboard restricted to eligible clients with linked Lokimax services.
- Member plans displayed in KSh with approximate USD equivalents.
- Detailed service pages.
- Email/password authentication using Supabase SSR cookies shared safely across the two UniPlug subdomains.
- Post-login routing that keeps regular users on `uniplug.shop` and sends only Lokimax service users to `vip.uniplug.shop`.
- Protected catalog, dashboard, cart, checkout, admin, and payment routes.
- Server-side order repricing and Paystack initialization.
- Supabase RLS that removes anonymous catalog access.
- Admin forms for catalog services and member plans.

## Phase 2 included

- Responsive My UniPlug member navigation and dashboard.
- Order history, receipts, payment status, and fulfilment progress.
- Subscription detail pages and request history.
- Secure renewal orders that extend an existing subscription.
- Member profile, username, phone, communication preferences, and password settings.
- Admin member directory and controlled status changes.
- Reviewed pause and cancellation requests.
- Member activity events for orders, payments, subscriptions, requests, and account changes.
- Automated tests for invitation boundaries, dual pricing, cart privacy, route protection, and renewals.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add Supabase and Paystack credentials.
3. Apply the Phase 1 migration, followed by the Phase 2 migrations in filename order.
4. Run `npm install`.
5. Run `npm run dev`.

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_VIP_SITE_URL` (use `https://vip.uniplug.shop`)
- `NEXT_PUBLIC_KES_PER_USD` (display conversion rate; defaults to `130`)

## Security boundary

The request proxy keeps the public key shop separate from the VIP service portal. VIP routing requires a Lokimax portal link with at least one tracked service (administrators are the operational exception). Catalog RLS also rejects anonymous reads. KSh is authoritative for checkout; USD values are display-only equivalents derived from `NEXT_PUBLIC_KES_PER_USD`. Checkout and renewals ignore browser totals and create orders using server-side database prices. Member orders, subscriptions, requests, and activity are protected by ownership policies.

See `docs/PHASE_1.md` for the initial cutover and `docs/PHASE_2.md` for member-operations validation.
