# VeriFy implementation plan

## Product summary

VeriFy is a private UniPlug member tool for retrieving short-lived access or sign-in codes for services assigned to the signed-in member. Phase 1 supports Netflix temporary viewing codes only. The product must never expose mailbox credentials, message bodies, password-reset links, or codes from unsupported senders.

The public entry URL is `https://uniplug.shop/tools/verify`. UniPlug currently separates its public key shop (`uniplug.shop`) from the Lokimax-backed member portal (`vip.uniplug.shop`), so the entry URL redirects to the protected canonical page at `https://vip.uniplug.shop/tools/verify`. Authentication returns the member to the requested tool.

## Product principles

- Only active members with an eligible, assigned subscription can request a code.
- Authorization is checked again for every request; rendered page state is never trusted.
- Mailbox connections and encrypted secrets remain server-only.
- VeriFy returns only the minimum result: code, received time, and expiry time.
- Codes are not persisted by UniPlug and responses are never cached.
- Retrieval is auditable and rate-limited without recording the code itself.
- Provider support is allowlisted and implemented explicitly, not as generic mailbox search.

## Phase 1 — Netflix MVP

Status: implemented in this release.

### Member experience

- Add a **Tools** item to the authenticated member navigation.
- Create `/tools/verify` inside the existing member shell.
- Show only Netflix subscriptions in `active`, `due_soon`, or `trial` status.
- Explain the Netflix “Send Email” step before retrieval.
- Provide **Get latest code**, loading, empty, error, expired, and rate-limited states.
- Display the four-digit code, a copy action, and a live expiry countdown.
- Remove the displayed code from client state when it expires.
- Link empty and support states to the existing subscriptions and support pages.
- Keep the existing Netflix Household helper on the subscription detail page, backed by the same hardened retrieval service.

### Application and API

- Add `POST /api/tools/verify` with a JSON `subscriptionId` input.
- Validate the subscription UUID, signed-in member, client ownership, service provider, assignment, and active status server-side.
- Reuse a shared server-only Netflix retrieval service from both the new endpoint and the existing subscription endpoint.
- Return private, no-store responses and a `Retry-After` header when throttled.
- Preserve generic member-facing errors while keeping operational details in server logs and mailbox health state.

### Database and security

- Revoke `authenticated` access to `uniplug_mailbox_credentials` and remove its member/admin read policy.
- Read mailbox credentials only with the server-side service-role client.
- Move the admin mailbox-health page to the server-only client so the admin UI continues to work after the revoke.
- Use `uniplug_household_events` for request, result, setup, failure, and rate-limit audit events.
- Allow at most five retrieval attempts per member and subscription in a rolling ten-minute window.
- Do not persist retrieved codes, email content, or Netflix links.
- Continue to accept mail only from the explicit Netflix sender query and only extract the expected short code.

### Phase 1 verification

- Source tests cover the route, server-only secret boundary, audit events, rate limit, and member UI.
- ESLint and TypeScript pass.
- Existing project source tests pass.
- The Next.js production build succeeds.
- Database migration tests confirm authenticated users cannot select mailbox credentials and the service role retains access.

### Exit criteria

- An eligible member can open VeriFy, request a newly sent Netflix code, copy it, and see it disappear at expiry.
- Ineligible subscriptions and users cannot retrieve codes by changing request payloads.
- A browser-side Supabase client cannot read any mailbox credential row.
- The sixth request inside ten minutes is rejected and recorded without checking Gmail.
- Admins can still see connection health without receiving the encrypted secret in the browser.

## Phase 2 — Provider platform and stronger controls

Status: implemented in this release.

### Provider architecture

- Introduce a provider registry with an adapter contract for eligibility, sender allowlist, message query, code parser, expiry, and member instructions.
- Rename Netflix-specific application types to provider-neutral VeriFy types while keeping provider implementations isolated.
- Store provider configuration as reviewed code or constrained database records; do not allow arbitrary sender or regex configuration from the member interface.
- Add provider capability flags to the service catalog so eligibility does not depend on service-name matching.

### Security and reliability

- Replace the application-level count-and-insert throttle with an atomic database or managed rate-limit operation suitable for concurrent serverless instances.
- Add per-IP anomaly signals in addition to the member-and-subscription limit.
- Add idempotency for repeated requests made while the same mailbox message is current, without storing the code.
- Record structured failure categories and request latency for operational analysis.
- Add a short-lived recent-authentication requirement for higher-risk providers.
- Add automated tests using sanitized email fixtures for MIME, HTML, quoted-printable, and link-based code formats.

### Phase 2 implementation notes

- `lib/verify/provider-registry.ts` is the reviewed provider allowlist. Each adapter owns its sender domains, mailbox query, parser, expiry, instructions, eligibility rules, and optional recent-authentication window.
- `client_services.verify_enabled` and `client_services.verify_provider` are constrained capability fields. Netflix was backfilled explicitly; member-controlled sender or regular-expression configuration is not supported.
- `uniplug_reserve_verify_request` uses transaction advisory locks to reserve requests atomically across concurrent serverless instances. The member/subscription limit remains five requests per ten minutes; hashed-IP thresholds add anomaly and hard-limit signals.
- IP values are HMAC-SHA-256 digests produced server-side. Raw addresses are never stored in VeriFy audit records.
- `uniplug_verify_message_receipts` stores only a message fingerprint, provider, request identifiers, timestamps, and expiry. It never stores the code, sender, subject, body, or link.
- Audit events now include request IDs, provider, structured failure categories, latency, hashed-IP signals, message fingerprints, and idempotency state without persisting secrets.
- The recent-authentication hook is enforced by the core service whenever an allowlisted provider declares a maximum authentication age. Netflix does not currently require reauthentication.
- Sanitized fixture tests cover plain MIME, HTML, quoted-printable, Netflix-hosted link resolution, password-reset rejection, and unrelated OTP rejection.
- A live six-request parallel test admitted exactly five reservations and rejected the sixth; its synthetic audit rows were removed immediately after the test.

### Exit criteria

- A new provider can be added without changing the member page or core API contract.
- Parallel request tests cannot exceed the configured rate limit.
- Provider parser tests prove that unrelated OTPs and reset messages are ignored.

## Phase 3 — Admin operations

Status: implemented in this release.

- Build a VeriFy operations dashboard showing connected, degraded, and unassigned mailboxes.
- Show success rate, no-code rate, throttled requests, and last successful check by provider.
- Add connection tests that do not expose messages or codes.
- Add guided mailbox credential rotation and immediate revocation.
- Add alerts for authentication failures, repeated no-code results, unusual member activity, and provider format changes.
- Add per-subscription VeriFy enable/disable controls with an audit trail.
- Create support-ticket shortcuts prefilled with the provider and safe failure category.

### Phase 3 implementation notes

- `/admin/mailboxes` is now the VeriFy operations console. It reports connected, degraded, and unassigned mailboxes plus 24-hour success, no-code, throttle, and last-success metrics.
- Safe connection tests authenticate with Gmail and open `INBOX` read-only. They do not search or fetch any email, body, subject, link, or code.
- Credential rotation tests the replacement app password before updating the encrypted record. A failed test preserves the existing credential; revocation deletes the server-only credential immediately.
- `client_subscriptions.verify_enabled` is an additional per-subscription control layered under the reviewed service capability and normal eligibility rules.
- `uniplug_verify_admin_events` records tests, rotations, revocations, subscription controls, and alert decisions without secrets or codes.
- `uniplug_verify_alerts` separates authentication failures, repeated no-code results, unusual activity, provider-format signals, and configuration gaps using code-free telemetry.
- VeriFy member errors now include an allowlisted support URL. The ticket form is prefilled only with the provider, service, and safe failure category.

### Exit criteria

- Support can diagnose configuration failures without database access or mailbox access.
- Mailbox credentials can be rotated with no member-visible secret handling.
- Operational alerts distinguish provider outages from member instruction errors.

## Phase 4 — Carefully expand supported services

Status: implemented as a safe rollout-governance framework. Netflix remains the only enabled provider; no second provider was activated without business authorization and sanitized fixtures.

- Evaluate candidate providers individually for authorization, terms, sender security, and code semantics.
- Add only providers for which UniPlug is authorized to manage the assigned account or access flow.
- Require fixture coverage, sender allowlists, expiry rules, abuse limits, and a support runbook before enabling a provider.
- Roll out each provider behind an admin capability flag to a small member cohort first.
- Never support password-reset codes, financial OTPs, identity-verification codes, or open-ended mailbox searches.

### Phase 4 implementation notes

- `/admin/verify/providers` is the server-only provider governance console. It records the authorization model and reference, terms-review decision, allowed code semantics, incident owner, and support runbook reference for each provider in the reviewed application registry.
- `uniplug_verify_provider_rollouts` enforces readiness in PostgreSQL. A provider cannot enter `pilot` or `live` status until authorization and terms are approved and sender, fixture, expiry, abuse, forbidden-code, and runbook gates are all confirmed.
- `uniplug_verify_provider_cohorts` stores explicit eligible subscription assignments. When a provider is in `pilot`, all other subscriptions fail closed even if their catalog and subscription switches are enabled.
- The core retrieval service checks the provider gate before reserving a rate-limit slot or connecting to a mailbox. A paused or disabled provider returns a safe unavailable response; pilot membership is not disclosed.
- The instant shutdown action changes only one provider to `paused`, records a code-free administrator audit event, and is enforced on both the member page and every retrieval request.
- Provider records and cohorts are RLS-protected server-only tables with browser grants revoked. They never store verification codes, message contents, sender configuration, or mailbox credentials.
- Netflix was migrated as the existing UniPlug-managed service with its reviewed sender allowlist, sanitized fixture suite, 15-minute expiry rule, five-per-ten-minute member limit, forbidden-code rejection, operations owner, and runbook reference.
- Adding a new provider still requires a reviewed adapter in `lib/verify/provider-registry.ts`; database forms cannot create arbitrary providers, sender searches, or parsers.

### Exit criteria

- Every enabled provider has a documented authorization model and incident owner.
- Provider rollout can be stopped instantly without affecting the rest of VeriFy.

## Phase 5 — Scale, compliance, and product polish

- Perform a formal privacy and abuse review covering retention, access logs, mailbox authorization, and incident response.
- Define audit-event retention and deletion schedules.
- Add accessibility testing, localization, and low-bandwidth behavior.
- Add privacy-safe product analytics for completion rate and time-to-code.
- Add SLOs for request success, latency, and mailbox connection health.
- Run penetration tests focused on IDOR/BOLA, credential exposure, cache leakage, rate-limit bypass, and provider-parser confusion.
- Document disaster recovery, credential rotation, and provider shutdown procedures.

### Exit criteria

- VeriFy meets its agreed reliability and support targets.
- Security review findings are resolved or explicitly accepted before broad rollout.
- Product analytics contain no codes, mailbox contents, or credentials.

## API contract after Phase 1

### Request

```http
POST /api/tools/verify
Content-Type: application/json

{"subscriptionId":"<uuid>"}
```

### Successful response

```json
{
  "status": "ready",
  "provider": "netflix",
  "code": "4821",
  "receivedAt": "2026-08-14T08:15:00.000Z",
  "expiresAt": "2026-08-14T08:30:00.000Z"
}
```

### Failure statuses

- `400` — invalid request.
- `404` — no eligible subscription or no current code.
- `409` — provider setup is unavailable for the assigned subscription.
- `429` — rolling request limit reached.
- `502` — approved mailbox provider could not be checked.
- `503` — server-side retrieval is not configured.

Every response uses `Cache-Control: private, no-store, max-age=0`.

## Rollout checklist

1. Apply the Phase 1 database migration.
2. Confirm `GMAIL_TOKEN_ENCRYPTION_KEY` and the service-role key are configured only on the server.
3. Confirm the target Netflix mailbox has a valid encrypted app password.
4. Deploy the application and test with one internal eligible subscription.
5. Verify direct authenticated Data API reads of `uniplug_mailbox_credentials` fail.
6. Exercise success, no-code, setup, expired, and rate-limit states.
7. Review audit events and admin mailbox health.
8. Enable the navigation entry for members in production.
