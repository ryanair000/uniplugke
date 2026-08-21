"use client";

import { useEffect, useState } from "react";

type SubscriptionOption = { id: string; name: string; status: string };
type AccessDetails = {
  serviceName: string;
  accountEmail: string;
  accountPassword: string;
  profileName: string;
  profilePin: string;
};

const emptyDetails: AccessDetails = {
  serviceName: "Digital service",
  accountEmail: "",
  accountPassword: "",
  profileName: "",
  profilePin: ""
};

export function AdminMemberServiceAccess({
  subscriptions
}: {
  subscriptions: SubscriptionOption[];
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState(subscriptions[0]?.id || "");
  const [details, setDetails] = useState<AccessDetails>(emptyDetails);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!panelOpen || !subscriptionId) return;
    let active = true;
    setBusy(true);
    setNotice("");
    fetch(`/api/admin/member-service-access?subscriptionId=${encodeURIComponent(subscriptionId)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Service details could not be loaded.");
        if (active) setDetails({ ...emptyDetails, ...body });
      })
      .catch((error) => active && setNotice(error instanceof Error ? error.message : "Service details could not be loaded."))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [panelOpen, subscriptionId]);

  async function save() {
    if (!subscriptionId || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/member-service-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId, ...details })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Service access details could not be saved.");
      setNotice("Service access details saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Service access details could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setNotice("Copy failed. Please allow clipboard access and try again.");
    }
  }

  if (!subscriptions.length) return null;

  return (
    <details
      className="admin-member-service-access"
      style={{ marginTop: 8 }}
      onToggle={(event) => setPanelOpen(event.currentTarget.open)}
    >
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>Service account details</summary>
      <div style={{ display: "grid", gap: 10, marginTop: 10, maxWidth: 620 }}>
        <label>
          <span className="sr-only">Service</span>
          <select
            aria-label="Service to edit"
            value={subscriptionId}
            onChange={(event) => {
              setSubscriptionId(event.target.value);
              setDetails(emptyDetails);
              setShowPassword(false);
              setShowPin(false);
            }}
          >
            {subscriptions.map((subscription) => (
              <option key={subscription.id} value={subscription.id}>
                {subscription.name} · {subscription.status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>

        {busy && !details.accountEmail && !details.accountPassword && !details.profileName && !details.profilePin ? (
          <span>Loading protected service details…</span>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Service account mail</span>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={details.accountEmail} onChange={(event) => setDetails((current) => ({ ...current, accountEmail: event.target.value }))} placeholder="account@example.com" autoComplete="off" />
                <button type="button" className="button button-light small" onClick={() => copy(details.accountEmail, "Account mail")} disabled={!details.accountEmail}>Copy</button>
              </div>
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span>Service account pass</span>
              <div style={{ display: "flex", gap: 6 }}>
                <input type={showPassword ? "text" : "password"} value={details.accountPassword} onChange={(event) => setDetails((current) => ({ ...current, accountPassword: event.target.value }))} placeholder="Service password" autoComplete="new-password" />
                <button type="button" className="button button-light small" onClick={() => setShowPassword((value) => !value)} disabled={!details.accountPassword}>{showPassword ? "Hide" : "Show"}</button>
                <button type="button" className="button button-light small" onClick={() => copy(details.accountPassword, "Password")} disabled={!details.accountPassword}>Copy</button>
              </div>
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span>Profile</span>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={details.profileName} onChange={(event) => setDetails((current) => ({ ...current, profileName: event.target.value }))} placeholder="e.g. Ryan" autoComplete="off" />
                <button type="button" className="button button-light small" onClick={() => copy(details.profileName, "Profile")} disabled={!details.profileName}>Copy</button>
              </div>
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span>Profile PIN</span>
              <div style={{ display: "flex", gap: 6 }}>
                <input type={showPin ? "text" : "password"} value={details.profilePin} onChange={(event) => setDetails((current) => ({ ...current, profilePin: event.target.value }))} placeholder="Profile PIN" inputMode="numeric" autoComplete="off" />
                <button type="button" className="button button-light small" onClick={() => setShowPin((value) => !value)} disabled={!details.profilePin}>{showPin ? "Hide" : "Show"}</button>
                <button type="button" className="button button-light small" onClick={() => copy(details.profilePin, "Profile PIN")} disabled={!details.profilePin}>Copy</button>
              </div>
            </label>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="button button-dark small" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save service details"}</button>
          <span style={{ fontSize: 12 }}>Stored per member + service. Password and PIN stay outside public profile data.</span>
        </div>
        {notice ? <span aria-live="polite">{notice}</span> : null}
      </div>
    </details>
  );
}
