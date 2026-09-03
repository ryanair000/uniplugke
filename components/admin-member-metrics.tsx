import { AdminMetricStrip } from "@/components/admin-console";
import { getPortalProvisioningCoverage } from "@/lib/portal-provisioning";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

type AdminMemberMetricsProps = {
  portalActive: number;
  linked: number;
  syncIssues: number;
  pendingInvites: number;
};

export function AdminMemberMetricsFallback({
  portalActive,
  linked,
  syncIssues,
  pendingInvites
}: AdminMemberMetricsProps) {
  return (
    <AdminMetricStrip items={[
      { label: "Portal active", value: portalActive, detail: "enabled member profiles", tone: "good" },
      { label: "Eligible subscribers", value: "…", detail: "checking coverage" },
      { label: "Linked", value: linked, detail: "mapped to LokiMax client" },
      { label: "Sync issues", value: syncIssues || "…", detail: "checking account coverage", tone: syncIssues ? "danger" : "default" },
      { label: "Invites", value: pendingInvites, detail: "active links" }
    ]} />
  );
}

export async function AdminMemberMetrics({
  portalActive,
  linked,
  syncIssues,
  pendingInvites
}: AdminMemberMetricsProps) {
  const admin = createAdminSupabaseClient();
  const coverage = admin
    ? await getPortalProvisioningCoverage(admin)
    : { eligibleCount: 0, missingCount: 0 };
  const totalSyncIssues = syncIssues + coverage.missingCount;

  return (
    <AdminMetricStrip items={[
      { label: "Portal active", value: portalActive, detail: "enabled member profiles", tone: "good" },
      { label: "Eligible subscribers", value: coverage.eligibleCount, detail: "active or due soon" },
      { label: "Linked", value: linked, detail: "mapped to LokiMax client" },
      { label: "Sync issues", value: totalSyncIssues, detail: coverage.missingCount ? `${coverage.missingCount} missing eligible accounts` : "needs review", tone: totalSyncIssues ? "danger" : "good" },
      { label: "Invites", value: pendingInvites, detail: "active links" }
    ]} />
  );
}
