import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { CartLink } from "@/components/catalog";
import { SignOutButton } from "@/components/auth";

export function Brand() {
  return <Link href="/" className="brand" aria-label="UniPlug home"><span className="brand-mark">⚡</span><span>uni<b>plug</b></span></Link>;
}

export async function SiteHeader() {
  const viewer = await getViewer();
  const isMember = Boolean(viewer.profile?.status === "active");
  const isAdmin = isMember && viewer.profile?.role === "admin";
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Brand />
        <nav className="desktop-nav"><Link href="/services">Services</Link><Link href="/#how-it-works">How it works</Link><Link href="/#support">Support</Link></nav>
        <div className="header-actions">
          {isMember ? <>{isAdmin && <Link href="/admin">Operations</Link>}<Link href="/dashboard">My UniPlug</Link><Link href="/settings">Settings</Link><CartLink /><SignOutButton /></> : <Link className="button button-dark small" href="/login">Member sign in</Link>}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer id="support" className="site-footer">
      <div className="shell footer-grid">
        <div><Brand /><p>Discover and manage digital services through one clean member portal.</p></div>
        <div><h4>Explore</h4><Link href="/services">All services</Link><Link href="/login">Member sign in</Link></div>
        <div><h4>Support</h4><a href="https://wa.me/254113033475">WhatsApp support</a><a href="mailto:support@uniplug.shop">support@uniplug.shop</a></div>
      </div>
    </footer>
  );
}
