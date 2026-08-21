# UniPlug Software-Key Storefront Roadmap

## Objective

Turn `uniplug.shop` into a focused, trustworthy software-key catalog while keeping authenticated member services on `vip.uniplug.shop`.

The public store should optimize for a small catalog today, explain each licence precisely, and expand into a richer marketplace only when the number of products justifies additional catalog controls.

## Product principles

1. **Catalog first, no promotional hero.** Customers should reach products and prices immediately.
2. **Truth before persuasion.** Licence type, duration, device count, platform, region, renewal behavior, delivery, and support must be confirmed before they are advertised.
3. **One clear purchase path.** Each product leads directly to its checkout; a cart is unnecessary for the current store.
4. **Progressive complexity.** Search, categories, filters, sorting, and comparison tools should appear only when the catalog is large enough to require them.
5. **Mobile purchase speed.** Product, price, term, and primary action should appear within the first meaningful mobile scroll.
6. **Accessible by default.** All dialogs, controls, status updates, keyboard flows, and touch targets must be usable without a mouse.

## Confirmed storefront facts

- Adobe Acrobat: KSh 1,000/month.
- Windows 11 Pro: KSh 2,500/year.
- Products are delivered digitally.
- Checkout uses Paystack.
- Activation support is offered.
- Logged-in member services belong on `vip.uniplug.shop`.

Anything beyond these facts must be confirmed before publishing.

---

## Phase 1 — Focused two-product catalog

**Status:** Live in production on `uniplug.shop` and `www.uniplug.shop`

### Goal

Remove marketplace complexity that is not useful for two products, bring purchase actions above the fold, and correct the most important responsive and accessibility problems.

### Scope

- Replace the oversized catalog toolbar with a compact catalog masthead.
- Keep category switching, but shorten the category labels and allow them to wrap without clipping.
- Remove sorting, list/grid switching, duration filters, price filters, the desktop filter sidebar, and the mobile filter drawer.
- Preserve search and URL-based search results.
- Use a compact two-card product layout with smaller artwork and more visible purchase content.
- Make the Buy action the dominant control and increase action height and type size.
- Increase product-copy, metadata, and control typography.
- Let the utility strip scroll away while keeping only the compact main navigation sticky.
- Hide the header search on narrow tablet/mobile viewports, where the two visible category controls are sufficient.
- Add a concise live result-count announcement instead of marking the entire product grid as live content.
- Fix product-dialog focus entry, focus trapping, Escape handling, background inertness, description association, and focus restoration.
- Make footer category links open the correct category state.
- Keep all product claims limited to already-confirmed facts.

### Acceptance criteria

- Both product cards and their purchase actions are visible in a typical 1440×900 desktop viewport.
- The first product begins substantially earlier than the previous ~522px mobile position.
- No filter panel can push products hundreds of pixels down the mobile page.
- Category controls do not clip at 390px width.
- Primary purchase actions are at least 44px high.
- Product details receive keyboard focus when opened.
- Tab and Shift+Tab remain inside an open details dialog.
- Closing the dialog restores focus to the originating product control.
- Search and category empty states identify the correct cause.
- Lint, typecheck, tests, and production build pass.

### Out of scope

- Unconfirmed licence promises.
- New product artwork.
- New support or WhatsApp backend.
- Cart or multi-item checkout.
- Analytics and merchandising automation.

---

## Phase 2 — Licence truth and product-detail system

**Status:** Core system implemented; final business licence confirmations still required

### Implemented on 2026-08-14

- Added one structured licence source shared by cards, quick view, product details, checkout, order records, and Paystack metadata.
- Removed unconfirmed device-count and feature claims from the two product listings.
- Added shareable `/keys/adobe-acrobat` and `/keys/windows-11-pro` detail routes.
- Separated confirmed price, term, digital delivery, checkout behavior, and activation support from unresolved business terms.
- Replaced ambiguous `/month` and `/year` price suffixes with exact `for 1 month` and `for 1 year` language.
- Added a required checkout acknowledgement and matching server-side enforcement for unresolved material terms.
- Added the acknowledged term version and exact shared wording to Paystack metadata.

The phase remains incomplete until the business supplies the edition, licence type, device/activation scope, compatibility, region, renewal/end-of-term, fulfilment timing, replacement, refund, and cancellation decisions listed below.

### Goal

Give buyers enough exact information to understand what they are purchasing before starting checkout.

### Required business decisions per product

- Exact edition and version.
- Retail, OEM, subscription, account-based, or other licence type.
- Number of devices and allowed activations.
- Supported platforms and minimum requirements.
- Country or region restrictions.
- New activation, renewal, upgrade, or replacement status.
- Whether payment is one-time or recurring.
- What happens at the end of the advertised month/year.
- Delivery target and fulfilment method.
- Activation steps and expected completion time.
- Failed-activation replacement conditions.
- Refund and cancellation conditions.

### Implementation

- Expand the product data model with structured licence attributes.
- Show five or six essential facts directly on each product card.
- Build shareable product-detail routes such as `/keys/adobe-acrobat` rather than relying only on a modal.
- Keep the modal as an optional quick view, backed by the same product data.
- Add compatibility, activation, delivery, and policy sections to each detail page.
- Repeat the exact term and renewal language in checkout.
- Add a required acknowledgement for any material term that could surprise a buyer.
- Include order-specific licence terminology in Paystack metadata and confirmation records.

### Acceptance criteria

- No ambiguous `/month` or `/year` label exists without renewal/end-of-term explanation.
- Product card, detail view, checkout, payment metadata, and order confirmation use the same licence terminology.
- A customer can determine compatibility and licence scope without contacting support.

---

## Phase 3 — Trust, support, and fulfilment experience

**Status:** Core support and lookup experience implemented; business policy, SLA, WhatsApp, and outbound email decisions remain

### Implemented on 2026-08-14

- Replaced the mail-client-only request path with an inline, durable key-request form and stable `REQ-...` reference.
- Added server-side validation, a honeypot, email/IP rate limits, and one-way IP hashing; raw IP addresses are not stored.
- Added a private admin sourcing queue on `vip.uniplug.shop`, protected by service-role access and row-level security.
- Added privacy-preserving order lookup using both the `KEY-...` reference and the matching customer email.
- Added distinct payment-success, payment-pending, and payment-failed states with visible support references.
- Added truthful storefront FAQ guidance covering payment, delivery, activation, device changes, refunds/cancellations, and renewal.
- Persisted the exact licence-term acknowledgement and disclosure version on new key orders.

The phase remains incomplete until the business supplies a WhatsApp contact, delivery and support response targets, finalized activation/replacement/refund/cancellation policies, and an approved outbound email provider/from-domain/template. No unconfirmed promise is published in the meantime.

### Goal

Replace generic reassurance with concrete support and post-payment expectations.

### Scope

- Add an inline Request a key form with software name, platform, email, phone/WhatsApp, and optional notes.
- Provide WhatsApp support without making it the only support path.
- Publish delivery targets, support hours, and response expectations.
- Add activation-failure and replacement guidance.
- Add an FAQ for payment, delivery, activation, device changes, refunds, and renewals.
- Create clear payment-success, payment-pending, and payment-failed states.
- Send a structured order email containing the exact product, licence terms, activation instructions, and support reference.
- Add an order lookup or signed-in order history where appropriate.

### Acceptance criteria

- Requesting an unavailable key works without relying on a configured mail application.
- Customers know when delivery should arrive and what to do if it does not.
- Support can identify an order using a stable reference.

---

## Phase 4 — Visual system and cross-domain brand unification

**Status:** Planned

### Goal

Make the key store and VIP portal feel like two parts of one UniPlug product family.

### Scope

- Design a consistent software-product artwork system using brand-safe logos, platform markers, and licence badges.
- Replace cropped or upscaled product images.
- Define shared color, type, spacing, icon, radius, shadow, and interaction tokens.
- Align the public-store and VIP wordmarks, header behavior, account language, and authentication transitions.
- Add responsive product-image sources and appropriate placeholders.
- Produce Figma desktop, tablet, mobile, dialog, empty, loading, and checkout states.
- Document reusable Figma components and their code equivalents.

### Acceptance criteria

- Product artwork is crisp at every supported viewport.
- Public and VIP experiences are visibly the same brand.
- Figma and production use the same component states and design tokens.

---

## Phase 5 — Catalog growth and merchandising

**Status:** Trigger when the catalog reaches approximately 8–10 products

### Goal

Reintroduce catalog tools only when they reduce real customer effort.

### Scope

- Add URL-synchronized filters for platform, category, licence type, duration, price, and availability.
- Add sorting when there are enough products for ordering to matter.
- Add product comparison for genuinely similar licences.
- Add product-detail SEO metadata, structured data, canonical URLs, and social images.
- Add related products and contextual cross-sells.
- Add inventory/availability status and administrative product publishing controls.
- Add analytics for search, zero-result queries, product-detail opens, checkout starts, payment completion, and support requests.

### Acceptance criteria

- Every catalog control has a measurable customer use case.
- Filter state is bookmarkable and shareable.
- Zero-result searches feed the product-sourcing backlog.

---

## Phase 6 — Release hardening and continuous optimization

**Status:** Ongoing

### Scope

- Automated responsive smoke tests for home, product details, checkout, and payment return states.
- Accessibility checks covering keyboard, screen-reader names, dialog behavior, contrast, reduced motion, and zoom.
- Core Web Vitals and image-performance monitoring.
- Payment, fulfilment, and delivery observability.
- Security review for checkout inputs, callbacks, account routing, and order data.
- Funnel reporting and controlled experiments after baseline traffic is sufficient.
- Document rollback and incident procedures.

## Measurement framework

Track these metrics after the required privacy and analytics setup exists:

- Product-card Buy click-through rate.
- Product-detail open-to-checkout rate.
- Checkout-start to successful-payment rate.
- Mobile versus desktop conversion rate.
- Search usage and zero-result rate.
- Request-a-key completion rate.
- Activation-support contact rate per fulfilled order.
- Failed-activation replacement rate.
- Time from payment confirmation to successful delivery.

## Release discipline

Each phase should follow this sequence:

1. Confirm business facts and acceptance criteria.
2. Update Figma or the written interaction specification.
3. Implement behind the existing production contract.
4. Run lint, typecheck, automated tests, and production build.
5. Verify desktop, tablet, mobile, keyboard, empty, error, and loading states.
6. Deploy to a preview URL.
7. Complete stakeholder review.
8. Promote to production and monitor the purchase funnel.
