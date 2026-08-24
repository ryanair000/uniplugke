"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  classifyMailboxConnectionError,
  encryptMailboxSecret,
  testMailboxConnection
} from "@/lib/gmail";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { recordVerifyAdminEvent } from "@/lib/verify-operations";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mailboxEmail(value: FormDataEntryValue | null) {
  const email = String(value || "").trim().toLowerCase();
  if (!emailPattern.test(email) || email.length > 254) throw new Error("A valid mailbox email is required.");
  return email;
}

function refreshVerifyOperations() {
  revalidatePath("/admin");
  revalidatePath("/admin/mailboxes");
  revalidatePath("/admin/slots");
  revalidatePath("/tools/verify");
  revalidatePath("/dashboard/subscriptions");
}

export async function testVerifyMailbox(formData: FormData) {
  const viewer = await requireAdmin();
  const email = mailboxEmail(formData.get("mailboxEmail"));
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");
  const { data: credential, error: credentialError } = await admin
    .from("uniplug_mailbox_credentials")
    .select("encrypted_app_password")
    .eq("mailbox_email", email)
    .maybeSingle();
  if (credentialError) throw new Error(credentialError.message);
  if (!credential) redirect("/admin/mailboxes?view=accounts&error=mailbox_not_connected");

  let destination = "/admin/mailboxes?view=accounts&success=connection_tested";
  const checkedAt = new Date().toISOString();
  try {
    const result = await testMailboxConnection({ mailboxEmail: email, encryptedAppPassword: credential.encrypted_app_password });
    const { error } = await admin.from("uniplug_mailbox_credentials").update({
      last_checked_at: checkedAt,
      last_error: null,
      updated_at: checkedAt
    }).eq("mailbox_email", email);
    if (error) throw error;
    await recordVerifyAdminEvent({
      admin,
      actorUserId: viewer.user.id,
      action: "mailbox_connection_tested",
      outcome: "success",
      mailboxEmail: email,
      metadata: { latencyMs: result.latencyMs }
    });
  } catch (error) {
    const failureCategory = classifyMailboxConnectionError(error);
    const safeError = failureCategory === "mailbox_authentication_failed" ? "Authentication failed" : "Provider connection failed";
    await admin.from("uniplug_mailbox_credentials").update({
      last_checked_at: checkedAt,
      last_error: safeError,
      updated_at: checkedAt
    }).eq("mailbox_email", email);
    await recordVerifyAdminEvent({
      admin,
      actorUserId: viewer.user.id,
      action: "mailbox_connection_tested",
      outcome: "failed",
      failureCategory,
      mailboxEmail: email
    });
    destination = `/admin/mailboxes?view=accounts&error=${failureCategory}`;
  }
  refreshVerifyOperations();
  redirect(destination);
}

export async function rotateVerifyMailboxCredential(formData: FormData) {
  const viewer = await requireAdmin();
  const email = mailboxEmail(formData.get("mailboxEmail"));
  const appPassword = String(formData.get("appPassword") || "").replace(/\s/g, "");
  if (!/^[a-z0-9]{16}$/i.test(appPassword)) redirect("/admin/mailboxes?view=accounts&error=invalid_app_password");
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");

  const encryptedAppPassword = encryptMailboxSecret(appPassword);
  let destination = "/admin/mailboxes?view=accounts&success=credential_rotated";
  try {
    const test = await testMailboxConnection({ mailboxEmail: email, encryptedAppPassword });
    const changedAt = new Date().toISOString();
    const { error } = await admin.from("uniplug_mailbox_credentials").upsert({
      mailbox_email: email,
      provider: "gmail",
      encrypted_app_password: encryptedAppPassword,
      connected_at: changedAt,
      last_checked_at: changedAt,
      last_error: null,
      updated_at: changedAt
    }, { onConflict: "mailbox_email" });
    if (error) throw error;
    await recordVerifyAdminEvent({
      admin,
      actorUserId: viewer.user.id,
      action: "mailbox_credentials_rotated",
      outcome: "success",
      mailboxEmail: email,
      metadata: { connectionTested: true, latencyMs: test.latencyMs }
    });
  } catch (error) {
    const failureCategory = classifyMailboxConnectionError(error);
    await recordVerifyAdminEvent({
      admin,
      actorUserId: viewer.user.id,
      action: "mailbox_credentials_rotated",
      outcome: "rejected",
      failureCategory,
      mailboxEmail: email,
      metadata: { existingCredentialPreserved: true }
    });
    destination = `/admin/mailboxes?view=accounts&error=${failureCategory}`;
  }
  refreshVerifyOperations();
  redirect(destination);
}

export async function revokeVerifyMailboxCredential(formData: FormData) {
  const viewer = await requireAdmin();
  const email = mailboxEmail(formData.get("mailboxEmail"));
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");
  const { error } = await admin.from("uniplug_mailbox_credentials").delete().eq("mailbox_email", email);
  if (error) throw new Error(error.message);
  await recordVerifyAdminEvent({
    admin,
    actorUserId: viewer.user.id,
    action: "mailbox_credentials_revoked",
    outcome: "success",
    mailboxEmail: email
  });
  refreshVerifyOperations();
  redirect("/admin/mailboxes?view=accounts&success=credential_revoked");
}

export async function updateVerifyAccountCredentials(formData: FormData) {
  const viewer = await requireAdmin();
  const accountId = String(formData.get("accountId") || "");
  const email = mailboxEmail(formData.get("accountEmail"));
  const accountPassword = String(formData.get("accountPassword") || "");
  const profileName = String(formData.get("profileName") || "").trim().slice(0, 120);
  const profilePin = String(formData.get("profilePin") || "").trim().slice(0, 64);
  if (!uuidPattern.test(accountId)) throw new Error("A valid service account is required.");
  if (accountPassword.length > 512) throw new Error("Account password is too long.");

  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");
  const { error } = await admin.rpc("uniplug_admin_update_account_credentials", {
    p_account_id: accountId,
    p_account_email: email,
    p_account_password: accountPassword || null,
    p_profile_name: profileName || null,
    p_profile_pin: profilePin || null
  });
  if (error) throw new Error(error.message);

  await recordVerifyAdminEvent({
    admin,
    actorUserId: viewer.user.id,
    action: "service_account_credentials_updated",
    outcome: "success",
    mailboxEmail: email,
    metadata: { accountId, passwordChanged: Boolean(accountPassword), profileUpdated: Boolean(profileName || profilePin) }
  });
  refreshVerifyOperations();
  redirect("/admin/mailboxes?view=accounts&success=account_updated");
}

export async function setSubscriptionVerifyEnabled(formData: FormData) {
  const viewer = await requireAdmin();
  const subscriptionId = String(formData.get("subscriptionId") || "");
  const enabled = String(formData.get("enabled") || "") === "true";
  const reason = String(formData.get("reason") || "").trim().slice(0, 160);
  if (!uuidPattern.test(subscriptionId)) throw new Error("A valid subscription is required.");
  if (!enabled && reason.length < 3) redirect("/admin/mailboxes?view=assignments&error=disable_reason_required");
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");
  const { data: subscription, error: subscriptionError } = await admin
    .from("client_subscriptions")
    .select("id,service:client_services!client_subscriptions_service_id_fkey(verify_enabled,verify_provider)")
    .eq("id", subscriptionId)
    .maybeSingle();
  const service = Array.isArray(subscription?.service) ? subscription.service[0] : subscription?.service;
  if (subscriptionError || !subscription || !service?.verify_enabled || !service.verify_provider) {
    redirect("/admin/mailboxes?view=assignments&error=subscription_not_supported");
  }
  const changedAt = new Date().toISOString();
  const { error } = await admin.from("client_subscriptions").update({
    verify_enabled: enabled,
    verify_updated_at: changedAt,
    updated_at: changedAt
  }).eq("id", subscriptionId);
  if (error) throw new Error(error.message);
  await recordVerifyAdminEvent({
    admin,
    actorUserId: viewer.user.id,
    action: enabled ? "subscription_enabled" : "subscription_disabled",
    outcome: "success",
    provider: service.verify_provider,
    subscriptionId,
    metadata: { reason: reason || null }
  });
  refreshVerifyOperations();
  redirect(`/admin/mailboxes?view=assignments&success=subscription_${enabled ? "enabled" : "disabled"}`);
}

export async function setVerifyAlertStatus(formData: FormData) {
  const viewer = await requireAdmin();
  const alertId = String(formData.get("alertId") || "");
  const status = String(formData.get("status") || "");
  if (!uuidPattern.test(alertId) || !["open", "resolved"].includes(status)) throw new Error("A valid alert action is required.");
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");
  const { data: alert, error: alertError } = await admin
    .from("uniplug_verify_alerts")
    .select("id,provider,mailbox_email,client_subscription_id")
    .eq("id", alertId)
    .maybeSingle();
  if (alertError || !alert) throw new Error(alertError?.message || "Alert not found.");
  const resolved = status === "resolved";
  const changedAt = new Date().toISOString();
  const { error } = await admin.from("uniplug_verify_alerts").update({
    status,
    resolved_at: resolved ? changedAt : null,
    resolved_by: resolved ? viewer.user.id : null,
    updated_at: changedAt
  }).eq("id", alertId);
  if (error) throw new Error(error.message);
  await recordVerifyAdminEvent({
    admin,
    actorUserId: viewer.user.id,
    action: resolved ? "alert_resolved" : "alert_reopened",
    outcome: "success",
    provider: alert.provider,
    mailboxEmail: alert.mailbox_email,
    subscriptionId: alert.client_subscription_id
  });
  refreshVerifyOperations();
  redirect(`/admin/mailboxes?view=alerts&success=alert_${status}`);
}
