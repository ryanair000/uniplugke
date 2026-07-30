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
        {isMember ? (
          <nav className="desktop-nav" aria-label="Primary navigation">
            <Link href="/services">Services</Link>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/help">Support</Link>
          </nav>
        ) : <span className="desktop-nav">Invitation-only storefront</span>}
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
        {isMember ? <details className="mobile-menu">
          <summary aria-label="Open navigation menu">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </summary>
          <div className="mobile-menu-panel">
            <nav aria-label="Mobile navigation">
              <Link href="/services">Services</Link>
              <Link href="/#how-it-works">How it works</Link>
              <Link href="/help">Help centre</Link>
              <Link href="/contact">Contact</Link>
            </nav>
            <div className="mobile-menu-account">
              <Link href="/dashboard">Open My UniPlug</Link>
              {isAdmin ? <Link href="/admin">Administration</Link> : null}
              <CartLink />
              <SignOutButton />
            </div>
          </div>
        </details> : null}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer id="support" className="site-footer">
      <div className="footer-shell footer-simple">
        <div className="footer-simple-brand">
          <Brand tone="dark" />
          <span>Digital services, simply managed.</span>
        </div>
        <nav className="footer-simple-links" aria-label="Footer links">
          <Link href="/help">Help</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <p className="footer-simple-copyright">© 2026 UniPlug.</p>
      </div>
    </footer>
  );
}
