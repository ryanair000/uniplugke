"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Link2, MessageCircle } from "lucide-react";

type SubscriptionOption = {
  id: string;
  name: string;
  status: string;
};

type AccessResult = {
  link: string;
  loginUrl: string;
  message: string;
  serviceName: string;
  username: string;
  phone: string | null;
  subscriptionId: string;
};

export function AdminMemberAccess({
  userId,
  status,
  subscriptions
}: {
  userId: string;
  status: string;
  subscriptions: SubscriptionOption[];
}) {
  const [subscriptionId, setSubscriptionId] = useState(subscriptions[0]?.id || "");
  const [result, setResult] = useState<AccessResult | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"message" | "link" | null>(null);
  const selected = useMemo(
    () => subscriptions.find((subscription) => subscription.id === subscriptionId) || subscriptions[0],
    [subscriptionId, subscriptions]
  );
  const canGenerate = ["active", "pending"].includes(status) && Boolean(subscriptionId);

  async function generateAccess() {
    if (!canGenerate) return;
    setBusy(true);
    setNotice("");
    setResult(null);
    setCopied(null);
    try {
      const response = await fetch("/api/admin/member-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, subscriptionId })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "VIP access link could not be created.");
      setResult(body as AccessResult);
      setNotice("Secure client access is ready to share.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "VIP access link could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, target: "message" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      setNotice(target === "message" ? "Client message copied." : "Client access link copied.");
      window.setTimeout(() => setCopied((current) => current === target ? null : current), 1800);
    } catch {
      setNotice("Copy failed. Please allow clipboard access and try again.");
    }
  }

  if (!subscriptions.length) {
    return <span className="status-pill subtle">No VIP subscription</span>;
  }

  const friendlyLink = result ? `Open your ${result.serviceName} on UniPlug: ${result.link}` : "";

  return (
    <div className="admin-member-delivery">
      <div className="admin-member-delivery-toolbar">
        <div className="admin-member-delivery-copy">
          <strong>Client access</strong>
          <span>{selected ? `Send straight to ${selected.name}` : "Choose a service"}</span>
        </div>
        <div className="admin-member-delivery-controls">
          <label className="sr-only" htmlFor={`delivery-subscription-${userId}`}>Subscription to deliver</label>
          <select
            id={`delivery-subscription-${userId}`}
            aria-label="Subscription to deliver"
            value={subscriptionId}
            onChange={(event) => {
              setSubscriptionId(event.target.value);
              setResult(null);
              setNotice("");
              setCopied(null);
            }}
          >
            {subscriptions.map((subscription) => (
              <option key={subscription.id} value={subscription.id}>
                {subscription.name} · {subscription.status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="button button-dark small"
            disabled={!canGenerate || busy}
            onClick={generateAccess}
          >
            {busy ? "Creating…" : result ? "Create new link" : "Create access link"}
          </button>
        </div>
      </div>

      {result ? (
        <div className="admin-delivery-ready">
          <div className="admin-delivery-ready-header">
            <span className="admin-delivery-check" aria-hidden="true"><Check size={15} /></span>
            <div><strong>{result.serviceName} access ready</strong><span>Share the message or the clean one-line access link below.</span></div>
          </div>
          <div className="admin-delivery-actions">
            <button type="button" className="button button-dark small" onClick={() => copy(result.message, "message")}>
              {copied === "message" ? <Check size={15} /> : <MessageCircle size={15} />}
              {copied === "message" ? "Message copied" : "Copy client message"}
            </button>
            <button type="button" className="button button-light small" onClick={() => copy(friendlyLink, "link")}>
              {copied === "link" ? <Check size={15} /> : <Copy size={15} />}
              {copied === "link" ? "Link copied" : "Copy access link"}
            </button>
          </div>
          <div className="admin-delivery-link-preview"><Link2 size={14} /><span>vip.uniplug.shop · secure one-tap sign-in · opens {result.serviceName}</span></div>
        </div>
      ) : null}

      {!canGenerate ? <span className="admin-delivery-helper">Activate this member before creating an access link.</span> : null}
      {notice ? <span className="admin-delivery-notice" aria-live="polite">{notice}</span> : null}
    </div>
  );
}
