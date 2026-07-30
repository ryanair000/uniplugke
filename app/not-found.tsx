import Link from "next/link";
import { PublicPageIntro } from "@/components/public-page";

export default function NotFound() {
  return (
    <div className="public-page not-found-page">
      <PublicPageIntro
        eyebrow="404"
        title="That page isn’t plugged in."
        description="The address may be outdated or the page may have moved. Browse the catalog, return home, or ask the support team for help."
      >
        <Link className="button button-primary" href="/services">Browse services</Link>
        <Link className="button button-light" href="/">Go home</Link>
        <Link className="button button-light" href="/help">Get help</Link>
      </PublicPageIntro>
    </div>
  );
}
