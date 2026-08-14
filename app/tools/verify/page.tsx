import type { Metadata } from "next";
import { VerifyTool } from "@/components/verify-tool";
import { requireMember } from "@/lib/auth";
import { getTrackedSubscriptions } from "@/lib/client-portal";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getVerifyProvider } from "@/lib/verify/provider-registry";
import { getVerifyProviderAccess } from "@/lib/verify-rollout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "VeriFy",
  description: "Get temporary access codes for eligible UniPlug services."
};

export default async function VerifyPage() {
  const viewer = await requireMember();
  const admin = createAdminSupabaseClient();
  const trackedSubscriptions = viewer.profile.clientId
    ? await getTrackedSubscriptions(viewer.profile.clientId)
    : [];
  const subscriptions = admin
    ? (await Promise.all(trackedSubscriptions.map(async (subscription) => {
          const provider = getVerifyProvider(subscription.service?.verifyProvider);
          const eligible = provider?.isEligible({
            status: subscription.status,
            capabilityEnabled: Boolean(subscription.service?.verifyEnabled),
            hasAssignedAccount: subscription.hasAssignedAccount
          });
          if (!provider || !eligible) return null;
          const access = await getVerifyProviderAccess({
            admin,
            provider: provider.id,
            subscriptionId: subscription.id
          });
          return access.allowed ? {
            id: subscription.id,
            name: subscription.service?.name || subscription.serviceIdentifier || provider.displayName,
            status: subscription.status,
            provider: provider.id,
            providerName: provider.displayName,
            providerMark: provider.mark,
            instructions: [...provider.instructions]
          } : null;
        }))).filter((subscription) => subscription !== null)
    : [];

  return (
    <section className="wallet-page verify-page">
      <header className="wallet-page-header verify-page-header">
        <div>
          <p className="wallet-kicker">Member tools</p>
          <h1>VeriFy</h1>
          <p>Get a temporary sign-in code for an eligible UniPlug service without opening or sharing a managed mailbox.</p>
        </div>
        <div className="verify-shield" aria-hidden="true">✓</div>
      </header>

      <section className="verify-trust-note">
        <span aria-hidden="true">⌁</span>
        <div><strong>Private by design</strong><p>VeriFy extracts only an approved service code. It does not show emails, reset links, or mailbox credentials.</p></div>
      </section>

      <VerifyTool subscriptions={subscriptions} />
    </section>
  );
}
