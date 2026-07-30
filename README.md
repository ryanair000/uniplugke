# UniPlug Kenya

Standalone, invite-only digital services catalog and member portal for `uniplug.shop`.

## Storefront

- Entire storefront restricted to invited clients with active memberships.
- Member plans displayed in KSh with approximate USD equivalents.
- Detailed service pages.
- Invite-only email/password authentication using Supabase SSR cookies.
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
- `NEXT_PUBLIC_KES_PER_USD` (display conversion rate; defaults to `130`)

## Security boundary

The request proxy allows only login, invitation setup, the auth callback, and the Paystack webhook without an active member profile. Catalog RLS also rejects anonymous reads. KSh is authoritative for checkout; USD values are display-only equivalents derived from `NEXT_PUBLIC_KES_PER_USD`. Checkout and renewals ignore browser totals and create orders using server-side database prices. Member orders, subscriptions, requests, and activity are protected by ownership policies.

See `docs/PHASE_1.md` for the initial cutover and `docs/PHASE_2.md` for member-operations validation.
