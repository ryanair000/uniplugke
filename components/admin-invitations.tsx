"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type ClientResult = {
  id: string;
  client_code: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  phone_e164: string | null;
  whatsapp: string | null;
  whatsapp_e164: string | null;
  status: string;
  services: Array<{ name: string; status: string }>;
  portal: { must_change_password: boolean; last_login_at: string | null } | null;
};

type InviteResult = {
  displayName: string;
  phone: string;
  temporaryPassword: string;
  username: string;
  serviceCount: number;
  actionType: "invite" | "recovery";
  loginUrl: string;
  message: string;
  whatsappUrl: string;
};

export function AdminInvitationForm() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<ClientResult[]>([]);
  const [selected, setSelected] = useState<ClientResult | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/clients?search=${encodeURIComponent(search)}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Client search failed.");
        setClients(body.clients || []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setMessage(error instanceof Error ? error.message : "Client search failed.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selected.id })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Invitation creation failed.");
      setResult(body as InviteResult);
      setClients((current) => current.map((client) => client.id === selected.id
        ? { ...client, portal: { must_change_password: true, last_login_at: null } }
        : client));
      setSelected((current) => current ? { ...current, portal: { must_change_password: true, last_login_at: null } } : current);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invitation creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyMessage() {
    if (!result) return;
    await navigator.clipboard.writeText(result.message);
    setMessage("Invitation message copied.");
  }

  return (
    <section className="panel invite-client-panel">
      <p className="eyebrow">Tracked client access</p>
      <h2>Invite an existing client</h2>
      <p>Select a Lokimax client. Their tracked services are linked automatically.</p>
      <label className="field">
        Search client
        <input
          type="search"
          placeholder="Name, phone, email, or client code"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setSelected(null); setResult(null); }}
        />
      </label>
      <div className="client-picker" aria-busy={loading}>
        {clients.map((client) => (
          <button
            className={selected?.id === client.id ? "client-picker-item selected" : "client-picker-item"}
            key={client.id}
            type="button"
            onClick={() => { setSelected(client); setResult(null); setMessage(""); }}
          >
            <span><strong>{client.display_name}</strong><small>{client.phone_e164 || client.phone || client.whatsapp_e164 || client.whatsapp || "Phone missing"}</small></span>
            <span><b>{client.services.length}</b><small>service{client.services.length === 1 ? "" : "s"}</small></span>
            <span className={`status-pill ${client.portal ? "status-active" : "subtle"}`}>{client.portal ? "Portal ready" : "Not invited"}</span>
          </button>
        ))}
        {!loading && !clients.length ? <p className="muted-copy">No tracked clients matched that search.</p> : null}
      </div>

      {selected ? (
        <form className="admin-form selected-client-summary" onSubmit={submit}>
          <div>
            <strong>{selected.display_name}</strong>
            <p>{selected.services.length ? selected.services.map((service) => service.name).join(", ") : "No services are currently tracked."}</p>
          </div>
          <button className="button button-dark" disabled={busy}>
            {busy ? "Preparing invite…" : selected.portal ? "Reset temporary access" : "Create client invite"}
          </button>
        </form>
      ) : null}

      {message && <p className={message.includes("copied") ? "form-success" : "form-error"}>{message}</p>}
      {result ? (
        <div className="invite-result">
          <strong>{result.actionType === "invite" ? "Client invite ready" : "Temporary access reset"}</strong>
          <p>{result.displayName} · {result.serviceCount} tracked service{result.serviceCount === 1 ? "" : "s"}</p>
          <dl className="credential-preview">
            <div><dt>Phone login</dt><dd>{result.phone}</dd></div>
            <div><dt>Temporary password</dt><dd>{result.temporaryPassword}</dd></div>
          </dl>
          <div className="invite-actions">
            <button type="button" className="button button-light small" onClick={copyMessage}>Copy invite</button>
            <a className="button button-dark small" href={result.whatsappUrl} target="_blank" rel="noreferrer">Send on WhatsApp</a>
          </div>
        </div>
      ) : null}
    </section>
  );
}
