"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition, type FormEvent, type ReactNode } from "react";
import styles from "./admin-toolbar-transition.module.css";

export function AdminToolbarTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLDivElement>) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const method = (form.getAttribute("method") || "get").toLowerCase();
    if (method !== "get") return;

    const target = new URL(form.getAttribute("action") || window.location.href, window.location.origin);
    if (target.origin !== window.location.origin) return;

    event.preventDefault();
    target.search = "";

    const data = new FormData(form);
    for (const [key, value] of data.entries()) {
      if (typeof value !== "string") continue;
      const normalized = value.trim();
      if (normalized) target.searchParams.append(key, normalized);
    }

    const destination = `${target.pathname || pathname}${target.search}${target.hash}`;
    startTransition(() => router.replace(destination, { scroll: false }));
  }

  return (
    <div
      aria-busy={isPending || undefined}
      className={`admin-toolbar ${styles.toolbar} ${isPending ? styles.pending : ""}`.trim()}
      onSubmitCapture={handleSubmit}
    >
      {children}
      <span className={styles.status} aria-live="polite">{isPending ? "Updating results" : ""}</span>
    </div>
  );
}
