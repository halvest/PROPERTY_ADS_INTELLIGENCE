"use client";

import { useCallback, useEffect, useState } from "react";

export type AiQuotaState = { limit: number; used: number; reserved: number; remaining: number; resetAt: string | null };

export function useAiQuota() {
  const [quota, setQuota] = useState<AiQuotaState | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ai/usage", { cache: "no-store" });
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
