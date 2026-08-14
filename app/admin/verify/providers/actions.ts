"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { recordVerifyAdminEvent } from "@/lib/verify-operations";
import { getVerifyProvider } from "@/lib/verify/provider-registry";
import {
  providerRolloutIsReady,
  type VerifyProviderAuthorizationStatus,
  type VerifyProviderOperationalStatus,
  type VerifyProviderRollout,
  type VerifyProviderTermsStatus
} from "@/lib/verify-rollout";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const operationalStatuses = new Set<VerifyProviderOperationalStatus>(["disabled", "pilot", "live", "paused"]);
const authorizationStatuses = new Set<VerifyProviderAuthorizationStatus>(["pending", "approved", "revoked"]);
const termsStatuses = new Set<VerifyProviderTermsStatus>(["pending", "approved", "blocked"]);

function textValue(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) || "").trim().slice(0, maxLength);
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function providerValue(formData: FormData) {
  const provider = String(formData.get("provider") || "");
  if (!getVerifyProvider(provider)) throw new Error("That VeriFy provider is not in the reviewed application registry.");
  return provider;
}

function refreshProviderPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/mailboxes");
  revalidatePath("/admin/verify/providers");
  revalidatePath("/tools/verify");
}

export async function updateVerifyProviderGovernance(formData: FormData) {
  const viewer = await requireAdmin();
  const provider = providerValue(formData);
  const operationalStatus = String(formData.get("operationalStatus") || "") as VerifyProviderOperationalStatus;
  const authorizationStatus = String(formData.get("authorizationStatus") || "") as VerifyProviderAuthorizationStatus;
  const termsReviewStatus = String(formData.get("termsReviewStatus") || "") as VerifyProviderTermsStatus;
  if (!operationalStatuses.has(operationalStatus) || !authorizationStatuses.has(authorizationStatus) || !termsStatuses.has(termsReviewStatus)) {
    throw new Error("A valid provider governance status is required.");
  }

  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");
  const { data: existing, error: existingError } = await admin
    .from("uniplug_verify_provider_rollouts")
    .select("operational_status,approved_at")
    .eq("provider", provider)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const changedAt = new Date().toISOString();
  const next = {
    provider,
    operational_status: operationalStatus,
    authorization_status: authorizationStatus,
    authorization_model: textValue(formData, "authorizationModel", 1200),
    authorization_reference: textValue(formData, "authorizationReference", 300),
    terms_review_status: termsReviewStatus,
    code_semantics: textValue(formData, "codeSemantics", 600),
    incident_owner: textValue(formData, "incidentOwner", 160),
    support_runbook_reference: textValue(formData, "supportRunbookReference", 300),
    sender_allowlist_reviewed: checked(formData, "senderAllowlistReviewed"),
    parser_fixtures_reviewed: checked(formData, "parserFixturesReviewed"),
    expiry_rules_reviewed: checked(formData, "expiryRulesReviewed"),
    abuse_limits_reviewed: checked(formData, "abuseLimitsReviewed"),
    forbidden_code_classes_confirmed: checked(formData, "forbiddenCodeClassesConfirmed"),
    support_runbook_reviewed: checked(formData, "supportRunbookReviewed"),
    shutdown_reason: operationalStatus === "paused" ? textValue(formData, "shutdownReason", 300) || "Paused during governance review" : null,
    approved_at: authorizationStatus === "approved" && termsReviewStatus === "approved"
      ? existing?.approved_at || changedAt
      : null,
    approved_by: authorizationStatus === "approved" && termsReviewStatus === "approved" ? viewer.user.id : null,
    updated_at: changedAt,
    updated_by: viewer.user.id
  };
  if (["pilot", "live"].includes(operationalStatus) && !providerRolloutIsReady(next as VerifyProviderRollout)) {
    redirect("/admin/verify/providers?error=readiness_incomplete");
  }

  const { error } = await admin.from("uniplug_verify_provider_rollouts").upsert(next, { onConflict: "provider" });
  if (error) throw new Error(error.message);
  const previousStatus = existing?.operational_status || "unconfigured";
  await recordVerifyAdminEvent({
    admin,
    actorUserId: viewer.user.id,
    action: previousStatus === "paused" && operationalStatus !== "paused" ? "provider_resumed" : "provider_governance_updated",
    outcome: "success",
    provider,
    metadata: { previousStatus, operationalStatus, authorizationStatus, termsReviewStatus }
  });
  refreshProviderPages();
  redirect("/admin/verify/providers?success=governance_updated");
}

export async function pauseVerifyProvider(formData: FormData) {
  const viewer = await requireAdmin();
  const provider = providerValue(formData);
  const reason = textValue(formData, "reason", 300);
  if (reason.length < 3) redirect("/admin/verify/providers?error=pause_reason_required");
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");
  const changedAt = new Date().toISOString();
  const { error } = await admin.from("uniplug_verify_provider_rollouts").update({
    operational_status: "paused",
    shutdown_reason: reason,
    updated_at: changedAt,
    updated_by: viewer.user.id
  }).eq("provider", provider);
  if (error) throw new Error(error.message);
  await recordVerifyAdminEvent({
    admin,
    actorUserId: viewer.user.id,
    action: "provider_paused",
    outcome: "success",
    provider,
    metadata: { reason }
  });
  refreshProviderPages();
  redirect("/admin/verify/providers?success=provider_paused");
}

export async function addVerifyProviderCohortMember(formData: FormData) {
  const viewer = await requireAdmin();
  const provider = providerValue(formData);
  const subscriptionId = String(formData.get("subscriptionId") || "");
  const note = textValue(formData, "note", 240);
  if (!uuidPattern.test(subscriptionId)) throw new Error("A valid subscription is required.");
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");
  const { data: subscription, error: subscriptionError } = await admin
    .from("client_subscriptions")
    .select("id,status,account_reference,verify_enabled,service:client_services!client_subscriptions_service_id_fkey(verify_enabled,verify_provider)")
    .eq("id", subscriptionId)
    .maybeSingle();
  const service = Array.isArray(subscription?.service) ? subscription.service[0] : subscription?.service;
  const adapter = getVerifyProvider(provider);
  if (subscriptionError || !subscription || !service || service.verify_provider !== provider || !adapter?.isEligible({
    status: subscription.status,
    capabilityEnabled: Boolean(service.verify_enabled && subscription.verify_enabled),
    hasAssignedAccount: Boolean(subscription.account_reference?.trim())
  })) {
    redirect("/admin/verify/providers?error=cohort_subscription_ineligible");
  }
  const { error } = await admin.from("uniplug_verify_provider_cohorts").upsert({
    provider,
    client_subscription_id: subscriptionId,
    added_by: viewer.user.id,
    note
  }, { onConflict: "provider,client_subscription_id" });
  if (error) throw new Error(error.message);
  await recordVerifyAdminEvent({
    admin,
    actorUserId: viewer.user.id,
    action: "provider_cohort_added",
    outcome: "success",
    provider,
    subscriptionId,
    metadata: { note: note || null }
  });
  refreshProviderPages();
  redirect("/admin/verify/providers?success=cohort_added");
}

export async function removeVerifyProviderCohortMember(formData: FormData) {
  const viewer = await requireAdmin();
  const cohortId = String(formData.get("cohortId") || "");
  if (!uuidPattern.test(cohortId)) throw new Error("A valid cohort record is required.");
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");
  const { data: cohort, error: cohortError } = await admin
    .from("uniplug_verify_provider_cohorts")
    .select("id,provider,client_subscription_id")
    .eq("id", cohortId)
    .maybeSingle();
  if (cohortError || !cohort || !getVerifyProvider(cohort.provider)) throw new Error(cohortError?.message || "Cohort record not found.");
  const { error } = await admin.from("uniplug_verify_provider_cohorts").delete().eq("id", cohortId);
  if (error) throw new Error(error.message);
  await recordVerifyAdminEvent({
    admin,
    actorUserId: viewer.user.id,
    action: "provider_cohort_removed",
    outcome: "success",
    provider: cohort.provider,
    subscriptionId: cohort.client_subscription_id
  });
  refreshProviderPages();
  redirect("/admin/verify/providers?success=cohort_removed");
}
