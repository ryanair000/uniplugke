import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@/components/auth";
import { CartLink } from "@/components/catalog";
import { getViewer } from "@/lib/auth";

export function Brand({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <Link
      href="/"
      className={`brand brand-${tone}`}
      aria-label="UniPlug home"
    >
      <span className="brand-mark" aria-hidden="true">
        <Image src="/figma/uniplug-mark.svg" alt="" width={24} height={34} />
      </span>
      <span>uniplug</span>
    </Link>
  );
}

export async function SiteHeader() {
  const viewer = await getViewer();
  const isMember = viewer.profile?.status === "active";
  const isAdmin = isMember && viewer.profile?.role === "admin";

  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="/services">Services</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/help">Support</Link>
        </nav>
        <div className="header-actions">
          {isMember ? (
            <>
              {isAdmin && <Link href="/admin">Operations</Link>}
              <Link href="/dashboard">My UniPlug</Link>
              <Link href="/dashboard/settings">Settings</Link>
              <CartLink />
              <SignOutButton />
            </>
          ) : (
            <Link className="button button-dark small" href="/login">
              Member sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

const footerColumns = [
  {
    title: "Explore",
    links: [
      { label: "Services", href: "/services" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Member sign in", href: "/login" }
    ]
  },
  {
    title: "Support",
    links: [
      { label: "Help centre", href: "/help" },
      { label: "WhatsApp support", href: "https://wa.me/254113033475" },
      { label: "Contact us", href: "/contact" }
    ]
  },
  {
    title: "Company",
    links: [
      { label: "About UniPlug", href: "/about" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" }
    ]
  }
] as const;

export function SiteFooter() {
  return (
    <footer id="support" className="site-footer">
      <div className="footer-shell">
        <div className="footer-top">
          <div className="footer-brand">
            <Brand tone="dark" />
            <p>Digital services, simply managed.</p>
          </div>
          <div className="footer-links">
            {footerColumns.map((column) => (
              <nav key={column.title} aria-label={`${column.title} links`}>
                <h2>{column.title}</h2>
                {column.links.map((link) => (
                  <Link key={link.label} href={link.href}>{link.label}</Link>
                ))}
              </nav>
            ))}
          </div>
        </div>
        <div className="footer-divider" />
        <div className="footer-bottom">
          <a href="mailto:support@uniplug.co.ke">support@uniplug.co.ke</a>
          <p>© 2026 UniPlug. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
