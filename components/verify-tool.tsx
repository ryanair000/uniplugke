"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type VerifySubscription = {
  id: string;
  name: string;
  status: string;
  provider: string;
  providerName: string;
  providerMark: string;
  instructions: Array<{ title: string; detail: string }>;
};

type CodeResult = {
  code: string;
  expiresAt: string;
  receivedAt: string;
  provider: string;
  reused?: boolean;
};

function readableStatus(status: string) {
  if (status === "due_soon") return "Renewal due soon";
  return status.replaceAll("_", " ");
}

function VerifyCard({ subscription }: { subscription: VerifySubscription }) {
  const [busy, setBusy] = useState<"code" | "household" | null>(null);
  const [message, setMessage] = useState("");
  const [supportUrl, setSupportUrl] = useState("");
  const [result, setResult] = useState<CodeResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!result) return;
    const update = () => {
      const remaining = Math.max(0, Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setResult(null);
        setMessage(`That code expired. Request a new message from ${subscription.providerName}, then check again.`);
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [result, subscription.providerName]);

  async function getLatestCode() {
    setBusy("code");
    setMessage("");
    setSupportUrl("");
    setResult(null);
    try {
      const response = await fetch("/api/tools/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: subscription.id }),
        cache: "no-store"
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSupportUrl(typeof body.supportUrl === "string" ? body.supportUrl : "");
        throw new Error(body.error || `No current ${subscription.providerName} code was found.`);
      }
      setResult(body as CodeResult);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `No current ${subscription.providerName} code was found.`);
    } finally {
      setBusy(null);
    }
  }

  async function approveHouseholdUpdate() {
    setBusy("household");
    setMessage("");
    setSupportUrl("");
    setResult(null);
    try {
      const response = await fetch("/api/tools/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: subscription.id, action: "household_update" }),
        cache: "no-store"
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSupportUrl(typeof body.supportUrl === "string" ? body.supportUrl : "");
        throw new Error(body.error || "No current Netflix Household update request was found.");
      }
      setMessage(body.reused ? "That Netflix Household request was already approved." : "Netflix Household update approved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Netflix Household update could not be approved.");
    } finally {
      setBusy(null);
    }
  }

  async function copyCode() {
    if (!result) return;
    await navigator.clipboard.writeText(result.code);
    setMessage("Code copied.");
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <article className="verify-service-card">
      <header>
        <span className="verify-provider-mark" aria-hidden="true">{subscription.providerMark}</span>
        <div>
          <span className={`wallet-status status-${subscription.status}`}><i />{readableStatus(subscription.status)}</span>
          <h2>{subscription.name}</h2>
          <p>{subscription.providerName} temporary code assistant</p>
        </div>
      </header>

      <ol className="verify-steps">
        {subscription.instructions.map((instruction) => (
          <li key={instruction.title}><b>{instruction.title}</b><span>{instruction.detail}</span></li>
        ))}
      </ol>

      <div className="verify-actions">
        <button className="button wallet-primary-button verify-action" type="button" onClick={getLatestCode} disabled={Boolean(busy)}>
          {busy === "code" ? `Checking ${subscription.providerName} email...` : result ? "Check again" : "Get latest code"}
        </button>
        {subscription.provider === "netflix" ? (
          <button className="button wallet-secondary-button verify-action" type="button" onClick={approveHouseholdUpdate} disabled={Boolean(busy)}>
            {busy === "household" ? "Approving Household update..." : "Approve Household update"}
          </button>
        ) : null}
      </div>

      {result ? (
        <div className="verify-code" aria-live="polite">
          <div><span>Your code</span><strong>{result.code.split("").join(" ")}</strong></div>
          <div><span>Expires in</span><b>{minutes}:{seconds}</b></div>
          <button type="button" onClick={copyCode}>Copy code</button>
        </div>
      ) : null}

      {message ? <p className={message === "Code copied." || /approved/i.test(message) ? "form-success" : "form-error"} role="status">{message}</p> : null}
      {supportUrl ? <Link className="button wallet-secondary-button verify-support-link" href={supportUrl}>Create a prefilled support ticket</Link> : null}
      <small>Only actions for your assigned, active service are available. UniPlug never shows mailbox contents or confirmation links.</small>
    </article>
  );
}

export function VerifyTool({ subscriptions }: { subscriptions: VerifySubscription[] }) {
  if (!subscriptions.length) {
    return (
      <div className="wallet-empty verify-empty">
        <span aria-hidden="true">&#8962;</span>
        <h3>No eligible services yet</h3>
        <p>No active service assigned to you currently has VeriFy enabled.</p>
        <div><Link className="button wallet-secondary-button" href="/dashboard/subscriptions">View services</Link><Link className="button wallet-primary-button" href="/dashboard/support">Ask for help</Link></div>
      </div>
    );
  }

  return <div className="verify-service-grid">{subscriptions.map((subscription) => <VerifyCard key={subscription.id} subscription={subscription} />)}</div>;
}
