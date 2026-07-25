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

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add Supabase and Paystack credentials.
3. Apply `supabase/migrations/20260725190000_phase1_catalog_private_pricing.sql`.
4. Run `npm install`.
5. Run `npm run dev`.

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `NEXT_PUBLIC_SITE_URL`

## Security boundary

Guest-facing code reads only `uniplug_catalog_services`. Prices live in `uniplug_member_plans`, whose RLS policy requires an active UniPlug profile. Checkout ignores browser totals and creates orders using server-side database prices.

See `docs/PHASE_1.md` for deployment and cutover steps.
