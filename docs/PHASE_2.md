# Phase 2: member self-service and operations

## Objective

Turn My UniPlug into a complete member portal for account settings, order history, subscription details, secure renewals, and reviewed pause or cancellation requests. The public catalog and private pricing boundary from Phase 1 remains unchanged.

## Member experience

- Responsive member navigation for overview, orders, profile, and security.
- Dashboard summaries for active services, pending requests, and the next renewal.
- Subscription detail pages with activation information, renewal dates, request history, and support links.
- Dedicated renewal checkout that creates an order against the existing subscription.
- Order history and receipt pages with payment and fulfilment progress.
- Profile, username, phone, reminder preferences, marketing consent, and private-password updates.
- Account activity feed without exposing credentials or private payment keys.

## Operations experience

- Member directory with controlled active, pending, and suspended status changes.
- Subscription pause and cancellation queue.
- Admin notes and request resolution.
- Renewal orders extend the existing subscription instead of creating duplicate subscriptions.
- Order and subscription activity is recorded automatically.

## Database migrations

Apply these after the Phase 1 migration, in filename order:

1. `20260725203000_phase2_member_operations.sql`
2. `20260725203500_phase2_admin_member_status.sql`
3. `20260725204000_phase2_password_activity.sql`
4. `20260725204500_phase2_request_profile_relation.sql`
5. `20260725205000_phase2_renewal_orders.sql`

Apply them to a Supabase preview branch first. Do not apply them to the shared production database until Phase 1 cutover testing is complete.

## Required validation

- Guest catalog HTML and React payloads still contain no private prices.
- Guest sessions cannot retain a member cart after sign-out.
- `/dashboard`, `/dashboard/orders`, `/settings`, and renewal routes reject guests.
- Members can read only their own orders, subscriptions, requests, and activity.
- Renewal order totals are calculated from `uniplug_member_plans` in the database.
- Activating a renewal extends `current_period_end` on the existing subscription.
- A client cannot change membership status or role.
- An admin cannot suspend their own account through the status form.
- Pause and cancellation requests require ownership of the subscription.
- Payment verification still rejects amount mismatches.

## Production gate

The source can be merged before cutover, but real member and payment testing requires:

- Supabase preview branch and migrations.
- Real publishable and service-role keys in a protected Vercel preview.
- Paystack test secret and signed webhook.
- At least one invited admin and one invited client.
- A completed purchase, activation, renewal, pause request, cancellation request, and password update test.

Keep the current `uniplug.shop` deployment as rollback until those checks pass.
