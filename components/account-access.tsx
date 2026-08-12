"use client";

import { useEffect, useState } from "react";

type AccessDetails = { serviceName: string; accountEmail: string; accountPassword: string; verificationCode: string | null; profileName: string | null };
type CodeResult = { code: string; expiresAt: string; receivedAt: string };

function VaultRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
  return <div className="wallet-vault-row"><div><dt>{label}</dt><dd>{value}</dd></div><div className="wallet-vault-actions"><button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button></div></div>;
}

export function AccountAccess({ subscriptionId, canReplace = true, isNetflix = false }: { subscriptionId: string; canReplace?: boolean; isNetflix?: boolean }) {
  const [details, setDetails] = useState<AccessDetails | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"reveal" | "replace" | "code" | null>("reveal");
  const [householdOpen, setHouseholdOpen] = useState(false);
  const [replacementReason, setReplacementReason] = useState<string | null>(null);
  const [codeResult, setCodeResult] = useState<CodeResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadDetails() {
      setBusy("reveal"); setMessage("");
      try {
        const response = await fetch(`/api/portal/subscriptions/${subscriptionId}/access`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Login details could not be loaded.");
        if (active) setDetails(body);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Login details could not be loaded.");
      } finally {
        if (active) setBusy(null);
      }
    }
    void loadDetails();
    return () => { active = false; };
  }, [subscriptionId]);

  useEffect(() => {
    if (!codeResult) return;
    const update = () => setSecondsLeft(Math.max(0, Math.floor((new Date(codeResult.expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [codeResult]);

  async function replace() {
    if (!replacementReason) return;
    setBusy("replace"); setMessage("");
    try {
      const response = await fetch(`/api/portal/subscriptions/${subscriptionId}/replace`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: replacementReason }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Replacement could not be completed.");
      if (body.status === "approval_required") {
        setReplacementReason(null);
        setMessage(body.message || "Admin approval is required before another replacement.");
        return;
      }
      if (body.details) setDetails(body.details);
      setReplacementReason(null); setHouseholdOpen(false); setCodeResult(null);
      setMessage("Replacement completed. Your new login details are ready.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Replacement could not be completed."); }
    finally { setBusy(null); }
  }

  async function getLatestCode() {
    setBusy("code"); setMessage(""); setCodeResult(null);
    try {
      const response = await fetch(`/api/portal/subscriptions/${subscriptionId}/netflix-code`, { method: "POST", cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No current Netflix code was found.");
      setCodeResult(body);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No current Netflix code was found."); }
    finally { setBusy(null); }
  }

  async function copyCode() {
    if (!codeResult) return;
    await navigator.clipboard.writeText(codeResult.code);
    setMessage("Temporary code copied.");
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <section className="wallet-card access-console">
      <div className="wallet-card-heading"><div><p className="wallet-kicker">Account access</p><h2>Login details</h2></div><span className="wallet-lock" aria-hidden="true">⌁</span></div>
      {!details ? <div className="access-console-locked"><p>{busy === "reveal" ? "Loading your login details…" : "Login details are currently unavailable."}</p></div> : <dl className="wallet-vault access-console-vault"><VaultRow label="Email" value={details.accountEmail}/><VaultRow label="Password" value={details.accountPassword}/>{details.profileName ? <VaultRow label="Profile" value={details.profileName}/> : null}<p>Keep these login details private and use them only for your assigned service.</p></dl>}

      <div className="access-console-actions">
        {isNetflix ? <button className="button household-button" type="button" onClick={() => { setHouseholdOpen((current) => !current); setReplacementReason(null); setMessage(""); }}>Household help</button> : null}
        {canReplace ? <button className="button replace-button" type="button" onClick={() => { setReplacementReason(""); setHouseholdOpen(false); setMessage(""); }}>Replace account</button> : null}
      </div>

      {isNetflix && householdOpen ? <div className="household-assistant">
        <div className="household-heading"><span aria-hidden="true">TV</span><div><p className="wallet-kicker">Netflix Household help</p><h3>Watching away from home?</h3></div></div>
        <ol><li><b>On your TV</b><span>Choose <strong>I’m Traveling</strong>. On mobile or computer choose <strong>Watch Temporarily</strong>.</span></li><li><b>Request the email</b><span>Choose <strong>Send Email</strong> on Netflix, then return here.</span></li><li><b>Get the code</b><span>Temporary codes expire after 15 minutes.</span></li></ol>
        <button className="button wallet-primary-button household-code-button" type="button" onClick={getLatestCode} disabled={Boolean(busy)}>{busy === "code" ? "Checking Netflix email…" : "Get latest Netflix code"}</button>
        {codeResult ? <div className="temporary-code" aria-live="polite"><div><span>Latest code</span><strong>{codeResult.code.split("").join(" ")}</strong></div><div><span>Expires in</span><b>{minutes}:{seconds}</b></div><button type="button" onClick={copyCode}>Copy code</button></div> : null}
        <div className="household-fallback"><strong>Don’t see “I’m Traveling” or “Watch Temporarily”?</strong><p>Netflix may have reached the temporary-code limit for this device. If an eligible slot is available, UniPlug can replace this access.</p><button type="button" onClick={() => setReplacementReason("household_issue")}>I don’t see that option</button></div>
        <small>For authorized household or travelling access only.</small>
      </div> : null}

      {replacementReason !== null ? <div className="replacement-confirm" role="region" aria-live="polite" aria-labelledby="replacement-title"><div className="replacement-reason-field"><strong id="replacement-title">Why do you need a replacement?</strong><p>Your first replacement is instant. Any replacement after that requires admin approval.</p><label htmlFor={`replacement-reason-${subscriptionId}`}>Issue</label><select id={`replacement-reason-${subscriptionId}`} value={replacementReason} onChange={(event) => setReplacementReason(event.target.value)}><option value="">Choose an issue</option><option value="incorrect_password">Incorrect password</option><option value="no_subscription">No active subscription</option><option value="vpn_issue">VPN or location issue</option>{isNetflix ? <option value="household_issue">Netflix Household issue</option> : null}<option value="other">Other login problem</option></select></div><div><button className="button replace-button" type="button" onClick={replace} disabled={Boolean(busy) || !replacementReason}>{busy === "replace" ? "Finding a slot…" : "Confirm replacement"}</button><button className="button wallet-ghost-button" type="button" onClick={() => setReplacementReason(null)} disabled={Boolean(busy)}>Cancel</button></div></div> : null}
      {message ? <p className={message.includes("completed") || message.includes("copied") || message.toLowerCase().includes("approval") ? "form-success" : "form-error"} role="status">{message}</p> : null}
    </section>
  );
}
