import type { Metadata } from "next";
import { PublicPageIntro } from "@/components/public-page";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms that apply when browsing UniPlug, using a member account, and purchasing or managing digital-service plans."
};

export default function TermsPage() {
  return (
    <div className="public-page legal-page">
      <PublicPageIntro
        eyebrow="Terms"
        title="Clear expectations for using UniPlug."
        description="These terms apply to the UniPlug website, member portal, catalog, support channels, and transactions made through the platform."
      />

      <article className="public-page-shell legal-document">
        <p className="legal-updated">Effective: 26 July 2026</p>

        <section>
          <h2>1. Accepting these terms</h2>
          <p>By using UniPlug, you agree to these terms and any specific plan information shown before checkout. If you do not agree, do not place an order or continue using a member account.</p>
        </section>

        <section>
          <h2>2. Accounts and invitations</h2>
          <p>Member access may require a valid invitation. You are responsible for providing accurate information, protecting your password and authentication codes, and promptly reporting suspected unauthorised access. An account may be restricted where necessary for security, fraud prevention, legal compliance, or misuse.</p>
        </section>

        <section>
          <h2>3. Catalog and member plans</h2>
          <p>The public catalog explains available service types without displaying private member prices. Current pricing, billing cycles, plan features, availability, and setup requirements are shown to eligible members before purchase. Service names and trademarks belong to their respective owners.</p>
        </section>

        <section>
          <h2>4. Orders and payments</h2>
          <p>An order is submitted when you confirm checkout. Fulfillment may depend on successful payment, account checks, service availability, supported region or device requirements, and any information requested during activation. Keep your order reference for support.</p>
        </section>

        <section>
          <h2>5. Activation and delivery</h2>
          <p>Activation windows are estimates unless explicitly stated otherwise. Some services require an invitation, compatible account, supported device, or additional verification. UniPlug will use reasonable efforts to keep order and activation status current in the member dashboard.</p>
        </section>

        <section>
          <h2>6. Renewals, pauses, and cancellations</h2>
          <p>Renewal timing and available request options depend on the selected plan. Submit an eligible pause or cancellation request through the relevant subscription page. A request is not complete until its status is confirmed. Amounts already committed to a billing period may remain payable where permitted by law and the plan conditions.</p>
        </section>

        <section>
          <h2>7. Service issues and replacements</h2>
          <p>Report access problems promptly and provide the service name and relevant order reference. Support or replacement eligibility depends on the nature of the issue, the service requirements, account use, and the applicable plan. Never share passwords or one-time codes with support.</p>
        </section>

        <section>
          <h2>8. Acceptable use</h2>
          <p>You must not misuse the platform, attempt unauthorised access, interfere with its operation, use fraudulent payment information, resell access without permission, or use a service in a way that violates law or the relevant provider’s conditions.</p>
        </section>

        <section>
          <h2>9. Availability and responsibility</h2>
          <p>We aim to keep UniPlug accurate and available, but maintenance, provider changes, connectivity, or events outside reasonable control may affect the platform or a third-party service. Nothing in these terms excludes rights or remedies that cannot lawfully be excluded under Kenyan consumer law.</p>
        </section>

        <section>
          <h2>10. Changes and contact</h2>
          <p>We may update these terms to reflect platform, provider, or legal changes. The effective date identifies the current version. Questions about these terms can be sent to <a href="mailto:support@uniplug.co.ke">support@uniplug.co.ke</a>.</p>
        </section>
      </article>
    </div>
  );
}
