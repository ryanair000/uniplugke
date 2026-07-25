"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LoginForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, next: nextPath })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Sign-in failed");
      router.replace(body.next || "/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Username or email
        <input
          type="text"
          autoComplete="username"
          required
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="your.username or name@example.com"
        />
      </label>
      <label>
        Private password
        <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {message && <p className="form-error" role="alert">{message}</p>}
      <button className="button button-dark" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="text-button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        localStorage.removeItem("uniplug-member-cart");
        const supabase = createBrowserSupabaseClient();
        await supabase.auth.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
