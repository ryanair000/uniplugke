import type { Metadata } from "next";
import { PublicPageIntro } from "@/components/public-page";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How UniPlug handles personal data when you browse the catalog, use a member account, place orders, and request support."
};

export default function PrivacyPage() {
  return (
    <div className="public-page legal-page">
      <PublicPageIntro
        eyebrow="Privacy"
        title="Your information should be handled clearly."
        description="This notice explains the personal data UniPlug may process, why it is needed, and the choices available to you."
      />

      <article className="public-page-shell legal-document">
        <p className="legal-updated">Effective: 26 July 2026</p>

        <section>
          <h2>1. Scope of this notice</h2>
          <p>This notice applies when you browse UniPlug, use a member account, place or manage an order, access a subscription, or contact the support team.</p>
        </section>

        <section>
          <h2>2. Information we may collect</h2>
          <ul>
            <li>Account details such as your name, username, email address, and phone number.</li>
            <li>Order and subscription records, including selected plans, billing cycles, payment status, activation state, and renewal dates.</li>
            <li>Support communications and the information you choose to include in a request.</li>
            <li>Security and technical information needed to protect sessions, investigate errors, and keep the service reliable.</li>
            <li>Preferences such as renewal reminders and optional marketing choices.</li>
          </ul>
        </section>

        <section>
          <h2>3. Why we use personal data</h2>
          <p>We use personal data to provide and secure member accounts, process requested transactions, coordinate service activation and support, show order and renewal information, respond to enquiries, meet legal obligations, and improve the reliability of UniPlug.</p>
        </section>

        <section>
          <h2>4. Payments and service partners</h2>
          <p>Payment providers and service-fulfillment partners may process the information required to complete a transaction or activate a selected service. UniPlug does not need your account password or one-time authentication codes for support. Do not send them to us.</p>
        </section>

        <section>
          <h2>5. Sharing and transfers</h2>
          <p>Information is shared only where reasonably needed to operate the platform, fulfill your request, comply with law, protect users, or work with contracted providers. Where processing involves a transfer outside Kenya, appropriate safeguards should apply as required by Kenyan data-protection law.</p>
        </section>

        <section>
          <h2>6. Retention and security</h2>
          <p>We retain information for as long as needed for the purpose it was collected, including account administration, transaction records, support, fraud prevention, dispute handling, and legal requirements. We use access controls and technical and organisational safeguards appropriate to the information being processed.</p>
        </section>

        <section>
          <h2>7. Your privacy rights</h2>
          <p>Subject to applicable law, you may ask to be informed about how your data is used, request access or correction, object to certain processing, or request deletion of false or misleading information. You can start a request by emailing <a href="mailto:support@uniplug.co.ke">support@uniplug.co.ke</a>.</p>
          <p>Kenya’s Office of the Data Protection Commissioner provides more information about <a href="https://www.odpc.go.ke/rights-of-a-data-subject/" target="_blank" rel="noreferrer">data-subject rights</a> and complaints.</p>
        </section>

        <section>
          <h2>8. Updates and contact</h2>
          <p>We may update this notice when the platform, providers, or legal requirements change. The effective date above identifies the current version. Questions can be sent to <a href="mailto:support@uniplug.co.ke">support@uniplug.co.ke</a>.</p>
        </section>
      </article>
    </div>
  );
}
