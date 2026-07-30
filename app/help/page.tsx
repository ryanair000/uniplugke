import type { Metadata } from "next";
import { HelpFaq } from "@/components/help-faq";
import { PublicCard, PublicCta, PublicPageIntro } from "@/components/public-page";

export const metadata: Metadata = {
  title: "Help Centre",
  description: "Answers and support for UniPlug accounts, plans, payments, activations, renewals, and service issues."
};

const faqs = [
  {
    question: "Why do prices appear in both KSh and USD?",
    answer: "KSh is the checkout currency. The USD amount is an approximate equivalent based on UniPlug’s configured display rate, so your final payment remains the KSh amount shown."
  },
  {
    question: "How do I become a member?",
    answer: "Membership access is invitation-based. If you have received an invitation, use the secure link to create your password and activate your account."
  },
  {
    question: "Where can I follow an order?",
    answer: "Open My UniPlug and choose Orders. Each order shows its payment state, fulfillment progress, included services, and reference number."
  },
  {
    question: "How will I know when a service is active?",
    answer: "Activation progress appears in your dashboard. Timing depends on the service, account checks, and the setup requirements shown before purchase."
  },
  {
    question: "Can I request a pause or cancellation?",
    answer: "Eligible active subscriptions include request options in the subscription detail page. The support team reviews each request against the current plan conditions."
  },
  {
    question: "What happens before renewal?",
    answer: "Your dashboard displays the renewal date. Members can also enable renewal reminders in Profile & security."
  },
  {
    question: "What should I include in a support message?",
    answer: "Share your order number or the service name and describe what you expected to happen. Never send a password, one-time code, or full payment credentials."
  },
  {
    question: "Can UniPlug help with a service access problem?",
    answer: "Yes. Use the support option on the relevant subscription or contact the team on WhatsApp. Eligibility for a correction or replacement depends on the service and issue."
  }
];

export default function HelpPage() {
  return (
    <div className="public-page">
      <PublicPageIntro
        eyebrow="Help Centre"
        title="Answers when you need them."
        description="Find quick guidance for accounts, orders, activations, renewals, and support—without sharing sensitive account information."
      />

      <div className="public-page-shell public-page-content">
        <section className="public-card-grid three" aria-label="Support channels">
          <PublicCard marker="Chat" title="WhatsApp support">
            <p>Talk to a real person for order, activation, or service help.</p>
            <a className="public-text-link" href="https://wa.me/254113033475">Open WhatsApp →</a>
          </PublicCard>
          <PublicCard marker="Email" title="Email support">
            <p>Send a detailed, non-urgent request and include the relevant order reference.</p>
            <a className="public-text-link" href="mailto:support@uniplug.co.ke">support@uniplug.co.ke →</a>
          </PublicCard>
          <PublicCard marker="Account" title="Member dashboard">
            <p>Check current orders, subscriptions, renewal dates, and support activity.</p>
            <a className="public-text-link" href="/dashboard">Open My UniPlug →</a>
          </PublicCard>
        </section>

        <HelpFaq items={faqs} />

        <PublicCta
          eyebrow="Still need help?"
          title="Send the support team a message."
          description="For the fastest help, include the service name and your order reference. Never include passwords or one-time codes."
          primaryHref="https://wa.me/254113033475"
          primaryLabel="Chat on WhatsApp"
          secondaryHref="/contact"
          secondaryLabel="Contact options"
        />
      </div>
    </div>
  );
}
