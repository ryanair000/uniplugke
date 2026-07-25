import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanOptions } from "@/components/catalog";
import { getPublicService, getMemberPlans } from "@/lib/catalog";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await getPublicService(slug);
  return service ? { title: service.name, description: service.shortDescription } : { title: "Service not found" };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await getPublicService(slug);
  if (!service) notFound();
  const viewer = await getViewer();
  const isMember = Boolean(viewer.profile?.status === "active");
  const plans = isMember ? await getMemberPlans([service.id]) : [];

  return (
    <div className="service-detail">
      <section className="detail-hero"><div className="shell detail-hero-grid"><div><Link className="back-link" href="/services">← All services</Link><p className="eyebrow">{service.category.replace("_", " ")}</p><h1>{service.name}</h1><p>{service.description}</p><div className="detail-badges"><span>{service.fulfillmentLabel}</span><span>{service.availabilityStatus.replace("_", " ")}</span></div></div><div className="detail-logo" style={{ background: service.accentColor }}>{service.logoText}</div></div></section>
      <section className="section shell detail-grid"><div className="detail-main"><section><h2>What is included</h2><div className="feature-grid">{service.features.map((feature) => <div key={feature}>✓ {feature}</div>)}</div></section><section><h2>Supported devices</h2><div className="tag-row">{service.supportedDevices.map((device) => <span key={device}>{device}</span>)}</div></section><section><h2>How activation works</h2><p>{service.activationWindow}</p><ol>{service.setupRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ol></section><section><h2>Support and replacements</h2><p>{service.replacementSummary}</p></section><section><h2>Frequently asked questions</h2><div className="faq-list">{service.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section></div><aside className="detail-aside">{isMember ? <><p className="eyebrow">Member plans</p><PlanOptions plans={plans} service={service} /></> : <div className="member-lock"><span>🔒</span><h3>Member pricing is private</h3><p>Sign in with your UniPlug invitation to view plans and add this service to your cart.</p><Link className="button button-dark" href={`/login?next=/services/${service.slug}`}>Sign in to view pricing</Link></div>}</aside></section>
    </div>
  );
}
