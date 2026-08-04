import "server-only";

import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

export type TrackedSubscription = {
  id: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  nextRenewalDate: string | null;
  billingCycle: string;
  amount: number;
  currency: string;
  autoRenew: boolean;
  serviceIdentifier: string | null;
  hasAssignedAccount: boolean;
  service: { id: string; name: string; category: string; description: string | null } | null;
};

export async function getTrackedSubscriptions(clientId: string) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [] as TrackedSubscription[];
  const { data, error } = await supabase
    .from("client_subscriptions")
    .select("id,status,start_date,end_date,next_renewal_date,billing_cycle,amount,currency,auto_renew,service_identifier,account_reference,metadata,service:client_services!client_subscriptions_service_id_fkey(id,name,category,description)")
    .eq("client_id", clientId)
    .order("next_renewal_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Tracked subscriptions could not be loaded: ${error.message}`);
  return (data || []).map((row) => ({
    id: row.id,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    nextRenewalDate: row.next_renewal_date,
    billingCycle: row.billing_cycle,
    amount: Number(row.amount),
    currency: String(row.currency).trim(),
    autoRenew: row.auto_renew,
    serviceIdentifier: row.service_identifier,
    hasAssignedAccount: Boolean(row.account_reference || (row.metadata as Record<string, unknown> | null)?.assigned_account_id),
    service: row.service as unknown as TrackedSubscription["service"]
  }));
}

export async function getTrackedSubscription(clientId: string, subscriptionId: string) {
  const subscriptions = await getTrackedSubscriptions(clientId);
  return subscriptions.find((subscription) => subscription.id === subscriptionId) || null;
}

export async function getAuthorizedAccessDetails(userId: string, subscriptionId: string) {
  const admin = createAdminSupabaseClient();
  if (!admin) return { error: "Account access is not configured." } as const;
  const { data: portal } = await admin.from("client_portal_accounts")
    .select("client_id,must_change_password")
    .eq("user_id", userId)
    .maybeSingle();
  if (!portal || portal.must_change_password) return { error: "Complete password setup first." } as const;

  const { data: subscription } = await admin.from("client_subscriptions")
    .select("id,status,account_reference,metadata,service:client_services!client_subscriptions_service_id_fkey(name)")
    .eq("id", subscriptionId)
    .eq("client_id", portal.client_id)
    .maybeSingle();
  if (!subscription || !["active", "due_soon", "trial"].includes(subscription.status)) {
    return { error: "An active tracked service was not found." } as const;
  }

  const metadata = (subscription.metadata || {}) as Record<string, unknown>;
  let accountId = typeof metadata.assigned_account_id === "string" ? metadata.assigned_account_id : null;
  const legacyId = typeof metadata.legacy_id === "string" && /^[0-9a-f-]{36}$/i.test(metadata.legacy_id)
    ? metadata.legacy_id
    : null;
  if (!accountId && legacyId) {
    const { data: legacy } = await admin.from("subscriptions").select("account_id").eq("id", legacyId).maybeSingle();
    accountId = legacy?.account_id || null;
  }

  let accountQuery = admin.from("accounts").select("account_mail,account_password,verification_code");
  accountQuery = accountId
    ? accountQuery.eq("id", accountId)
    : accountQuery.eq("account_mail", subscription.account_reference || "");
  const { data: account } = await accountQuery.maybeSingle();
  if (!account) return { error: "Access details are not assigned yet. Contact support." } as const;
  const service = subscription.service as unknown as { name?: string } | null;
  return {
    details: {
      serviceName: service?.name || "Tracked service",
      accountEmail: account.account_mail,
      accountPassword: account.account_password,
      verificationCode: account.verification_code
    }
  } as const;
}
