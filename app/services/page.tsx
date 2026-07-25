import { CatalogExplorer } from "@/components/catalog";
import { getPublicCatalog, getMemberPlans } from "@/lib/catalog";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services", description: "Explore UniPlug streaming, creative, productivity, cloud, security, gaming, and learning services." };

export default async function ServicesPage() {
  const services = await getPublicCatalog();
  const viewer = await getViewer();
  const isMember = Boolean(viewer.profile?.status === "active");
  const plans = isMember ? await getMemberPlans(services.map((service) => service.id)) : [];
  return <section className="section shell page-top"><div className="page-heading"><p className="eyebrow">Full catalog</p><h1>Services arranged around how you live, create, work, and play.</h1><p>Open any service for complete requirements, activation details, supported devices, and member options.</p></div><CatalogExplorer services={services} plans={plans} isMember={isMember} /></section>;
}
