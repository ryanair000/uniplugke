import Link from "next/link";
import { CatalogExplorer } from "@/components/catalog";
import { getPublicCatalog, getMemberPlans } from "@/lib/catalog";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const services = await getPublicCatalog();
  const viewer = await getViewer();
  const isMember = Boolean(viewer.profile?.status === "active");
  const plans = isMember ? await getMemberPlans(services.map((service) => service.id)) : [];

  return (
    <>
      <section className="hero"><div className="shell hero-grid"><div><p className="eyebrow">One digital membership hub</p><h1>Everything digital.<br /><span>One simple account.</span></h1><p className="hero-copy">Browse a carefully arranged catalog, then sign in to unlock member plans, purchasing, renewals, and service management.</p><div className="hero-actions"><Link className="button button-dark" href="/services">Browse services</Link><Link className="button button-light" href={isMember ? "/dashboard" : "/login"}>{isMember ? "Open dashboard" : "Member sign in"}</Link></div></div><div className="hero-orbit"><div className="orbit-card main"><span>⚡</span><strong>My UniPlug</strong><small>Services, renewals and support</small></div><div className="orbit-card one">Streaming</div><div className="orbit-card two">Creative</div><div className="orbit-card three">Gaming</div></div></div></section>
      <section className="section shell"><div className="section-heading"><div><p className="eyebrow">Service catalog</p><h2>Pick what powers your day</h2></div><Link href="/services">View all services →</Link></div><CatalogExplorer services={services} plans={plans} isMember={isMember} /></section>
      <section id="how-it-works" className="steps-section"><div className="shell"><div className="section-heading centered"><div><p className="eyebrow">Straightforward from day one</p><h2>Discover first. Manage everything after sign-in.</h2></div></div><div className="steps-grid"><article><span>01</span><h3>Browse cleanly</h3><p>Guests can explore service details without a crowded public price list.</p></article><article><span>02</span><h3>Unlock member plans</h3><p>Invited members sign in to see private pricing and available plans.</p></article><article><span>03</span><h3>Manage in one place</h3><p>Track purchases, activations, renewals, and support from My UniPlug.</p></article></div></div></section>
    </>
  );
}
