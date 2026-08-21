# UniPlug Catalog-First Redesign

## Objective

Turn the private UniPlug storefront into a fast, personalized service catalog. Members should see services and prices immediately, understand a product in seconds, and add or manage a subscription without reading a long marketing page.

## Product principles

1. **Catalog first:** services, availability, and prices appear before marketing content.
2. **Member aware:** an active service is labelled and links to management; an unowned service leads to purchase.
3. **One decision per screen:** product pages emphasize duration and checkout, with supporting information collapsed or secondary.
4. **Consistent dollar pricing:** show one clear USD amount everywhere, matching the current Lokimax-backed catalog and checkout contract.
5. **Mobile first:** search, categories, and the first service card should be visible within the first mobile viewport.
6. **Progressive disclosure:** detailed compatibility, setup, support, and FAQs remain available without dominating the page.
7. **Accessible and resilient:** semantic controls, keyboard focus, accurate states, stable redirects, and useful loading feedback.

## Phase 1 — Navigation, authentication, and route transitions

### Work

- Replace the fragile client-router login handoff with a hard navigation after successful authentication so server cookies and protected layouts are guaranteed to refresh.
- Keep the requested safe `next` destination.
- Make the mobile navigation summary expose menu state and clear account actions.
- Replace long generic loading messaging with a compact storefront loading state that does not resemble an error screen.

### Acceptance criteria

- Successful login leaves `/login` immediately and opens the intended protected page.
- Refreshing a protected page preserves the signed-in state.
- Mobile navigation is keyboard-operable and has an accessible name.
- Loading transitions do not leave an empty main region.

## Phase 2 — Catalog-first homepage

### Work

- Replace the oversized two-column marketing hero and duplicate “popular now” list.
- Introduce a compact member storefront header with:
  - short catalog-focused headline;
  - catalog search;
  - service count;
  - direct “My subscriptions” action.
- Render the complete six-service catalog on the homepage instead of a second featured subset.
- Keep a single compact trust strip for local support, renewal tracking, and eligible instant replacements.
- Reduce “How it works” to a small secondary section below the products.

### Acceptance criteria

- Desktop shows the first catalog row above the fold.
- Mobile shows search, category controls, and the start of the first product card in the first viewport.
- Every available service is discoverable from the homepage.
- No service is duplicated in two separate homepage sections.

## Phase 3 — Catalog filtering and service cards

### Work

- Share one catalog explorer between the homepage and `/services`.
- Generate category filters from categories that actually contain available products.
- Use customer-language labels such as Watch, Listen, Create, Work, Store, and Play.
- Simplify each service card to:
  - service artwork and name;
  - category and availability;
  - one-line outcome;
  - one clear USD price;
  - one contextual action.
- Remove repeated device-count and feature pills from every card.
- Preserve search, empty states, result counts, and keyboard focus.

### Acceptance criteria

- No empty category filter is shown.
- Search filters by name, category, description, features, and supported devices.
- Cards align consistently despite different descriptions.
- A single USD amount is the strongest price signal.
- The mobile category row scrolls horizontally without clipping controls.

## Phase 4 — Minimal product detail pages

### Work

- Collapse the page into a compact product summary and a decision-focused purchase card.
- Present only three immediate confidence points below the purchase area.
- Move compatibility, requirements, replacement policy, and FAQs into two disclosure panels.
- Remove repeated overview tiles and redundant section introductions.
- Reduce related services to compact recommendations.
- Keep availability and activation timing close to the product identity.

### Acceptance criteria

- Name, availability, starting monthly price, duration selector, total, and add-to-cart action appear without deep scrolling.
- Product information is understandable without opening a disclosure.
- Full operational details remain accessible when requested.
- Mobile purchase flow is usable with one hand and does not duplicate pricing.

## Phase 5 — Plan selector and pricing hierarchy

### Work

- Duration buttons show duration only.
- Show the selected dollar total once, with the monthly rate directly beneath it.
- Retain compare-at pricing only when it adds information.
- Keep selected/in-cart/update states explicit.

### Acceptance criteria

- Changing duration updates the selected total correctly.
- Cart data retains the selected duration and calculated total.
- Price is not repeated across every duration control.
- Disabled or unavailable plans cannot be added.
- Dollar pricing is consistent across catalog, product, cart, checkout, and order views.

## Phase 6 — Responsive, accessibility, and content polish

### Work

- Tune desktop, tablet, and 390px mobile layouts.
- Use consistent spacing, radii, focus rings, type scale, and muted text contrast.
- Fix mojibake characters in touched storefront source.
- Verify heading hierarchy, labelled search, disclosure controls, pressed category states, and button names.
- Preserve the current purple/black/white UniPlug identity while making the interface feel more like a product application.

### Acceptance criteria

- No horizontal page overflow at supported viewport sizes.
- Interactive controls have visible hover and focus states.
- Heading levels remain logical.
- The primary action remains visually dominant on every product page.

## Phase 7 — Verification and release

### Automated verification

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Browser verification

- Desktop homepage, catalog, and representative product page.
- 390×844 mobile homepage, catalog, navigation, and product page.
- Member login redirect.
- Search and category filtering.
- Duration selection and add-to-cart state.
- Existing client dashboard and account access regression check.

### Release

- Review the final diff and exclude unrelated files.
- Commit to `fix/phase-2-hardening`.
- Push the branch and update the existing draft PR.
- Deploy the verified build to the production Vercel project.
- Smoke-test `https://www.uniplug.shop` after the alias is promoted.

## Definition of done

The redesign is complete when the catalog is the homepage’s dominant experience, product pages are materially shorter and decision-focused, authentication navigation is reliable, automated checks pass, desktop/mobile browser checks pass, the branch is pushed, and the verified build is live on the production domain.
