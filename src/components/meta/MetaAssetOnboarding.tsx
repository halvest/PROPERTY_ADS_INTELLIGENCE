"use client";

import React, { useEffect, useState } from "react";
import type {
  MetaFacebookPage,
  MetaAdAccountResponse,
  MetaAssetSelection,
} from "@/lib/marketing/meta/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function MetaAssetOnboarding() {
  const { locale } = useI18n();
  const { addToast } = useToast();

  const [pages, setPages] = useState<MetaFacebookPage[]>([]);
  const [adAccounts, setAdAccounts] = useState<MetaAdAccountResponse[]>([]);
  const [selected, setSelected] = useState<MetaAssetSelection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  // Form selections state
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let ignore = false;

    // Check for Meta OAuth callback URL query parameters
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("meta_connected") === "true") {
        addToast(
          "success",
          locale === "id" ? "Otorisasi Meta Berhasil" : "Meta Authorized",
          locale === "id"
            ? "Akun Meta Anda berhasil dihubungkan. Silakan pilih akun iklan dan halaman Facebook."
            : "Your Meta account was connected. Please select an ad account and Facebook Page."
        );
        // Clean URL parameter
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } else if (params.get("error")) {
        const errType = params.get("error");
        const details = params.get("details");
        addToast(
          "error",
          locale === "id" ? "Otorisasi Meta Dibatalkan" : "Meta Authorization Failed",
          details
            ? decodeURIComponent(details)
            : locale === "id"
            ? `Gagal menghubungkan Meta: ${errType}`
            : `Failed to connect Meta: ${errType}`
        );
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }

    async function loadAssets() {
      try {
        const res = await fetch("/api/meta/assets");
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.success) {
            setPages(data.pages || []);
            setAdAccounts(data.adAccounts || []);
            setSelected(data.selected || null);

            if (data.selected?.connectionStatus === "connected") {
              setSelectedPageId(data.selected.pageId || "");
              setSelectedAdAccountId(data.selected.adAccountId || "");
            } else if (data.adAccounts?.length > 0) {
              setSelectedAdAccountId(data.adAccounts[0].id);
              if (data.pages?.length > 0) {
                setSelectedPageId(data.pages[0].id);
              }
            }
          }
        }
      } catch {
        if (!ignore) {
          addToast(
            "error",
            locale === "id" ? "Gagal Memuat Aset" : "Failed to Load Assets",
            locale === "id" ? "Gagal memuat daftar aset Meta dari server." : "Failed to load Meta assets from server."
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadAssets();
    return () => {
      ignore = true;
    };
  }, [addToast, locale]);

  const activeSelectedPage = pages.find((p) => p.id === selectedPageId);
  const activeInstagram = activeSelectedPage?.instagram_business_account;
  const isConnected = selected?.connectionStatus === "connected";

  const handleSaveSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdAccountId) {
      addToast(
        "warning",
        locale === "id" ? "Pilih Akun Iklan" : "Select Ad Account",
        locale === "id" ? "Pilih salah satu Akun Iklan (Ad Account) Meta untuk dianalisis." : "Please select a Meta Ad Account to analyze."
      );
      return;
    }

    setIsSaving(true);
    const activeAdAcc = adAccounts.find((a) => a.id === selectedAdAccountId);

    try {
      const res = await fetch("/api/meta/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: activeSelectedPage?.id || null,
          pageName: activeSelectedPage?.name || null,
          instagramAccountId: activeInstagram?.id || null,
          instagramUsername: activeInstagram?.username || null,
          adAccountId: selectedAdAccountId,
          adAccountName: activeAdAcc?.name || selectedAdAccountId,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSelected(json.selected);
        setIsEditing(false);
        addToast(
          "success",
          locale === "id" ? "Aset Tersimpan" : "Assets Saved",
          locale === "id"
            ? "Pilihan aset Meta (Facebook Page, Instagram, & Akun Iklan) berhasil disimpan."
            : "Meta assets (Facebook Page, Instagram, & Ad Account) saved successfully."
        );
      } else {
        addToast(
          "error",
          locale === "id" ? "Gagal Menyimpan" : "Save Failed",
          json.error || (locale === "id" ? "Gagal menyimpan pilihan aset Meta." : "Failed to save Meta asset selection.")
        );
      }
    } catch (err) {
      addToast(
        "error",
        locale === "id" ? "Kesalahan Jaringan" : "Network Error",
        err instanceof Error ? err.message : (locale === "id" ? "Kesalahan jaringan saat menyimpan aset." : "Network error saving assets.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/meta/assets", { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        setSelected(null);
        setIsEditing(false);
        setShowConfirmDisconnect(false);
        addToast(
          "info",
          locale === "id" ? "Aset Diputuskan" : "Assets Disconnected",
          locale === "id" ? "Koneksi aset Meta berhasil diputuskan." : "Meta assets connection disconnected."
        );
      } else {
        addToast(
          "error",
          locale === "id" ? "Gagal Memutuskan" : "Disconnect Failed",
          json.error || (locale === "id" ? "Gagal memutuskan koneksi aset Meta." : "Failed to disconnect Meta assets.")
        );
      }
    } catch {
      addToast(
        "error",
        locale === "id" ? "Kesalahan Jaringan" : "Network Error",
        locale === "id" ? "Terjadi kesalahan saat memutuskan koneksi." : "Error occurred while disconnecting."
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-5 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {locale === "id" ? "Integrasi Aset Meta (Facebook & Instagram Ads)" : "Meta Asset Integration (Facebook & Instagram Ads)"}
            </h2>
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {locale === "id" ? "Terhubung & Aktif" : "Connected & Active"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 font-mono">
                {locale === "id" ? "Belum Terhubung" : "Not Connected"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {locale === "id"
              ? "Hubungkan Facebook Page, Instagram Professional Account, dan Akun Iklan untuk sinkronisasi metrik dan evaluasi efisiensi biaya iklan."
              : "Connect Facebook Page, Instagram Professional Account, and Ad Account to synchronize ad metrics and compute CPQL."}
          </p>
        </div>

        {isConnected && !isEditing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
            >
              {locale === "id" ? "Ubah Pilihan Aset" : "Change Assets"}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmDisconnect(true)}
              disabled={isDisconnecting}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 shadow-2xs hover:bg-rose-50 dark:border-rose-900/40 dark:bg-zinc-800 dark:text-rose-400 dark:hover:bg-zinc-700 cursor-pointer disabled:opacity-50 transition-colors"
            >
              {isDisconnecting ? (locale === "id" ? "Memproses..." : "Disconnecting...") : (locale === "id" ? "Putuskan" : "Disconnect")}
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-zinc-400 py-2">
          {locale === "id" ? "Memeriksa aset Meta dari server..." : "Checking Meta assets from server..."}
        </p>
      ) : isConnected && !isEditing ? (
        /* Summary Card of Connected Assets */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">
              Facebook Page
            </span>
            <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
              {selected?.pageName || (locale === "id" ? "Tidak terhubung" : "Not connected")}
            </p>
            {selected?.pageId && (
              <p className="font-mono text-[10px] text-zinc-500 mt-0.5">ID: {selected.pageId}</p>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">
              Instagram Account
            </span>
            <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
              {selected?.instagramUsername ? `@${selected.instagramUsername}` : (locale === "id" ? "Tidak ada akun Instagram" : "No Instagram linked")}
            </p>
            {selected?.instagramAccountId && (
              <p className="font-mono text-[10px] text-zinc-500 mt-0.5">ID: {selected.instagramAccountId}</p>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">
              {locale === "id" ? "Akun Iklan (Ad Account)" : "Ad Account"}
            </span>
            <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
              {selected?.adAccountName || selected?.adAccountId}
            </p>
            <p className="font-mono text-[10px] text-zinc-500 mt-0.5">ID: {selected?.adAccountId}</p>
          </div>
        </div>
      ) : pages.length === 0 && adAccounts.length === 0 ? (
        /* OAuth Authorization Required CTA */
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {locale === "id" ? "Otorisasi Akun Meta Ads (OAuth 2.0)" : "Authorize Meta Ads Account (OAuth 2.0)"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-1 leading-relaxed">
              {locale === "id"
                ? "Hubungkan akun Meta Anda secara aman via OAuth 2.0 resmi (izin baca-saja) untuk menyinkronkan kampanye, ad sets, iklan, dan impresi properti."
                : "Securely authorize your Meta account via official read-only OAuth 2.0 to sync property campaigns, ad sets, ads, and performance insights."}
            </p>
          </div>
          <div className="pt-2">
            <a
              href="/api/auth/meta/authorize"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500 transition-colors"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              {locale === "id" ? "Otorisasi Akun Meta Sekarang" : "Authorize Meta Account Now"}
            </a>
          </div>
        </div>
      ) : (
        /* Form for Selection / Onboarding */
        <form onSubmit={handleSaveSelection} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Facebook Page Selection */}
            <div>
              <label
                htmlFor="selectPage"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                1. {locale === "id" ? "Pilih Facebook Page" : "Select Facebook Page"}
              </label>
              {pages.length > 0 ? (
                <select
                  id="selectPage"
                  value={selectedPageId}
                  onChange={(e) => setSelectedPageId(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 shadow-2xs focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 cursor-pointer"
                >
                  <option value="">{locale === "id" ? "-- Pilih Halaman Facebook --" : "-- Choose Facebook Page --"}</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.category ? `(${p.category})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-zinc-400 italic py-1.5">
                  {locale === "id" ? "Tidak ada Halaman Facebook yang terdeteksi untuk akun ini." : "No Facebook Pages detected for this account."}
                </p>
              )}
            </div>

            {/* 2. Linked Instagram Account Preview */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                2. {locale === "id" ? "Instagram Professional Account Terhubung" : "Linked Instagram Business Account"}
              </label>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 min-h-[38px] flex items-center">
                {activeInstagram ? (
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-pink-600 dark:text-pink-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 font-mono">@{activeInstagram.username || activeInstagram.name}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">({activeInstagram.id})</span>
                  </div>
                ) : (
                  <span className="text-zinc-400 italic">
                    {selectedPageId
                      ? (locale === "id" ? "Halaman ini belum terhubung ke Akun Instagram Bisnis (Opsional)." : "This page is not linked to an Instagram Business account (Optional).")
                      : (locale === "id" ? "Pilih Halaman Facebook terlebih dahulu." : "Select a Facebook Page first.")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Ad Account Selection */}
          <div>
            <label
              htmlFor="selectAdAccount"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
            >
              3. {locale === "id" ? "Pilih Akun Iklan Meta (Ad Account)" : "Select Meta Ad Account"}
            </label>
            {adAccounts.length > 0 ? (
              <select
                id="selectAdAccount"
                value={selectedAdAccountId}
                onChange={(e) => setSelectedAdAccountId(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 shadow-2xs focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 cursor-pointer"
              >
                <option value="">{locale === "id" ? "-- Pilih Akun Iklan Meta --" : "-- Select Meta Ad Account --"}</option>
                {adAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.id} ({a.currency || "IDR"}) • {a.id}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-zinc-400 italic py-1.5">
                {locale === "id" ? "Tidak ada Akun Iklan yang tersedia. Pastikan akun Meta Anda memiliki akses ke Ad Account." : "No Ad Accounts available. Ensure your Meta account has ad access."}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer"
              >
                {locale === "id" ? "Batal" : "Cancel"}
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving || !selectedAdAccountId}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {isSaving
                ? (locale === "id" ? "Menyimpan Pilihan..." : "Saving Selection...")
                : (locale === "id" ? "Simpan & Hubungkan Aset Meta" : "Save & Connect Meta Assets")}
            </button>
          </div>
        </form>
      )}

      {/* Accessible Confirmation Dialog for Disconnecting Meta Assets */}
      <ConfirmDialog
        isOpen={showConfirmDisconnect}
        onClose={() => setShowConfirmDisconnect(false)}
        onConfirm={handleConfirmDisconnect}
        title={locale === "id" ? "Putuskan Koneksi Aset Meta?" : "Disconnect Meta Assets?"}
        description={
          locale === "id"
            ? "Apakah Anda yakin ingin memutuskan integrasi aset Meta? Sinkronisasi metrik iklan otomatis akan dihentikan."
            : "Are you sure you want to disconnect Meta assets? Automatic ad metric synchronization will be stopped."
        }
        confirmText={locale === "id" ? "Ya, Putuskan" : "Yes, Disconnect"}
        cancelText={locale === "id" ? "Batal" : "Cancel"}
        variant="danger"
        isLoading={isDisconnecting}
      />
    </div>
  );
}
