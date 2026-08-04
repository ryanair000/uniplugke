"use client";

import { useState } from "react";

type AccessDetails = {
  serviceName: string;
  accountEmail: string;
  accountPassword: string;
  verificationCode: string | null;
};

export function AccountAccess({ subscriptionId, canReplace = true }: { subscriptionId: string; canReplace?: boolean }) {
  const [details, setDetails] = useState<AccessDetails | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"reveal" | "replace" | null>(null);

  async function reveal() {
    setBusy("reveal"); setMessage("");
    try {
      const response = await fetch(`/api/portal/subscriptions/${subscriptionId}/access`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Access details could not be loaded.");
      setDetails(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access details could not be loaded.");
    } finally { setBusy(null); }
  }

  async function replace() {
    if (!window.confirm("Replace this account now? Your previous credentials will stop being shown here.")) return;
    setBusy("replace"); setMessage(""); setDetails(null);
    try {
      const response = await fetch(`/api/portal/subscriptions/${subscriptionId}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Account reported not working from client dashboard" })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Replacement could not be completed.");
      if (body.details) setDetails(body.details);
      setMessage("Replacement completed. Your new access details are ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Replacement could not be completed.");
    } finally { setBusy(null); }
  }

  return (
    <section className="panel account-access-card">
      <p className="eyebrow">Secure access</p>
      <h2>Account details</h2>
      <p>Credentials are loaded only when requested and are never stored in your browser.</p>
      <div className="account-access-actions">
        <button className="button button-dark" type="button" onClick={reveal} disabled={Boolean(busy)}>
          {busy === "reveal" ? "Loading…" : "Reveal access details"}
        </button>
        {canReplace ? (
          <button className="button button-danger" type="button" onClick={replace} disabled={Boolean(busy)}>
            {busy === "replace" ? "Replacing…" : "Account not working — replace now"}
          </button>
        ) : null}
      </div>
      {message ? <p className={message.includes("completed") ? "form-success" : "form-error"}>{message}</p> : null}
      {details ? (
        <dl className="credential-preview credential-details">
          <div><dt>Service</dt><dd>{details.serviceName}</dd></div>
          <div><dt>Account email</dt><dd>{details.accountEmail}</dd></div>
          <div><dt>Password</dt><dd>{details.accountPassword}</dd></div>
          {details.verificationCode ? <div><dt>Verification code</dt><dd>{details.verificationCode}</dd></div> : null}
        </dl>
      ) : null}
    </section>
  );
}
