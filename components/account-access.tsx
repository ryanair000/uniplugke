"use client";

import { useEffect, useState } from "react";

type AccessDetails = { serviceName: string; accountEmail: string; accountPassword: string; verificationCode: string | null; profileName: string | null; profilePin: string | null };
type CodeResult = { code: string };

type IssueReason = "no_subscription" | "household_issue" | "incorrect_password" | "many_users_streaming" | "";

function VaultRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
  return <div className="wallet-vault-row"><div><dt>{label}</dt><dd>{value}</dd></div><div className="wallet-vault-actions"><button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button></div></div>;
}

export function AccountAccess({ subscriptionId, canReplace = true, isNetflix = false }: { subscriptionId: string; canReplace?: boolean; isNetflix?: boolean }) {
  const [details, setDetails] = useState<AccessDetails | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"reveal" | "replace" | "code" | "household" | null>("reveal");
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationStartedAt, setVerificationStartedAt] = useState<number | null>(null);
  const [verificationTimedOut, setVerificationTimedOut] = useState(false);
  const [codeNote, setCodeNote] = useState("");
  const [replacementReason, setReplacementReason] = useState<IssueReason | null>(null);
  const [codeResult, setCodeResult] = useState<CodeResult | null>(null);

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
    if (!verificationOpen || !verificationStartedAt || codeResult || verificationTimedOut) return;
    const remaining = 300_000 - (Date.now() - verificationStartedAt);
    const timer = window.setTimeout(() => setVerificationTimedOut(true), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [verificationOpen, verificationStartedAt, codeResult, verificationTimedOut]);

  useEffect(() => {
    if (!verificationOpen || !verificationStartedAt || codeResult || verificationTimedOut) return;
    const timer = window.setInterval(() => {
      if (Date.now() - verificationStartedAt >= 300_000) return;
      if (busy !== "code") void getLatestCode(true);
    }, 60_000);
    return () => window.clearInterval(timer);
    // getLatestCode reads the current subscription and only updates local request state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationOpen, verificationStartedAt, codeResult, verificationTimedOut, busy]);

  async function reportIssue() {
    if (!replacementReason) return;
    const reason = replacementReason;
    setBusy("replace"); setMessage("");
    try {
      const response = await fetch(`/api/portal/subscriptions/${subscriptionId}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Your account issue could not be submitted.");

      if (body.status === "admin_alerted") {
        setReplacementReason(null);
        setMessage(body.message || "Admin has been alerted and will review the account.");
        return;
      }

      if (body.details) setDetails(body.details);
      setReplacementReason(null);
      setVerificationOpen(false);
      setVerificationStartedAt(null);
      setVerificationTimedOut(false);
      setCodeResult(null);
      setCodeNote("");
      setMessage(body.message || "New slot assigned. Please log in using the new slot details shown above.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your account issue could not be submitted.");
    } finally {
      setBusy(null);
    }
  }

  async function getLatestCode(silent = false) {
    setBusy("code");
    if (!silent) setMessage("");
    setCodeNote("Checking Netflix for your verification code…");
    try {
      const response = await fetch(`/api/portal/subscriptions/${subscriptionId}/netflix-code`, { method: "POST", cache: "no-store" });
      const body = await response.json();
      if (!response.ok) {
        if (body.status === "not_found") {
          setCodeNote("Still waiting for the Netflix verification code…");
          return;
        }
        throw new Error(body.error || "The Netflix verification code could not be loaded.");
      }
      if (!body.code) throw new Error("The Netflix verification code could not be loaded.");
      setCodeResult({ code: String(body.code) });
      setCodeNote("");
    } catch (error) {
      setCodeNote("");
      setMessage(error instanceof Error ? error.message : "The Netflix verification code could not be loaded.");
    } finally {
      setBusy(null);
    }
  }

  function openVerificationCode() {
    const startedAt = Date.now();
    setVerificationOpen(true);
    setVerificationStartedAt(startedAt);
    setVerificationTimedOut(false);
    setReplacementReason(null);
    setCodeResult(null);
    setCodeNote("Checking Netflix for your verification code…");
    setMessage("");
    void getLatestCode();
  }

  function openAccountIssue(reason: IssueReason = "") {
    setReplacementReason(reason);
    setVerificationOpen(false);
    setVerificationStartedAt(null);
    setVerificationTimedOut(false);
    setCodeResult(null);
    setCodeNote("");
    setMessage("");
  }

  async function approveHouseholdUpdate() {
    setBusy("household");
    setMessage("");
    setVerificationOpen(false);
    setVerificationStartedAt(null);
    setVerificationTimedOut(false);
    setCodeResult(null);
    setCodeNote("");
    try {
      const response = await fetch(`/api/portal/subscriptions/${subscriptionId}/netflix-household`, { method: "POST", cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No current Netflix Household update request was found.");
      setMessage(body.reused ? "That Netflix Household request was already approved." : "Netflix Household update approved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The Netflix Household update could not be approved."); }
    finally { setBusy(null); }
  }

  const issueActionLabel = replacementReason === "household_issue" ? "Replace slot" : "Alert admin";
  const isSuccessMessage = /assigned|alerted|ready|completed|copied|approval|approved/i.test(message);

  return (
    <section className="wallet-card access-console">
      <div className="wallet-card-heading"><div><p className="wallet-kicker">Account access</p><h2>Login details</h2></div><span className="wallet-lock" aria-hidden="true">⌁</span></div>
      {!details ? <div className="access-console-locked"><p>{busy === "reveal" ? "Loading your login details…" : "Login details are currently unavailable."}</p></div> : <dl className="wallet-vault access-console-vault"><VaultRow label="Email" value={details.accountEmail}/><VaultRow label="Password" value={details.accountPassword}/>{details.profileName ? <VaultRow label="Profile" value={details.profileName}/> : null}{details.profilePin ? <VaultRow label="Profile PIN" value={details.profilePin}/> : null}<p>Keep these login details private and use them only for your assigned service.</p></dl>}

      <div className="access-console-actions">
        {isNetflix ? <button className="button household-button" type="button" onClick={openVerificationCode} disabled={busy === "code"}>Need Verification Code</button> : null}
        {isNetflix ? <button className="button household-button" type="button" onClick={approveHouseholdUpdate} disabled={Boolean(busy)}>{busy === "household" ? "Approving Household…" : "Approve Household update"}</button> : null}
        {canReplace ? <button className="button replace-button" type="button" onClick={() => openAccountIssue()}>Account not working</button> : null}
      </div>

      {isNetflix && verificationOpen ? <div className="household-assistant" aria-live="polite">
        <div className="household-heading"><span aria-hidden="true">#</span><div><p className="wallet-kicker">Netflix verification</p><h3>Verification code</h3></div></div>
        {!codeResult ? <p>{verificationTimedOut ? "The code is taking longer than expected." : (codeNote || "Checking Netflix for your verification code…")}</p> : null}
        {codeResult ? <div className="temporary-code"><strong>{codeResult.code.split("").join(" ")}</strong></div> : null}
        <small>This should usually take less than 2 minutes. If it takes more than 5 minutes, click Account not working.</small>
        {verificationTimedOut && !codeResult ? <button className="button replace-button" type="button" onClick={() => openAccountIssue()}>Account not working</button> : null}
      </div> : null}

      {replacementReason !== null ? <div className="replacement-confirm" role="region" aria-live="polite" aria-labelledby="replacement-title">
        <div className="replacement-reason-field">
          <strong id="replacement-title">What is wrong with this account?</strong>
          <p>Choose the issue below. Household issues get a new slot automatically; the other issues alert admin for review.</p>
          <label htmlFor={`replacement-reason-${subscriptionId}`}>Issue</label>
          <select id={`replacement-reason-${subscriptionId}`} value={replacementReason} onChange={(event) => setReplacementReason(event.target.value as IssueReason)}>
            <option value="">Choose an issue</option>
            <option value="no_subscription">No subscription</option>
            {isNetflix ? <option value="household_issue">Household issues</option> : null}
            <option value="incorrect_password">Incorrect Pass</option>
            <option value="many_users_streaming">Many users streaming</option>
          </select>
        </div>
        <div>
          <button className="button replace-button" type="button" onClick={reportIssue} disabled={Boolean(busy) || !replacementReason}>{busy === "replace" ? (replacementReason === "household_issue" ? "Finding a new slot…" : "Alerting admin…") : issueActionLabel}</button>
          <button className="button wallet-ghost-button" type="button" onClick={() => setReplacementReason(null)} disabled={Boolean(busy)}>Cancel</button>
        </div>
      </div> : null}
      {message ? <p className={isSuccessMessage ? "form-success" : "form-error"} role="status">{message}</p> : null}
    </section>
  );
}
