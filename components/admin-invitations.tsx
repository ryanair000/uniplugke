"use client";

import { useState, type FormEvent } from "react";

type InviteResult = {
  link: string;
  username: string;
  email: string;
  actionType: "invite" | "recovery";
  expiresIn: string;
};

export function AdminInvitationForm() {
  const [form, setForm] = useState({ displayName: "", email: "", username: "", phone: "" });
  const [result, setResult] = useState<InviteResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Invitation creation failed.");
      setResult(body as InviteResult);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invitation creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyMessage() {
    if (!result) return;
    const text = [
      `Welcome to UniPlug,`,
      `Username: ${result.username}`,
      `Create your private password using this one-time link: ${result.link}`,
      `The link expires in ${result.expiresIn}. Your username is not your password.`
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setMessage("Invitation message copied.");
  }

  return (
    <section className="panel">
      <p className="eyebrow">Invite-only access</p>
      <h2>Invite a member</h2>
      <p>Create a one-time link. The customer chooses a private password after opening it.</p>
      <form className="admin-form" onSubmit={submit}>
        <input
          required
          placeholder="Member name"
          value={form.displayName}
          onChange={(event) => setForm({ ...form, displayName: event.target.value })}
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <div className="form-row">
          <input
            placeholder="Username"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") })}
          />
          <input
            placeholder="Phone / WhatsApp"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </div>
        <button className="button button-dark" disabled={busy}>{busy ? "Creating link…" : "Create invitation"}</button>
      </form>
      {message && <p className={message.includes("copied") ? "form-success" : "form-error"}>{message}</p>}
      {result && (
        <div className="invite-result">
          <strong>{result.actionType === "invite" ? "New invitation ready" : "Password reset link ready"}</strong>
          <p>@{result.username} · {result.email}</p>
          <code>{result.link}</code>
          <button type="button" className="button button-light small" onClick={copyMessage}>Copy invitation message</button>
        </div>
      )}
    </section>
  );
}
