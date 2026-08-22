"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

type AdminDrawerProps = {
  triggerLabel: string;
  title: string;
  description?: string;
  children: ReactNode;
  triggerClassName?: string;
  eyebrow?: string;
};

export function AdminDrawer({
  triggerLabel,
  title,
  description,
  children,
  triggerClassName = "button button-dark small",
  eyebrow
}: AdminDrawerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button className={triggerClassName} type="button" onClick={() => setOpen(true)}>{triggerLabel}</button>
      {open ? (
        <div className="admin-drawer-layer" role="presentation">
          <button className="admin-drawer-backdrop" aria-label="Close panel" type="button" onClick={() => setOpen(false)} />
          <aside className="admin-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className="admin-drawer-header">
              <div>
                {eyebrow ? <p className="admin-kicker">{eyebrow}</p> : null}
                <h2 id={titleId}>{title}</h2>
                {description ? <p>{description}</p> : null}
              </div>
              <button className="admin-drawer-close" aria-label="Close panel" type="button" onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="admin-drawer-body">{children}</div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
