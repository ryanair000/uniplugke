import type { Metadata } from "next";
import { LegalToc, PublicPageIntro } from "@/components/public-page";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms that apply when browsing UniPlug, using a member account, and purchasing or managing digital-service plans."
};

const termsSections = [
  { id: "acceptance", label: "Accepting the terms" },
  { id: "accounts", label: "Accounts and invitations" },
  { id: "catalog", label: "Catalog and plans" },
  { id: "orders", label: "Orders and payments" },
  { id: "activation", label: "Activation and delivery" },
  { id: "renewals", label: "Renewals and cancellations" },
  { id: "issues", label: "Service issues" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "availability", label: "Availability" },
  { id: "changes", label: "Changes and contact" }
];

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
        <LegalToc items={termsSections} />

        <section id="acceptance">
          <h2>1. Accepting these terms</h2>
          <p>By using UniPlug, you agree to these terms and any specific plan information shown before checkout. If you do not agree, do not place an order or continue using a member account.</p>
        </section>

        <section id="accounts">
          <h2>2. Accounts and invitations</h2>
          <p>Member access may require a valid invitation. You are responsible for providing accurate information, protecting your password and authentication codes, and promptly reporting suspected unauthorised access. An account may be restricted where necessary for security, fraud prevention, legal compliance, or misuse.</p>
        </section>

        <section id="catalog">
          <h2>3. Catalog and member plans</h2>
          <p>The private catalog is available only to invited clients. Current dollar pricing, billing cycles, plan features, availability, and setup requirements are shown before purchase. Service names and trademarks belong to their respective owners.</p>
        </section>

        <section id="orders">
          <h2>4. Orders and payments</h2>
          <p>An order is submitted when you confirm checkout. Fulfillment may depend on successful payment, account checks, service availability, supported region or device requirements, and any information requested during activation. Keep your order reference for support.</p>
        </section>

        <section id="activation">
          <h2>5. Activation and delivery</h2>
          <p>Activation windows are estimates unless explicitly stated otherwise. Some services require an invitation, compatible account, supported device, or additional verification. UniPlug will use reasonable efforts to keep order and activation status current in the member dashboard.</p>
        </section>

        <section id="renewals">
          <h2>6. Renewals, pauses, and cancellations</h2>
          <p>Renewal timing and available request options depend on the selected plan. Submit an eligible pause or cancellation request through the relevant subscription page. A request is not complete until its status is confirmed. Amounts already committed to a billing period may remain payable where permitted by law and the plan conditions.</p>
        </section>

        <section id="issues">
          <h2>7. Service issues and replacements</h2>
          <p>Report access problems promptly and provide the service name and relevant order reference. Support or replacement eligibility depends on the nature of the issue, the service requirements, account use, and the applicable plan. Never share passwords or one-time codes with support.</p>
        </section>

        <section id="acceptable-use">
          <h2>8. Acceptable use</h2>
          <p>You must not misuse the platform, attempt unauthorised access, interfere with its operation, use fraudulent payment information, resell access without permission, or use a service in a way that violates law or the relevant provider’s conditions.</p>
        </section>

        <section id="availability">
          <h2>9. Availability and responsibility</h2>
          <p>We aim to keep UniPlug accurate and available, but maintenance, provider changes, connectivity, or events outside reasonable control may affect the platform or a third-party service. Nothing in these terms excludes rights or remedies that cannot lawfully be excluded under Kenyan consumer law.</p>
        </section>

        <section id="changes">
          <h2>10. Changes and contact</h2>
          <p>We may update these terms to reflect platform, provider, or legal changes. The effective date identifies the current version. Members can submit questions through the support-ticket page in their account.</p>
        </section>
      </article>
    </div>
  );
}
