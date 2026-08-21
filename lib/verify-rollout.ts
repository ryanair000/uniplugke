import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type VerifyProviderOperationalStatus = "disabled" | "pilot" | "live" | "paused";
export type VerifyProviderAuthorizationStatus = "pending" | "approved" | "revoked";
export type VerifyProviderTermsStatus = "pending" | "approved" | "blocked";

export type VerifyProviderRollout = {
  provider: string;
  operational_status: VerifyProviderOperationalStatus;
  authorization_status: VerifyProviderAuthorizationStatus;
  authorization_model: string;
  authorization_reference: string;
  terms_review_status: VerifyProviderTermsStatus;
  code_semantics: string;
  incident_owner: string;
  support_runbook_reference: string;
  sender_allowlist_reviewed: boolean;
  parser_fixtures_reviewed: boolean;
  expiry_rules_reviewed: boolean;
  abuse_limits_reviewed: boolean;
  forbidden_code_classes_confirmed: boolean;
  support_runbook_reviewed: boolean;
  shutdown_reason: string | null;
  approved_at: string | null;
  updated_at: string;
};

export function providerRolloutIsReady(rollout: VerifyProviderRollout | null | undefined) {
  return Boolean(
    rollout
      && rollout.authorization_status === "approved"
      && rollout.terms_review_status === "approved"
      && rollout.authorization_model.trim().length >= 20
      && rollout.authorization_reference.trim().length >= 3
      && rollout.code_semantics.trim().length >= 20
      && rollout.incident_owner.trim().length >= 3
      && rollout.support_runbook_reference.trim().length >= 3
      && rollout.sender_allowlist_reviewed
      && rollout.parser_fixtures_reviewed
      && rollout.expiry_rules_reviewed
      && rollout.abuse_limits_reviewed
      && rollout.forbidden_code_classes_confirmed
      && rollout.support_runbook_reviewed
  );
}

export async function getVerifyProviderAccess({
  admin,
  provider,
  subscriptionId
}: {
  admin: SupabaseClient;
  provider: string;
  subscriptionId: string;
}) {
  const { data, error } = await admin
    .from("uniplug_verify_provider_rollouts")
    .select("provider,operational_status,authorization_status,authorization_model,authorization_reference,terms_review_status,code_semantics,incident_owner,support_runbook_reference,sender_allowlist_reviewed,parser_fixtures_reviewed,expiry_rules_reviewed,abuse_limits_reviewed,forbidden_code_classes_confirmed,support_runbook_reviewed,shutdown_reason,approved_at,updated_at")
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("VeriFy provider rollout lookup failed", { provider, error: error.message });
    return { allowed: false, failureCategory: "provider_disabled" as const, rollout: null };
  }

  const rollout = data as VerifyProviderRollout;
  if (!providerRolloutIsReady(rollout) || ["disabled", "paused"].includes(rollout.operational_status)) {
    return { allowed: false, failureCategory: "provider_disabled" as const, rollout };
  }
  if (rollout.operational_status === "live") {
    return { allowed: true, failureCategory: null, rollout };
  }

  const { data: cohort, error: cohortError } = await admin
    .from("uniplug_verify_provider_cohorts")
    .select("id")
    .eq("provider", provider)
    .eq("client_subscription_id", subscriptionId)
    .maybeSingle();
  if (cohortError) {
    console.error("VeriFy provider cohort lookup failed", { provider, subscriptionId, error: cohortError.message });
  }
  return {
    allowed: Boolean(!cohortError && cohort),
    failureCategory: !cohortError && cohort ? null : "provider_pilot_restricted" as const,
    rollout
  };
}
