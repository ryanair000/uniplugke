"use client";

import { useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LoginForm({ nextPath = "/dashboard/subscriptions" }: { nextPath?: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      // A hard navigation guarantees that the newly written auth cookies are
      // available to protected Server Components on the first destination render.
      window.location.assign(body.next || "/dashboard/subscriptions");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Phone number, username or email
        <input
          type="text"
          autoComplete="username"
          required
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="0712 345 678"
        />
      </label>
      <label>
        Private password
        <span className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      {message && <p className="form-error" role="alert">{message}</p>}
      <button className="button button-dark" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function RegisterForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Registration failed");
      if (body.signedIn) {
        window.location.assign(body.next || "https://uniplug.shop");
        return;
      }
      setSuccess(true);
      setMessage(body.message || "Check your email to confirm your account, then sign in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Your name
        <input autoComplete="name" maxLength={80} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </label>
      <label>
        Email address
        <input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Password
        <span className="password-field">
          <input autoComplete="new-password" minLength={8} required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} />
          <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "Show"}</button>
        </span>
      </label>
      {message ? <p className={success ? "form-success" : "form-error"} role="status">{message}</p> : null}
      <button className="button button-dark" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
  );
}

export function SignOutButton() {
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
        window.location.assign("/login");
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
