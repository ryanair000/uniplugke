import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  void userId;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "Account access is not configured." } as const;
  const { data, error } = await supabase.rpc("uniplug_get_client_account_access", {
    p_client_subscription_id: subscriptionId
  });
  if (error) return { error: error.message } as const;
  const account = Array.isArray(data) ? data[0] : null;
  if (!account) return { error: "Access details are not assigned yet. Create a support ticket." } as const;
  return {
    details: {
      serviceName: account.service_name || "Tracked service",
      accountEmail: account.account_email,
      accountPassword: account.account_password,
      verificationCode: account.verification_code,
      profileName: account.profile_name
    }
  } as const;
}
