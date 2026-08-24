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
  portalLink: string;
  portalMessage: string;
  serviceLink: string;
  serviceMessage: string;
  serviceName: string;
  username: string;
  phone: string | null;
  subscriptionId: string;
  expiresAt: string;
  maxUses: number;
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
  const [copied, setCopied] = useState<"portalMessage" | "portalLink" | "serviceMessage" | "serviceLink" | null>(null);
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
      setNotice("Portal and service links are ready to share.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "VIP access link could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(
    value: string,
    target: "portalMessage" | "portalLink" | "serviceMessage" | "serviceLink"
  ) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      setNotice(target.endsWith("Message") ? "Short message copied." : "Access link copied.");
      window.setTimeout(() => setCopied((current) => current === target ? null : current), 1800);
    } catch {
      setNotice("Copy failed. Please allow clipboard access and try again.");
    }
  }

  if (!subscriptions.length) {
    return <span className="status-pill subtle">No VIP subscription</span>;
  }

  return (
    <div className="admin-member-delivery">
      <div className="admin-member-delivery-toolbar">
        <div className="admin-member-delivery-copy">
          <strong>Client access</strong>
          <span>{selected
            ? `Open ${selected.name} access`
            : "Choose a service"}</span>
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
            {busy ? "Creating…" : result ? "Refresh links" : "Create links"}
          </button>
        </div>
      </div>

      {result ? (
        <div className="admin-delivery-ready">
          <div className="admin-delivery-ready-header">
            <span className="admin-delivery-check" aria-hidden="true"><Check size={15} /></span>
            <div>
              <strong>Client links ready</strong>
              <span>{`Portal overview + direct ${result.serviceName} access · Valid for 48 hours · up to ${result.maxUses} opens`}</span>
            </div>
          </div>
          <div className="admin-delivery-choice">
            <div className="admin-delivery-choice-heading">
              <strong>All client services</strong>
              <span>Opens the services overview</span>
            </div>
            <div className="admin-delivery-actions">
              <button type="button" className="button button-dark small" onClick={() => copy(result.portalMessage, "portalMessage")}>
                {copied === "portalMessage" ? <Check size={15} /> : <MessageCircle size={15} />}
                {copied === "portalMessage" ? "Message copied" : "Copy portal message"}
              </button>
              <button type="button" className="button button-light small" onClick={() => copy(result.portalLink, "portalLink")}>
                {copied === "portalLink" ? <Check size={15} /> : <Copy size={15} />}
                {copied === "portalLink" ? "Link copied" : "Get portal link"}
              </button>
            </div>
            <div className="admin-delivery-link-preview"><Link2 size={14} /><span>{result.portalLink}</span></div>
          </div>
          <div className="admin-delivery-choice">
            <div className="admin-delivery-choice-heading">
              <strong>{result.serviceName}</strong>
              <span>Opens this exact service access page</span>
            </div>
            <div className="admin-delivery-actions">
              <button type="button" className="button button-dark small" onClick={() => copy(result.serviceMessage, "serviceMessage")}>
                {copied === "serviceMessage" ? <Check size={15} /> : <MessageCircle size={15} />}
                {copied === "serviceMessage" ? "Message copied" : "Copy service message"}
              </button>
              <button type="button" className="button button-light small" onClick={() => copy(result.serviceLink, "serviceLink")}>
                {copied === "serviceLink" ? <Check size={15} /> : <Copy size={15} />}
                {copied === "serviceLink" ? "Link copied" : "Get service link"}
              </button>
            </div>
            <div className="admin-delivery-link-preview"><Link2 size={14} /><span>{result.serviceLink}</span></div>
          </div>
          <span className="admin-delivery-helper">
            Expires {new Date(result.expiresAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}. Both destinations share this private access grant.
          </span>
        </div>
      ) : null}

      {!canGenerate ? <span className="admin-delivery-helper">Activate this member before creating an access link.</span> : null}
      {notice ? <span className="admin-delivery-notice" aria-live="polite">{notice}</span> : null}
    </div>
  );
}
