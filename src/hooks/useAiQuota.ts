"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AiQuotaState = { limit: number; used: number; reserved: number; remaining: number; resetAt: string | null };

export function useAiQuota() {
  const [quota, setQuota] = useState<AiQuotaState | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const refresh = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }
      } catch {
        // Fallback to cookie-only
      }

      const response = await fetch("/api/ai/usage", { cache: "no-store", headers });
      const body = await response.json();
      if (response.ok && body.success) {
        setEnabled(body.data.enabled !== false);
        setQuota(body.data.enabled === false ? null : body.data);
      }
    } catch { /* the analysis API remains authoritative */ }
  }, []);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
  return { quota, enabled, refresh };
}
