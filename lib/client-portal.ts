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
  bundleItemCount: number;
  bundleTotalAmount: number;
  service: {
    id: string;
    name: string;
    category: string;
    description: string | null;
    verifyEnabled: boolean;
    verifyProvider: string | null;
  } | null;
};

type RpcResult = { data: unknown; error: { message: string } | null };
type RpcClient = {
  rpc: (functionName: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
};
type AccountAccessRow = {
  service_name?: string | null;
  account_email?: string | null;
  account_password?: string | null;
  verification_code?: string | null;
  profile_name?: string | null;
  profile_pin?: string | null;
};

export async function getTrackedSubscriptions(clientId: string) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [] as TrackedSubscription[];
  const { data, error } = await supabase
    .from("client_subscriptions")
    .select("id,status,start_date,end_date,next_renewal_date,billing_cycle,amount,currency,auto_renew,service_identifier,account_reference,metadata,verify_enabled,service:client_services!client_subscriptions_service_id_fkey(id,name,category,description,verify_enabled,verify_provider)")
    .eq("client_id", clientId)
    .order("next_renewal_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Tracked subscriptions could not be loaded: ${error.message}`);
  return (data || []).flatMap((row) => {
    const metadata = (row.metadata || {}) as Record<string, unknown>;
    if (metadata.portal_hidden === true) return [];
    const relatedService = (Array.isArray(row.service) ? row.service[0] : row.service) as {
      id: string;
      name: string;
      category: string;
      description: string | null;
      verify_enabled: boolean;
      verify_provider: string | null;
    } | null;
    const bundleItemCount = Math.max(1, Number(metadata.bundle_item_count) || 1);
    const bundleTotalAmount = Number(metadata.bundle_total_amount);
    return [{
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
      hasAssignedAccount: Boolean(row.account_reference || metadata.assigned_account_id || metadata.assigned_slot_id),
      bundleItemCount,
      bundleTotalAmount: Number.isFinite(bundleTotalAmount) ? bundleTotalAmount : Number(row.amount),
      service: relatedService ? {
        id: relatedService.id,
        name: relatedService.name,
        category: relatedService.category,
        description: relatedService.description,
        verifyEnabled: Boolean(relatedService.verify_enabled && row.verify_enabled),
        verifyProvider: relatedService.verify_provider
      } : null
    }];
  });
}

export async function getTrackedSubscription(clientId: string, subscriptionId: string) {
  const subscriptions = await getTrackedSubscriptions(clientId);
  return subscriptions.find((subscription) => subscription.id === subscriptionId) || null;
}

export async function getAuthorizedAccessDetails(userId: string, subscriptionId: string) {
  void userId;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "Account access is not configured." } as const;
  const rpcClient = supabase as unknown as RpcClient;
  const { data, error } = await rpcClient.rpc("uniplug_get_client_account_access_v2", {
    p_client_subscription_id: subscriptionId
  });
  if (error) return { error: error.message } as const;
  const account = (Array.isArray(data) ? data[0] : null) as AccountAccessRow | null;
  if (!account) return { error: "Access details are not assigned yet. Create a support ticket." } as const;
  return {
    details: {
      serviceName: account.service_name || "Tracked service",
      accountEmail: account.account_email || "",
      accountPassword: account.account_password || "",
      verificationCode: account.verification_code || null,
      profileName: account.profile_name || null,
      profilePin: account.profile_pin || null
    }
  } as const;
}
