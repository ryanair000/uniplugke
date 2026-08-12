import type { Metadata } from "next";
import Link from "next/link";
import { PublicCard, PublicCta, PublicPageIntro } from "@/components/public-page";

export const metadata: Metadata = {
  title: "About UniPlug",
  description: "Learn how UniPlug makes discovering, purchasing, and managing everyday digital services simpler for members in Kenya."
};

const principles = [
  {
    marker: "01",
    title: "Clear before checkout",
    copy: "Compare supported devices, setup requirements, starting prices, and activation expectations before choosing."
  },
  {
    marker: "02",
    title: "Account-based ticket support",
    copy: "Members create support tickets so each request stays connected to the relevant account, order, or subscription."
  },
  {
    marker: "03",
    title: "One service history",
    copy: "Payment, activation, renewal, and support updates stay attached to the same member account."
  }
];

export default function AboutPage() {
  return (
    <div className="public-page">
      <PublicPageIntro
        eyebrow="About UniPlug"
        title="A clearer way to manage digital services."
        description="UniPlug is a Kenya-focused catalog and member portal for discovering services, understanding activation, and keeping orders, renewals, and support organised."
      >
        <Link className="button button-primary" href="/services">Explore services</Link>
      </PublicPageIntro>

      <div className="public-page-shell public-page-content">
        <section className="public-story-grid">
          <div>
            <p className="public-eyebrow">Why we exist</p>
            <h2>Less account clutter. More clarity.</h2>
          </div>
          <div className="public-prose">
            <p>Digital services are useful, but keeping track of where to buy, how activation works, when a plan renews, and where to get help can become unnecessarily complicated.</p>
            <p>Visitors can browse public dollar starting prices. Signed-in members can review exact KSh plan prices, complete checkout, and follow the service lifecycle from My UniPlug.</p>
          </div>
        </section>

        <section className="public-card-grid three" aria-label="How UniPlug is designed">
          {principles.map((principle) => (
            <PublicCard key={principle.title} marker={principle.marker} title={principle.title}>
              <p>{principle.copy}</p>
            </PublicCard>
          ))}
        </section>

        <section className="public-split-panel">
          <div>
            <p className="public-eyebrow">Built around the member</p>
            <h2>One account for the full service lifecycle.</h2>
          </div>
          <ul className="public-check-list">
            <li>Discover services and supported devices</li>
            <li>Review private member plans before checkout</li>
            <li>Follow payment and activation progress</li>
            <li>See renewal dates and account activity</li>
            <li>Request support from the same dashboard</li>
          </ul>
        </section>

        <PublicCta
          eyebrow="Start exploring"
          title="Find the service that fits your day."
          description="Browse the catalog openly. If you need member access, the Kenyan support team can help you get started."
          primaryHref="/services"
          primaryLabel="Browse services"
          secondaryHref="/help"
          secondaryLabel="Visit help centre"
        />
      </div>
    </div>
  );
}
