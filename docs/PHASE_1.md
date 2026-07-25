# Phase 1: public catalog and private pricing

## Objective

Guests can explore a polished catalog and detailed service pages, but pricing, cart, checkout, and account management require an active invited member profile.

## Database cutover

1. Back up the current Supabase project.
2. Apply `supabase/migrations/20260725190000_phase1_catalog_private_pricing.sql` in a preview or development database first.
3. Confirm `anon` can select `uniplug_catalog_services` but cannot select `uniplug_member_plans`.
4. Confirm authenticated users without an active `uniplug_profiles` row cannot read plans.
5. Promote one trusted user to `role = 'admin'` and `status = 'active'`.
6. Add or review private plans through `/admin`.
7. Configure the application environment variables in Vercel.
8. Deploy a preview and test guest, member, admin, checkout, and payment-return flows.
9. Move `uniplug.shop` only after the preview passes.

## Required privacy tests

- Search guest HTML for known prices.
- Inspect React server payloads and network requests while logged out.
- Query the REST endpoint for `uniplug_member_plans` using only the publishable key; access must be denied or return no rows.
- Attempt `/checkout`, `/dashboard`, and `/admin` while logged out.
- Manipulate cart prices in local storage; the server order total must remain unchanged.

## Rollback

Keep the existing UniPlug deployment and domain assignment available until the new standalone deployment has passed payment and account-access checks.
