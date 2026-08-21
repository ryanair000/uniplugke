"use client";

import { useMemo, useState } from "react";

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
    try {
      const response = await fetch("/api/admin/member-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, subscriptionId })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "VIP access link could not be created.");
      setResult(body as AccessResult);
      setNotice("Secure VIP access ready.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "VIP access link could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setNotice("Copy failed. Please allow clipboard access and try again.");
    }
  }

  if (!subscriptions.length) {
    return <span className="status-pill subtle">No VIP subscription</span>;
  }

  return (
    <div className="admin-member-delivery" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label className="sr-only" htmlFor={`delivery-subscription-${userId}`}>Subscription to deliver</label>
        <select
          id={`delivery-subscription-${userId}`}
          aria-label="Subscription to deliver"
          value={subscriptionId}
          onChange={(event) => {
            setSubscriptionId(event.target.value);
            setResult(null);
            setNotice("");
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
          {busy ? "Generating…" : "Generate VIP link"}
        </button>
      </div>

      {result ? (
        <div style={{ display: "grid", gap: 8 }}>
          <span className="status-pill status-active">VIP access ready · {result.serviceName}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="button button-light small" onClick={() => copy(result.link, "VIP link")}>Copy VIP link</button>
            <button type="button" className="button button-light small" onClick={() => copy(result.message, "Welcome + login details")}>Copy welcome + details</button>
          </div>
        </div>
      ) : null}

      {!canGenerate ? <span>Activate this member before generating a link.</span> : null}
      {notice ? <span aria-live="polite">{notice}</span> : null}
      {selected && !result ? <span>Delivery target: {selected.name}</span> : null}
    </div>
  );
}
