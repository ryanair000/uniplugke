"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const REFRESH_DEBOUNCE_MS = 200;

export function AdminLiveSync() {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const refresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel("admin-live-client-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_subscriptions" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients" },
        refresh,
      )
      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
