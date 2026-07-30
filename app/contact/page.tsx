import type { Metadata } from "next";
import { PublicCard, PublicPageIntro } from "@/components/public-page";

export const metadata: Metadata = {
  title: "Contact UniPlug",
  description: "Contact UniPlug for help with digital services, accounts, orders, activations, and renewals."
};

export default function ContactPage() {
  return (
    <div className="public-page">
      <PublicPageIntro
        eyebrow="Contact"
        title="Talk to the UniPlug team."
        description="Choose the channel that fits your request. WhatsApp is best for active order or service issues; email works well for detailed, non-urgent questions."
      />

      <div className="public-page-shell public-page-content">
        <section className="public-card-grid two" aria-label="Contact methods">
          <PublicCard marker="Chat" title="WhatsApp">
            <p>Get help with an order, activation, renewal, or a service connected to your member account.</p>
            <a className="button button-primary" href="https://wa.me/254113033475">Message +254 113 033 475</a>
          </PublicCard>
          <PublicCard marker="Email" title="Email">
            <p>Send product questions, account enquiries, or information that benefits from a more detailed response.</p>
            <a className="button button-light" href="mailto:support@uniplug.co.ke">support@uniplug.co.ke</a>
          </PublicCard>
        </section>

        <section className="contact-expectations" aria-label="Choosing a support channel">
          <article><span>Fastest route</span><strong>WhatsApp for an active order or access issue</strong></article>
          <article><span>Best for detail</span><strong>Email for questions that need more context</strong></article>
          <article><span>Have ready</span><strong>Your service name and order reference</strong></article>
        </section>

        <section className="public-split-panel contact-guidance">
          <div>
            <p className="public-eyebrow">Help us help you</p>
            <h2>Include the right context.</h2>
          </div>
          <ul className="public-check-list">
            <li>Your order number, if the request relates to a purchase</li>
            <li>The service name and a short description of the issue</li>
            <li>What you expected and what happened instead</li>
            <li>A safe screenshot with sensitive details hidden, when useful</li>
          </ul>
        </section>

        <aside className="public-security-note">
          <strong>Protect your account.</strong>
          <p>UniPlug support will not ask for your password, one-time code, or complete card or mobile-money credentials. Do not send those details by WhatsApp or email.</p>
        </aside>
      </div>
    </div>
  );
}
