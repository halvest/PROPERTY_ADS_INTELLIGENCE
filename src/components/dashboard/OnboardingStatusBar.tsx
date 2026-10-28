"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";

interface SyncStatusData {
  configured: boolean;
  mode: "live" | "demo";
  targetAdAccountId?: string;
  apiVersion?: string;
}

interface AssetData {
  adAccountName?: string;
  adAccountId?: string;
  currency?: string;
  connectionStatus?: string;
  lastSyncAt?: string;
}

export function OnboardingStatusBar() {
  const { locale } = useI18n();
  const { addToast } = useToast();

  const [syncMeta, setSyncMeta] = useState<SyncStatusData | null>(null);
  const [assetData, setAssetData] = useState<AssetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const [refreshCount, setRefreshCount] = useState(0);

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
            mode: syncJson.mode === "live" ? "live" : "demo",
            targetAdAccountId: syncJson.targetAdAccountId,
            apiVersion: syncJson.apiVersion,
          });
        }

        if (assetRes.ok) {
          const assetJson = await assetRes.json();
          if (assetJson.success && assetJson.selected) {
            setAssetData({
              adAccountName: assetJson.selected.adAccountName,
              adAccountId: assetJson.selected.adAccountId,
              currency: assetJson.selected.currency || "IDR",
              connectionStatus: assetJson.selected.connectionStatus,
              lastSyncAt: assetJson.selected.lastSyncAt,
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
  }, [refreshCount]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/marketing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || data.status === "error") {
        throw new Error(data.message || `Gagal sinkronisasi (HTTP ${res.status})`);
      }
      setLastSyncTime(new Date().toLocaleTimeString());
      addToast(
        "success",
        locale === "id" ? "Sinkronisasi Berhasil" : "Sync Successful",
        locale === "id"
          ? `Data Meta Ads berhasil diperbarui (${data.mode?.toUpperCase() || "LIVE"}).`
          : `Meta Ads data refreshed successfully (${data.mode?.toUpperCase() || "LIVE"}).`
      );
      setRefreshCount((c) => c + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kesalahan server";
      addToast("error", locale === "id" ? "Sinkronisasi Gagal" : "Sync Failed", msg);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-9 rounded-lg border border-zinc-200/80 bg-white/50 px-3 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50 flex items-center animate-pulse">
        {locale === "id" ? "Memeriksa status produksi & pipeline data..." : "Checking production context & data pipeline..."}
      </div>
    );
  }

  const isLive = syncMeta?.mode === "live" && syncMeta?.configured;
  const adAccountDisplay =
    assetData?.adAccountName ||
    syncMeta?.targetAdAccountId ||
    (isLive ? "Meta Ads Production" : "Demo Property Sandbox");
  const currency = assetData?.currency || "IDR";

  return (
    <div className="rounded-lg border border-zinc-200/80 bg-white px-3 py-2 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/90 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Left: Mode Badge & Core Pipeline Context */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-[11px]">
          {/* Production Mode Indicator */}
          <div className="flex items-center gap-1.5">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-mono tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded bg-amber-50 px-2 py-0.5 font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 font-mono tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                DEMO / SANDBOX
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
            <span className="font-mono text-zinc-700 dark:text-zinc-300">Asia/Jakarta (WIB)</span>
          </div>

          <span className="text-zinc-300 dark:text-zinc-700 hidden md:inline">|</span>

          {/* Freshness / Last Sync */}
          <div className="hidden md:flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
            <span>{locale === "id" ? "Sinkronisasi:" : "Last Sync:"}</span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300">
              {lastSyncTime || (locale === "id" ? "Siap" : "Ready")}
            </span>
          </div>
        </div>

        {/* Right: Sync Action & Quick Settings */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 cursor-pointer transition-colors"
            title={locale === "id" ? "Sinkronisasikan metrik Meta Ads sekarang" : "Sync Meta Ads metrics now"}
          >
            <svg
              className={`h-3 w-3 text-zinc-500 ${isSyncing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{isSyncing ? (locale === "id" ? "Menyinkronkan..." : "Syncing...") : (locale === "id" ? "Sync Now" : "Sync Now")}</span>
          </button>

          <Link
            href="/settings"
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

