"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";

type AccessDetails = {
  serviceName: string;
  accountEmail: string;
  accountPassword: string;
  verificationCode: string | null;
  profileName: string | null;
  profilePin: string | null;
};
type CodeResult = { code: string };
type IssueReason = "no_subscription" | "household_issue" | "incorrect_password" | "many_users_streaming" | "";
type CredentialKind = "email" | "password" | "profile" | "pin";

function CredentialIcon({ kind }: { kind: CredentialKind }) {
  if (kind === "email") return <Mail size={17} strokeWidth={2.2} />;
  if (kind === "profile") return <UserRound size={17} strokeWidth={2.2} />;
  return <KeyRound size={17} strokeWidth={2.2} />;
}

function VaultRow({
  label,
  value,
  kind,
  sensitive = false
}: {
  label: string;
  value: string;
  kind: CredentialKind;
  sensitive?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(!sensitive);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="access-credential-row">
      <div className="access-credential-main">
        <span className="access-credential-icon" aria-hidden="true"><CredentialIcon kind={kind} /></span>
        <div className="access-credential-copy">
          <dt>{label}</dt>
          <dd className={sensitive && !visible ? "is-masked" : undefined}>{sensitive && !visible ? "••••••••••••" : value}</dd>
        </div>
      </div>
      <div className="access-credential-actions">
        {sensitive ? (
          <button type="button" className="access-credential-action" onClick={() => setVisible((current) => !current)} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}>
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
            <span>{visible ? "Hide" : "Show"}</span>
          </button>
        ) : null}
        <button type="button" className={`access-credential-action ${copied ? "is-copied" : ""}`} onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    </div>
  );
}

export function AccountAccess({ subscriptionId, canReplace = true, isNetflix = false }: { subscriptionId: string; canReplace?: boolean; isNetflix?: boolean }) {
  const [details, setDetails] = useState<AccessDetails | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"reveal" | "replace" | "code" | null>("reveal");
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationStartedAt, setVerificationStartedAt] = useState<number | null>(null);
  const [verificationTimedOut, setVerificationTimedOut] = useState(false);
  const [codeNote, setCodeNote] = useState("");
  const [replacementReason, setReplacementReason] = useState<IssueReason | null>(null);
  const [codeResult, setCodeResult] = useState<CodeResult | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const getLatestCode = useCallback(async (silent = false) => {
    setBusy("code");
    if (!silent) setMessage("");
    setCodeNote("Checking Netflix for your verification code…");
    try {
      const response = await fetch(`/api/portal/subscriptions/${subscriptionId}/netflix-code`, { method: "POST", cache: "no-store" });
      const body = await response.json();
      if (body.status === "pending" || body.status === "not_found") {
        setCodeNote("Still waiting for the Netflix verification code…");
        return;
      }
      if (!response.ok) {
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
  }, [subscriptionId]);

  useEffect(() => {
    let active = true;
    async function loadDetails() {
      setBusy("reveal");
      setMessage("");
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
    const remaining = Math.max(0, 300_000 - (Date.now() - verificationStartedAt));
    const timer = window.setTimeout(() => setVerificationTimedOut(true), remaining);
    return () => window.clearTimeout(timer);
  }, [verificationOpen, verificationStartedAt, codeResult, verificationTimedOut]);

  useEffect(() => {
    if (!verificationOpen || !verificationStartedAt || codeResult || verificationTimedOut) return;
    const timer = window.setInterval(() => {
      if (Date.now() - verificationStartedAt >= 300_000) return;
      if (busy !== "code") void getLatestCode(true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [verificationOpen, verificationStartedAt, codeResult, verificationTimedOut, busy, getLatestCode]);

  async function copyAllDetails() {
    if (!details) return;
    const lines = [
      `${details.serviceName || "Service"} login details`,
      `Email: ${details.accountEmail}`,
      `Password: ${details.accountPassword}`,
      ...(details.profileName ? [`Profile: ${details.profileName}`] : []),
      ...(details.profilePin ? [`Profile PIN: ${details.profilePin}`] : [])
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1800);
    } catch {
      setMessage("Copy failed. Please allow clipboard access and try again.");
    }
  }

  async function reportIssue() {
    if (!replacementReason) return;
    const reason = replacementReason;
    setBusy("replace");
    setMessage("");
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

  const issueActionLabel = replacementReason === "household_issue" ? "Replace slot" : "Alert admin";
  const isSuccessMessage = /assigned|alerted|ready|completed|copied|approval/i.test(message);

  return (
    <section className="wallet-card access-console">
      <div className="wallet-card-heading access-console-heading">
        <div>
          <p className="wallet-kicker">Account access</p>
          <h2>Login details</h2>
          <p className="access-console-subtitle">Everything you need to sign in, in one place.</p>
        </div>
        {details ? <span className="access-ready-pill"><ShieldCheck size={14} /> Access ready</span> : <span className="wallet-lock" aria-hidden="true">⌁</span>}
      </div>

      {!details ? (
        <div className="access-console-locked"><p>{busy === "reveal" ? "Loading your login details…" : "Login details are currently unavailable."}</p></div>
      ) : (
        <>
          <dl className="wallet-vault access-console-vault">
            <VaultRow label="Email" value={details.accountEmail} kind="email" />
            <VaultRow label="Password" value={details.accountPassword} kind="password" sensitive />
            {details.profileName ? <VaultRow label="Profile" value={details.profileName} kind="profile" /> : null}
            {details.profilePin ? <VaultRow label="Profile PIN" value={details.profilePin} kind="pin" sensitive /> : null}
          </dl>
          <div className="access-copy-all">
            <div><strong>{details.serviceName || "Service"} access</strong><span>Keep these details private and use them only for your assigned service.</span></div>
            <button type="button" className={`access-copy-all-button ${copiedAll ? "is-copied" : ""}`} onClick={copyAllDetails}>
              {copiedAll ? <Check size={16} /> : <Copy size={16} />}
              {copiedAll ? "Copied all" : "Copy all details"}
            </button>
          </div>
        </>
      )}

      <div className="access-console-actions">
        {isNetflix ? <button className="button household-button" type="button" onClick={openVerificationCode} disabled={busy === "code"}>Need Verification Code</button> : null}
        {canReplace ? <button className="button replace-button" type="button" onClick={() => openAccountIssue()}>Account not working</button> : null}
      </div>

      {isNetflix && verificationOpen ? <div className="household-assistant" aria-busy={busy === "code"} aria-live="polite">
        <div className="household-heading"><span aria-hidden="true">#</span><div><p className="wallet-kicker">Netflix verification</p><h3>Verification code</h3></div></div>
        {!codeResult ? <div className="verification-progress">
          {busy === "code" ? <span className="verification-loader" aria-hidden="true"><i /><i /><i /></span> : null}
          <p>{verificationTimedOut ? "The code is taking longer than expected." : (busy === "code" ? "Checking Netflix for your verification code…" : (codeNote || "Waiting for a new Netflix verification code…"))}</p>
        </div> : null}
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
            <option value="incorrect_password">Incorrect password</option>
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
