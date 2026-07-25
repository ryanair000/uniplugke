# UniPlug Kenya

Standalone, invite-only digital services catalog and member portal for `uniplug.shop`.

## Phase 1 included

- Public catalog with no prices in guest HTML, payloads, or fallback data.
- Authenticated member plans and pricing.
- Detailed service pages.
- Invite-only email/password authentication using Supabase SSR cookies.
- Protected dashboard, cart, checkout, admin, and payment routes.
- Server-side order repricing and Paystack initialization.
- Supabase migration that separates public catalog content from private plan pricing.
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
- Automated tests for guest-pricing, cart privacy, route protection, and renewal boundaries.

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

## Security boundary

Guest-facing code reads only `uniplug_catalog_services`. Prices live in `uniplug_member_plans`, whose RLS policy requires an active UniPlug profile. Checkout and renewals ignore browser totals and create orders using server-side database prices. Member orders, subscriptions, requests, and activity are protected by ownership policies.

See `docs/PHASE_1.md` for the initial cutover and `docs/PHASE_2.md` for member-operations validation.
