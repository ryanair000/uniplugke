import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { getAuthorizedAccessDetails } from "@/lib/client-portal";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const issueReasons = new Set(["incorrect_password", "no_subscription", "household_issue", "many_users_streaming"]);
const issueLabels: Record<string, string> = {
  incorrect_password: "Incorrect Pass",
  no_subscription: "No subscription",
  household_issue: "Household issues",
  many_users_streaming: "Many users streaming"
};

function relatedServiceName(subscription: {
  service_identifier?: string | null;
  service?: { name?: string | null } | Array<{ name?: string | null }> | null;
}) {
  const service = Array.isArray(subscription.service) ? subscription.service[0] : subscription.service;
  return service?.name || subscription.service_identifier || "Digital service";
}

async function alertAdmin({
  admin,
  reason,
  serviceName,
  subscriptionId,
  userId
}: {
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>;
  reason: string;
  serviceName: string;
  subscriptionId: string;
  userId: string;
}) {
  const label = issueLabels[reason] || "Account issue";
  const subject = `Account issue: ${label} — ${serviceName}`.slice(0, 120);
  const message = `${label} was reported from Account not working for ${serviceName}. Subscription: ${subscriptionId}. Please review the assigned account.`;

  const { data: existing } = await admin
    .from("uniplug_support_tickets")
    .select("id")
    .eq("user_id", userId)
    .eq("subject", subject)
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: ticket, error } = await admin
    .from("uniplug_support_tickets")
    .insert({ user_id: userId, subject, message, status: "open" })
    .select("id")
    .single();

  if (error || !ticket) throw new Error(error?.message || "Admin could not be alerted.");
  return ticket.id;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMember();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim().toLowerCase();

  if (!issueReasons.has(reason)) {
    return NextResponse.json({ error: "Choose a valid account issue." }, { status: 400, headers: noStore });
  }
  if (!viewer.profile.clientId) {
    return NextResponse.json({ error: "No tracked subscription was found." }, { status: 404, headers: noStore });
  }

  const admin = createAdminSupabaseClient();
  const supabase = await createServerSupabaseClient();
  if (!admin || !supabase) {
    return NextResponse.json({ error: "Account support is temporarily unavailable." }, { status: 503, headers: noStore });
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from("client_subscriptions")
    .select("id,status,service_identifier,service:client_services!client_subscriptions_service_id_fkey(name)")
    .eq("id", id)
    .eq("client_id", viewer.profile.clientId)
    .maybeSingle();

  if (subscriptionError || !subscription) {
    return NextResponse.json({ error: "This subscription could not be found." }, { status: 404, headers: noStore });
  }

  const serviceName = relatedServiceName(subscription as Parameters<typeof relatedServiceName>[0]);

  if (reason !== "household_issue") {
    try {
      const ticketId = await alertAdmin({ admin, reason, serviceName, subscriptionId: id, userId: viewer.user.id });
      return NextResponse.json({
        status: "admin_alerted",
        ticketId,
        message: "Admin has been alerted and will review this account."
      }, { headers: noStore });
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "Admin could not be alerted."
      }, { status: 500, headers: noStore });
    }
  }

  if (!serviceName.toLowerCase().includes("netflix")) {
    return NextResponse.json({ error: "Household issues are only available for Netflix subscriptions." }, { status: 400, headers: noStore });
  }
  if (!["active", "due_soon", "trial"].includes(subscription.status)) {
    return NextResponse.json({ error: "This Netflix subscription is not active." }, { status: 409, headers: noStore });
  }

  const now = new Date().toISOString();
  const { data: approval, error: approvalLookupError } = await admin
    .from("uniplug_replacement_approvals")
    .select("id,status")
    .eq("client_subscription_id", id)
    .eq("user_id", viewer.user.id)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (approvalLookupError) {
    return NextResponse.json({ error: "A new Netflix slot could not be prepared." }, { status: 500, headers: noStore });
  }

  if (approval?.id) {
    const { error } = await admin
      .from("uniplug_replacement_approvals")
      .update({
        reason: "household_issue",
        service_name: serviceName,
        status: "approved",
        admin_note: "Automatically approved for Netflix Household issue.",
        reviewed_at: now,
        updated_at: now
      })
      .eq("id", approval.id);
    if (error) return NextResponse.json({ error: "A new Netflix slot could not be prepared." }, { status: 500, headers: noStore });
  } else {
    const { error } = await admin.from("uniplug_replacement_approvals").insert({
      client_subscription_id: id,
      client_id: viewer.profile.clientId,
      user_id: viewer.user.id,
      service_name: serviceName,
      reason: "household_issue",
      status: "approved",
      admin_note: "Automatically approved for Netflix Household issue.",
      reviewed_at: now,
      updated_at: now
    });
    if (error) return NextResponse.json({ error: "A new Netflix slot could not be prepared." }, { status: 500, headers: noStore });
  }

  const { data, error } = await supabase.rpc("uniplug_replace_client_account", {
    p_client_subscription_id: id,
    p_reason: "household_issue"
  });

  await admin.from("uniplug_household_events").insert({
    user_id: viewer.user.id,
    client_subscription_id: id,
    event_type: "replacement_requested",
    outcome: error ? "failed" : (data?.status || "unknown")
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400, headers: noStore });
  }

  if (data?.status !== "completed") {
    try {
      await alertAdmin({ admin, reason, serviceName, subscriptionId: id, userId: viewer.user.id });
    } catch {
      // The replacement result remains the primary response even if ticket creation fails.
    }
    return NextResponse.json({
      status: data?.status || "no_inventory",
      error: "No replacement slot is available right now. Admin has been alerted."
    }, { status: 409, headers: noStore });
  }

  const access = await getAuthorizedAccessDetails(viewer.user.id, id);
  if ("error" in access) {
    return NextResponse.json({
      status: "completed",
      message: "New slot assigned. Refresh this page to load the new login details."
    }, { headers: noStore });
  }

  return NextResponse.json({
    status: "completed",
    details: access.details,
    message: "New slot assigned. Please log in using the new slot details shown above."
  }, { headers: noStore });
}
