import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { classifyMailboxConnectionError } from "@/lib/gmail";
import { getClientFamilyIds } from "@/lib/client-identity";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getVerifyProvider, needsRecentAuthentication } from "@/lib/verify/provider-registry";
import { getVerifyProviderAccess } from "@/lib/verify-rollout";

type VerifyResult = {
  status: number;
  body: Record<string, unknown>;
  retryAfter?: number;
};

type SubscriptionService = {
  name?: string | null;
  verify_enabled?: boolean | null;
  verify_provider?: string | null;
} | Array<{
  name?: string | null;
  verify_enabled?: boolean | null;
  verify_provider?: string | null;
}> | null;

type Reservation = {
  allowed: boolean;
  request_id: string;
  retry_after: number;
  failure_category: string | null;
  ip_anomaly: boolean;
};

function relatedService(service: SubscriptionService) {
  return Array.isArray(service) ? service[0] || null : service;
}

function elapsedMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function verifySupportUrl(provider: string, failureCategory: string, serviceName: string | null | undefined) {
  const query = new URLSearchParams({
    topic: "verify",
    provider,
    category: failureCategory,
    service: serviceName || provider
  });
  return `/dashboard/support?${query.toString()}`;
}

export function verifyRequestIpHash(request: Request) {
  const secret = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  const value = (
    request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]
    || ""
  ).trim();
  if (!value || value.length > 64) return null;
  return createHmac("sha256", secret).update(`verify-ip:${value}`).digest("hex");
}

export async function retrieveVerifyCode({
  authenticatedAt,
  clientId,
  ipHash,
  subscriptionId,
  userId
}: {
  authenticatedAt?: string | null;
  clientId: string | null;
  ipHash?: string | null;
  subscriptionId: string;
  userId: string;
}): Promise<VerifyResult> {
  const startedAt = Date.now();
  const admin = createAdminSupabaseClient();
  if (!admin || !process.env.GMAIL_TOKEN_ENCRYPTION_KEY) {
    return { status: 503, body: { error: "Code retrieval is temporarily unavailable." } };
  }
  if (!clientId) {
    return { status: 404, body: { error: "No eligible service was found." } };
  }

  let familyIds: string[];
  try {
    familyIds = (await getClientFamilyIds(admin, clientId)).familyIds;
  } catch (error) {
    console.error("VeriFy client family lookup failed", {
      category: "configuration_missing",
      clientId,
      latencyMs: elapsedMs(startedAt),
      error: error instanceof Error ? error.message : "unknown"
    });
    return { status: 503, body: { error: "Code retrieval is temporarily unavailable." } };
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from("client_subscriptions")
    .select("id,status,account_reference,service_identifier,verify_enabled,service:client_services!client_subscriptions_service_id_fkey(name,verify_enabled,verify_provider)")
    .eq("id", subscriptionId)
    .in("client_id", familyIds)
    .maybeSingle();

  if (subscriptionError) {
    console.error("VeriFy subscription lookup failed", {
      category: "configuration_missing",
      subscriptionId,
      latencyMs: elapsedMs(startedAt),
      error: subscriptionError.message
    });
    return { status: 503, body: { error: "Code retrieval is temporarily unavailable." } };
  }

  const service = subscription ? relatedService(subscription.service as SubscriptionService) : null;
  const provider = getVerifyProvider(service?.verify_provider);
  if (!subscription || !provider || !provider.isEligible({
    status: subscription.status,
    capabilityEnabled: Boolean(service?.verify_enabled && subscription.verify_enabled),
    hasAssignedAccount: Boolean(subscription.account_reference?.trim())
  })) {
    return { status: 404, body: { error: "No eligible service was found." } };
  }

  const providerAccess = await getVerifyProviderAccess({
    admin,
    provider: provider.id,
    subscriptionId
  });
  if (!providerAccess.allowed) {
    const rolloutFailureCategory = providerAccess.failureCategory || "provider_disabled";
    await admin.from("uniplug_household_events").insert({
      user_id: userId,
      client_subscription_id: subscriptionId,
      event_type: "provider_access_denied",
      outcome: providerAccess.rollout?.operational_status || "unconfigured",
      request_id: randomUUID(),
      provider: provider.id,
      failure_category: rolloutFailureCategory,
      latency_ms: elapsedMs(startedAt),
      ip_hash: ipHash || null
    });
    return {
      status: rolloutFailureCategory === "provider_pilot_restricted" ? 404 : 503,
      body: {
        status: "provider_unavailable",
        error: rolloutFailureCategory === "provider_pilot_restricted"
          ? "No eligible service was found."
          : `${provider.displayName} code retrieval is temporarily paused.`,
        supportUrl: verifySupportUrl(provider.id, rolloutFailureCategory, service?.name)
      }
    };
  }

  if (needsRecentAuthentication(provider, authenticatedAt)) {
    await admin.from("uniplug_household_events").insert({
      user_id: userId,
      client_subscription_id: subscriptionId,
      event_type: "recent_auth_required",
      outcome: provider.id,
      request_id: randomUUID(),
      provider: provider.id,
      failure_category: "recent_auth_required",
      latency_ms: elapsedMs(startedAt),
      ip_hash: ipHash || null
    });
    return {
      status: 401,
      body: {
        status: "reauthentication_required",
        error: "Sign in again before requesting a code for this service.",
        supportUrl: verifySupportUrl(provider.id, "recent_auth_required", service?.name)
      }
    };
  }

  const { data: reservationData, error: reservationError } = await admin.rpc(
    "uniplug_reserve_verify_request",
    {
      p_user_id: userId,
      p_client_subscription_id: subscriptionId,
      p_provider: provider.id,
      p_ip_hash: ipHash || null,
      p_window_seconds: 600,
      p_member_limit: 5,
      p_ip_anomaly_limit: 20,
      p_ip_limit: 30
    }
  );
  const reservation = (Array.isArray(reservationData) ? reservationData[0] : null) as Reservation | null;
  if (reservationError || !reservation) {
    console.error("VeriFy request reservation failed", {
      category: "configuration_missing",
      provider: provider.id,
      subscriptionId,
      latencyMs: elapsedMs(startedAt),
      error: reservationError?.message || "missing reservation"
    });
    return { status: 503, body: { error: "Code retrieval is temporarily unavailable." } };
  }

  if (!reservation.allowed) {
    return {
      status: 429,
      retryAfter: Math.max(1, Number(reservation.retry_after) || 600),
      body: {
        status: "rate_limited",
        error: "Too many checks. Wait a few minutes, then try again."
      }
    };
  }

  const audit = async ({
    eventType,
    outcome,
    failureCategory,
    messageFingerprint,
    idempotent = false
  }: {
    eventType: string;
    outcome: string;
    failureCategory?: string;
    messageFingerprint?: string;
    idempotent?: boolean;
  }) => {
    const { error } = await admin.from("uniplug_household_events").insert({
      user_id: userId,
      client_subscription_id: subscriptionId,
      event_type: eventType,
      outcome,
      request_id: reservation.request_id,
      provider: provider.id,
      failure_category: failureCategory || null,
      latency_ms: elapsedMs(startedAt),
      ip_hash: ipHash || null,
      message_fingerprint: messageFingerprint || null,
      idempotent
    });
    if (error) {
      console.error("VeriFy audit insert failed", {
        category: "configuration_missing",
        eventType,
        provider: provider.id,
        requestId: reservation.request_id,
        error: error.message
      });
    }
  };

  const mailboxEmail = subscription.account_reference?.trim().toLowerCase();
  if (!mailboxEmail) {
    await audit({
      eventType: "mailbox_not_connected",
      outcome: "assignment_missing",
      failureCategory: "assignment_missing"
    });
    return {
      status: 409,
      body: {
        status: "setup_required",
        error: "VeriFy is not ready for this service. Create a support ticket for help.",
        supportUrl: verifySupportUrl(provider.id, "assignment_missing", service?.name)
      }
    };
  }

  const { data: connection, error: connectionError } = await admin
    .from("uniplug_mailbox_credentials")
    .select("encrypted_app_password")
    .eq("mailbox_email", mailboxEmail)
    .maybeSingle();
  if (connectionError || !connection) {
    await audit({
      eventType: "mailbox_not_connected",
      outcome: connectionError ? "connection_lookup_failed" : "connection_missing",
      failureCategory: connectionError ? "configuration_missing" : "mailbox_connection_missing"
    });
    return {
      status: 409,
      body: {
        status: "setup_required",
        error: "VeriFy is not ready for this service. Create a support ticket for help.",
        supportUrl: verifySupportUrl(provider.id, connectionError ? "configuration_missing" : "mailbox_connection_missing", service?.name)
      }
    };
  }

  const checkedAt = new Date().toISOString();
  try {
    const result = await provider.retrieveLatestCode({
      mailboxEmail,
      encryptedAppPassword: connection.encrypted_app_password
    });
    await admin
      .from("uniplug_mailbox_credentials")
      .update({ last_checked_at: checkedAt, last_error: null, updated_at: checkedAt })
      .eq("mailbox_email", mailboxEmail);

    if (!result) {
      await audit({
        eventType: "code_not_found",
        outcome: "no_current_code",
        failureCategory: "no_current_code"
      });
      return {
        status: 202,
        retryAfter: 60,
        body: {
          status: "pending",
          error: `No new code was found. On ${provider.displayName} request a new message, then check again.`,
          supportUrl: verifySupportUrl(provider.id, "no_current_code", service?.name)
        }
      };
    }

    const recordMessage = async (message: typeof result) => admin.rpc(
      "uniplug_record_verify_message",
      {
        p_user_id: userId,
        p_client_subscription_id: subscriptionId,
        p_provider: provider.id,
        p_message_fingerprint: message.messageFingerprint,
        p_expires_at: message.expiresAt,
        p_request_id: reservation.request_id
      }
    );

    let selectedResult = result;
    let receipt = await recordMessage(selectedResult);
    if (!receipt.error && Boolean(receipt.data)) {
      await wait(2_500);
      const refreshedResult = await provider.retrieveLatestCode({
        mailboxEmail,
        encryptedAppPassword: connection.encrypted_app_password
      });
      if (refreshedResult && refreshedResult.messageFingerprint !== selectedResult.messageFingerprint) {
        selectedResult = refreshedResult;
        receipt = await recordMessage(selectedResult);
      }
    }

    if (receipt.error) {
      console.error("VeriFy message receipt failed", {
        category: "configuration_missing",
        provider: provider.id,
        requestId: reservation.request_id,
        latencyMs: elapsedMs(startedAt),
        error: receipt.error.message
      });
      await audit({
        eventType: "mailbox_check_failed",
        outcome: "receipt_failed",
        failureCategory: "configuration_missing"
      });
      return { status: 503, body: { error: "Code retrieval is temporarily unavailable." } };
    }

    const reused = Boolean(receipt.data);
    await audit({
      eventType: reused ? "code_reused" : "code_found",
      outcome: provider.id,
      messageFingerprint: selectedResult.messageFingerprint,
      idempotent: reused
    });
    if (reused) {
      console.info("VeriFy reused mailbox message suppressed", {
        provider: provider.id,
        subscriptionId,
        latencyMs: elapsedMs(startedAt),
        outcome: "waiting_for_new_message"
      });
      return {
        status: 202,
        retryAfter: 60,
        body: {
          status: "pending",
          error: `Still waiting for a new ${provider.displayName} verification code.`
        }
      };
    }
    return {
      status: 200,
      body: {
        status: "ready",
        provider: provider.id,
        code: selectedResult.code,
        receivedAt: selectedResult.receivedAt,
        expiresAt: selectedResult.expiresAt,
        reused: false
      }
    };
  } catch (error) {
    const failureCategory = classifyMailboxConnectionError(error);
    console.error("VeriFy mailbox check failed", {
      category: failureCategory,
      provider: provider.id,
      mailbox: mailboxEmail,
      requestId: reservation.request_id,
      latencyMs: elapsedMs(startedAt),
      error: error instanceof Error ? error.message : "unknown"
    });
    await Promise.all([
      admin
        .from("uniplug_mailbox_credentials")
        .update({
          last_checked_at: checkedAt,
          last_error: failureCategory === "mailbox_authentication_failed" ? "Authentication failed" : "Provider connection failed",
          updated_at: checkedAt
        })
        .eq("mailbox_email", mailboxEmail),
      audit({
        eventType: "mailbox_check_failed",
        outcome: "provider_error",
        failureCategory
      })
    ]);
    return {
      status: 502,
      body: {
        error: `${provider.displayName} email could not be checked. Try again shortly or create a support ticket.`,
        supportUrl: verifySupportUrl(provider.id, failureCategory, service?.name)
      }
    };
  }
}
