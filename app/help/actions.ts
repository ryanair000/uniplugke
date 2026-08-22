"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const supportCategories = new Set(["login", "service", "verification", "billing", "account", "other"]);
const supportMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const TICKET_WINDOW_MS = 10 * 60 * 1000;
const TICKET_WINDOW_LIMIT = 5;
const REPLY_WINDOW_MS = 60 * 1000;
const REPLY_WINDOW_LIMIT = 8;

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;
type SupportFile = File & { size: number; type: string; name: string };

function getAttachment(entry: FormDataEntryValue | null) {
  if (!entry || typeof entry === "string" || entry.size === 0) return null;
  const file = entry as SupportFile;
  if (file.size > MAX_ATTACHMENT_SIZE || !supportMimeTypes.has(file.type)) return "invalid" as const;
  return file;
}

async function hasValidImageSignature(file: SupportFile) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (file.type === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function cleanFileName(value: string) {
  const safe = value.replace(/[\\/\u0000-\u001f]+/g, "-").trim().slice(0, 180);
  return safe || "screenshot";
}

async function uploadAttachment({
  supabase,
  file,
  ticketId,
  messageId,
  userId
}: {
  supabase: SupabaseClient;
  file: SupportFile | null;
  ticketId: string;
  messageId: string;
  userId: string;
}) {
  if (!file) return true;
  const extension = supportMimeTypes.get(file.type) || "bin";
  const storagePath = `${ticketId}/${randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("uniplug-support")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return false;

  const { error: recordError } = await supabase.from("uniplug_support_attachments").insert({
    ticket_id: ticketId,
    message_id: messageId,
    uploaded_by: userId,
    storage_path: storagePath,
    file_name: cleanFileName(file.name),
    mime_type: file.type,
    file_size: file.size
  });
  if (recordError) {
    await supabase.storage.from("uniplug-support").remove([storagePath]);
    return false;
  }
  return true;
}

async function resolveSupportContext(
  supabase: SupabaseClient,
  viewer: Awaited<ReturnType<typeof requireMember>>,
  formData: FormData
) {
  const rawContext = String(formData.get("subscriptionContext") || "");
  const fallbackService = String(formData.get("serviceName") || "").trim().slice(0, 120) || null;
  const rawOrderId = String(formData.get("orderId") || "");
  const [source, subscriptionId] = rawContext.split(":", 2);

  let resolvedSubscriptionId: string | null = null;
  let subscriptionSource: "member" | "tracked" | null = null;
  let serviceName = fallbackService;

  if (uuidPattern.test(subscriptionId || "") && source === "tracked" && viewer.profile.clientId) {
    const { data } = await supabase
      .from("client_subscriptions")
      .select("id,service:client_services!client_subscriptions_service_id_fkey(name)")
      .eq("id", subscriptionId)
      .eq("client_id", viewer.profile.clientId)
      .maybeSingle();
    if (data) {
      const service = Array.isArray(data.service) ? data.service[0] : data.service;
      resolvedSubscriptionId = subscriptionId;
      subscriptionSource = "tracked";
      serviceName = service?.name ? String(service.name).slice(0, 120) : serviceName;
    }
  }

  if (uuidPattern.test(subscriptionId || "") && source === "member") {
    const { data } = await supabase
      .from("uniplug_member_subscriptions")
      .select("id,service:uniplug_catalog_services(name)")
      .eq("id", subscriptionId)
      .eq("user_id", viewer.user.id)
      .maybeSingle();
    if (data) {
      const service = Array.isArray(data.service) ? data.service[0] : data.service;
      resolvedSubscriptionId = subscriptionId;
      subscriptionSource = "member";
      serviceName = service?.name ? String(service.name).slice(0, 120) : serviceName;
    }
  }

  let orderId: string | null = null;
  let orderNumber: string | null = null;
  if (uuidPattern.test(rawOrderId)) {
    const { data: order } = await supabase
      .from("uniplug_member_orders")
      .select("id,order_number")
      .eq("id", rawOrderId)
      .eq("user_id", viewer.user.id)
      .maybeSingle();
    if (order) {
      orderId = order.id;
      orderNumber = String(order.order_number || "").slice(0, 80) || null;
      if (!serviceName) {
        const { data: orderItem } = await supabase
          .from("uniplug_member_order_items")
          .select("service_name")
          .eq("order_id", order.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        serviceName = orderItem?.service_name ? String(orderItem.service_name).slice(0, 120) : null;
      }
    }
  }

  return {
    subscriptionId: resolvedSubscriptionId,
    subscriptionSource,
    serviceName,
    orderId,
    orderNumber
  };
}

export async function createSupportTicket(formData: FormData) {
  const viewer = await requireMember();
  const subject = String(formData.get("subject") || "").trim().slice(0, 120);
  const message = String(formData.get("message") || "").trim().slice(0, 4000);
  const requestedCategory = String(formData.get("category") || "other");
  const category = supportCategories.has(requestedCategory) ? requestedCategory : "other";
  const returnTo = String(formData.get("returnTo") || "") === "/dashboard/support" ? "/dashboard/support" : "/help";
  const attachment = getAttachment(formData.get("attachment"));
  if (subject.length < 3 || message.length < 10) redirect(`${returnTo}?error=invalid_ticket`);
  if (attachment === "invalid" || (attachment && !(await hasValidImageSignature(attachment)))) {
    redirect(`${returnTo}?error=invalid_attachment`);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`${returnTo}?error=not_configured`);

  const { count: recentTickets } = await supabase
    .from("uniplug_support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.user.id)
    .gte("created_at", new Date(Date.now() - TICKET_WINDOW_MS).toISOString());
  if ((recentTickets || 0) >= TICKET_WINDOW_LIMIT) redirect(`${returnTo}?error=rate_limited`);

  const context = await resolveSupportContext(supabase, viewer, formData);
  const { data: ticket, error: ticketError } = await supabase
    .from("uniplug_support_tickets")
    .insert({
      user_id: viewer.user.id,
      subject,
      message: message.slice(0, 2000),
      category,
      service_name: context.serviceName,
      subscription_id: context.subscriptionId,
      subscription_source: context.subscriptionSource,
      order_id: context.orderId,
      order_number: context.orderNumber
    })
    .select("id")
    .single();
  if (ticketError || !ticket) redirect(`${returnTo}?error=ticket_failed`);

  const { data: firstMessage, error: messageError } = await supabase
    .from("uniplug_support_messages")
    .insert({
      ticket_id: ticket.id,
      sender_id: viewer.user.id,
      sender_role: "member",
      body: message
    })
    .select("id")
    .single();
  if (messageError || !firstMessage) redirect(`${returnTo}?error=message_failed`);

  const attachmentSaved = await uploadAttachment({
    supabase,
    file: attachment,
    ticketId: ticket.id,
    messageId: firstMessage.id,
    userId: viewer.user.id
  });

  revalidatePath("/help");
  revalidatePath("/dashboard/support");
  revalidatePath("/dashboard/notifications");
  revalidatePath("/admin/support");
  revalidatePath("/admin/requests");

  if (returnTo === "/dashboard/support") {
    redirect(`/dashboard/support/${ticket.id}?success=ticket_created${attachmentSaved ? "" : "&warning=attachment_failed"}`);
  }
  redirect(`${returnTo}?success=ticket_created${attachmentSaved ? "" : "&warning=attachment_failed"}`);
}

export async function replySupportTicket(formData: FormData) {
  const viewer = await requireMember();
  const ticketId = String(formData.get("ticketId") || "");
  const message = String(formData.get("message") || "").trim().slice(0, 4000);
  const attachment = getAttachment(formData.get("attachment"));
  if (!uuidPattern.test(ticketId) || message.length < 1) redirect("/dashboard/support?error=invalid_reply");
  if (attachment === "invalid" || (attachment && !(await hasValidImageSignature(attachment)))) {
    redirect(`/dashboard/support/${ticketId}?error=invalid_attachment`);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`/dashboard/support/${ticketId}?error=not_configured`);
  const { data: ticket } = await supabase
    .from("uniplug_support_tickets")
    .select("id")
    .eq("id", ticketId)
    .eq("user_id", viewer.user.id)
    .maybeSingle();
  if (!ticket) redirect("/dashboard/support?error=ticket_not_found");

  const { count: recentReplies } = await supabase
    .from("uniplug_support_messages")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticketId)
    .eq("sender_id", viewer.user.id)
    .gte("created_at", new Date(Date.now() - REPLY_WINDOW_MS).toISOString());
  if ((recentReplies || 0) >= REPLY_WINDOW_LIMIT) redirect(`/dashboard/support/${ticketId}?error=rate_limited`);

  const { data: reply, error } = await supabase
    .from("uniplug_support_messages")
    .insert({
      ticket_id: ticketId,
      sender_id: viewer.user.id,
      sender_role: "member",
      body: message
    })
    .select("id")
    .single();
  if (error || !reply) redirect(`/dashboard/support/${ticketId}?error=reply_failed`);

  const attachmentSaved = await uploadAttachment({
    supabase,
    file: attachment,
    ticketId,
    messageId: reply.id,
    userId: viewer.user.id
  });

  revalidatePath(`/dashboard/support/${ticketId}`);
  revalidatePath("/dashboard/support");
  revalidatePath("/admin/support");
  redirect(`/dashboard/support/${ticketId}?success=reply_sent${attachmentSaved ? "" : "&warning=attachment_failed"}`);
}
