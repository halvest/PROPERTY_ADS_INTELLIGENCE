"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface SyncStatusData {
  configured: boolean;
  mode: "live" | "not_connected";
  apiVersion?: string;
}

interface AssetData {
  adAccountName?: string;
  adAccountId?: string;
  currency?: string;
  timezone?: string;
  connectionStatus?: string;
  lastSyncAt?: string;
}

export function OnboardingStatusBar({ reloadToken = 0 }: { reloadToken?: number }) {
  const { locale } = useI18n();

  const [syncMeta, setSyncMeta] = useState<SyncStatusData | null>(null);
  const [assetData, setAssetData] = useState<AssetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function checkStatus() {
      try {
        const [syncRes, assetRes] = await Promise.all([
          fetch("/api/marketing/sync", { cache: "no-store" }),
          fetch("/api/meta/assets", { cache: "no-store" }),
        ]);

        if (ignore) return;

        if (syncRes.ok) {
          const syncJson = await syncRes.json();
          setSyncMeta({
            configured: Boolean(syncJson.configured),
            mode: syncJson.mode === "live" ? "live" : "not_connected",
            apiVersion: syncJson.apiVersion,
          });
        }

        if (assetRes.ok) {
          const assetJson = await assetRes.json();
          if (assetJson.success && assetJson.selected) {
            const savedAccount = (assetJson.connectedAccounts || []).find(
              (account: { adAccountId: string }) => account.adAccountId === assetJson.selected.adAccountId
            );
            setAssetData({
              adAccountName: savedAccount?.adAccountName || assetJson.selected.adAccountName,
              adAccountId: assetJson.selected.adAccountId,
              currency: savedAccount?.currency || undefined,
              timezone: savedAccount?.timezone || undefined,
              connectionStatus: assetJson.selected.connectionStatus,
              lastSyncAt: savedAccount?.lastSyncedAt || undefined,
            });
            if (assetJson.selected.lastSyncAt) {
              setLastSyncTime(new Date(assetJson.selected.lastSyncAt).toLocaleTimeString());
            }
          }
        }
      } catch {
        // Non-blocking status fetch
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    checkStatus();
    return () => {
      ignore = true;
    };
  }, [reloadToken]);

  if (isLoading) {
    return (
      <div className="h-9 rounded-lg border border-zinc-200/80 bg-white/50 px-3 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50 flex items-center animate-pulse">
        {locale === "id" ? "Memeriksa status produksi & pipeline data..." : "Checking production context & data pipeline..."}
      </div>
    );
  }

  const isLive = syncMeta?.mode === "live" && syncMeta?.configured;
  const adAccountDisplay = assetData?.adAccountName || assetData?.adAccountId || (locale === "id" ? "Belum dipilih" : "No account selected");
  const currency = assetData?.currency || "—";

  return (
    <div className="rounded-lg border border-zinc-200/80 bg-white px-3 py-2 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/90 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Left: Mode Badge & Core Pipeline Context */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-[11px]">
          {/* Production Mode Indicator */}
          <div className="flex items-center gap-1.5">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-mono tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                LIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded bg-amber-50 px-2 py-0.5 font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 font-mono tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {locale === "id" ? "BELUM TERHUBUNG" : "NOT CONNECTED"}
              </span>
            )}
          </div>

          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>

          {/* Ad Account & Currency */}
          <div className="flex items-center gap-1">
            <span className="text-zinc-400 font-medium">
              {locale === "id" ? "Akun:" : "Account:"}
            </span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[150px] sm:max-w-[200px]">
              {adAccountDisplay}
            </span>
            <span className="font-mono text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
              {currency}
            </span>
          </div>

          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>

          {/* Reporting Timezone */}
          <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
            <span>{locale === "id" ? "Zona:" : "TZ:"}</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">{assetData?.timezone || "—"}</span>
          </div>

          <span className="text-zinc-300 dark:text-zinc-700 hidden md:inline">|</span>

          {/* Freshness / Last Sync */}
          <div className="hidden md:flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
            <span>{locale === "id" ? "Sinkronisasi:" : "Last Sync:"}</span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300">
              {lastSyncTime || "—"}
            </span>
          </div>
        </div>

        {/* Right: Sync Action & Quick Settings */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/settings?tab=meta"
            className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
          >
            {locale === "id" ? "Kelola Aset" : "Manage Assets"}
          </Link>
        </div>
      </div>
    </div>
  );
}

export const ProductionContextBar = OnboardingStatusBar;

