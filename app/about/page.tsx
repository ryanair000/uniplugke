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
    title: "A clearer catalog",
    copy: "Services are organised around what people want to watch, create, store, play, and use for work."
  },
  {
    marker: "02",
    title: "Private member value",
    copy: "Plan pricing and purchase options stay inside the member experience, where eligibility and current availability can be shown responsibly."
  },
  {
    marker: "03",
    title: "Support after checkout",
    copy: "Activation status, renewal dates, order history, and support requests remain connected to one account."
  }
];

export default function AboutPage() {
  return (
    <div className="public-page">
      <PublicPageIntro
        eyebrow="About UniPlug"
        title="Digital services, simply managed."
        description="UniPlug brings useful digital memberships into one clean catalog and gives members one place to follow purchases, activations, renewals, and support."
      >
        <Link className="button button-primary" href="/services">Explore services</Link>
        <Link className="button button-light" href="/login">Member sign in</Link>
      </PublicPageIntro>

      <div className="public-page-shell public-page-content">
        <section className="public-story-grid">
          <div>
            <p className="public-eyebrow">Why we exist</p>
            <h2>Less account clutter. More clarity.</h2>
          </div>
          <div className="public-prose">
            <p>Digital services are useful, but keeping track of where to buy, how activation works, when a plan renews, and where to get help can become unnecessarily complicated.</p>
            <p>UniPlug is designed to make that journey calmer. Guests can understand the catalog without seeing a crowded price wall. Members can then sign in to view current plans and manage the services connected to their account.</p>
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
          title="Find the services that fit your day."
          description="Browse the public catalog, then sign in when you are ready to see member plans."
          primaryHref="/services"
          primaryLabel="Browse services"
          secondaryHref="/help"
          secondaryLabel="Visit help centre"
        />
      </div>
    </div>
  );
}
