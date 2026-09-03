import { AdminMetricStrip } from "@/components/admin-console";
import { getPortalProvisioningCoverage } from "@/lib/portal-provisioning";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabaseClient>>;
type Coverage = Awaited<ReturnType<typeof getPortalProvisioningCoverage>>;

type AdminMemberMetricsProps = {
  portalActive: number;
  linked?: number;
  syncIssues?: number;
  pendingInvites: number;
};

const COVERAGE_CACHE_MS = 15_000;
let coverageCache: { expiresAt: number; promise: Promise<Coverage> } | null = null;

function cachedCoverage(admin: AdminClient) {
  const now = Date.now();
  if (coverageCache && coverageCache.expiresAt > now) return coverageCache.promise;

  const promise = getPortalProvisioningCoverage(admin).catch((error) => {
    if (coverageCache?.promise === promise) coverageCache = null;
    throw error;
  });
  coverageCache = { expiresAt: now + COVERAGE_CACHE_MS, promise };
  return promise;
}

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
      { label: "Linked", value: linked ?? "…", detail: "mapped to LokiMax client" },
      { label: "Sync issues", value: syncIssues ?? "…", detail: "checking account coverage", tone: syncIssues ? "danger" : "default" },
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
  if (!admin) {
    return <AdminMemberMetricsFallback portalActive={portalActive} linked={linked} syncIssues={syncIssues} pendingInvites={pendingInvites} />;
  }

  const coverage = await cachedCoverage(admin);
  const totalSyncIssues = (syncIssues ?? 0) + coverage.missingCount;

  return (
    <AdminMetricStrip items={[
      { label: "Portal active", value: portalActive, detail: "enabled member profiles", tone: "good" },
      { label: "Eligible subscribers", value: coverage.eligibleCount, detail: "active or due soon" },
      { label: "Linked", value: linked ?? coverage.provisionedEligibleCount, detail: "mapped to LokiMax client" },
      { label: "Sync issues", value: totalSyncIssues, detail: coverage.missingCount ? `${coverage.missingCount} missing eligible accounts` : "needs review", tone: totalSyncIssues ? "danger" : "good" },
      { label: "Invites", value: pendingInvites, detail: "active links" }
    ]} />
  );
}
