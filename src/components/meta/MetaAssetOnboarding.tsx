"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import type {
  MetaFacebookPage,
  MetaAdAccountResponse,
  MetaAssetSelection,
  MetaTokenStatus,
  ConnectedAdAccount,
} from "@/lib/marketing/meta/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";

function accountStatusLabel(status: number | undefined, locale: string): string {
  if (status === 1) return locale === "id" ? "Aktif" : "Active";
  if (status === 2) return locale === "id" ? "Nonaktif" : "Disabled";
  if (status === 3) return locale === "id" ? "Belum Lunas" : "Unsettled";
  if (status === 101) return locale === "id" ? "Ditutup" : "Closed";
  return locale === "id" ? "Status tidak diketahui" : "Unknown status";
}

export function MetaAssetOnboarding() {
  const { locale } = useI18n();
  const { addToast } = useToast();
  const id = locale === "id";

  const [pages, setPages] = useState<MetaFacebookPage[]>([]);
  const [adAccounts, setAdAccounts] = useState<MetaAdAccountResponse[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAdAccount[]>([]);
  const [, setSelected] = useState<MetaAssetSelection | null>(null);
  const [tokenStatus, setTokenStatus] = useState<MetaTokenStatus>("not_connected");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/meta/assets", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setPages(data.pages || []);
        setAdAccounts(data.adAccounts || []);
        setConnectedAccounts(data.connectedAccounts || []);
        setSelected(data.selected || null);
        setTokenStatus(data.tokenStatus || "not_connected");
        setAccountError(data.accountError || null);
        setChecked(
          new Set((data.connectedAccounts || []).map((a: ConnectedAdAccount) => a.adAccountId))
        );
        if (data.selected?.pageId) setSelectedPageId(data.selected.pageId);
      }
    } catch {
      addToast(
        "error",
        id ? "Gagal Memuat Aset" : "Failed to Load Assets",
        id ? "Gagal memuat daftar aset Meta dari server." : "Failed to load Meta assets from server."
      );
    } finally {
      setIsLoading(false);
    }
  }, [addToast, id]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("meta_connected") === "true") {
        addToast(
          "success",
          id ? "Otorisasi Meta Berhasil" : "Meta Authorized",
          id
            ? "Akun Meta berhasil dihubungkan. Pilih akun iklan yang akan disimpan."
            : "Your Meta account was connected. Select the ad accounts to save."
        );
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get("error")) {
        addToast(
          "error",
          id ? "Otorisasi Meta Gagal" : "Meta Authorization Failed",
          params.get("details")
            ? decodeURIComponent(params.get("details") as string)
            : id
              ? "Gagal menghubungkan Meta."
              : "Failed to connect Meta."
        );
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    async function initialLoad() {
      await loadAssets();
    }
    void initialLoad();
  }, [addToast, id, loadAssets]);

  const connectedIds = useMemo(
    () => new Set(connectedAccounts.map((a) => a.adAccountId)),
    [connectedAccounts]
  );

  const visibleAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return adAccounts;
    return adAccounts.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.id || "").toLowerCase().includes(q) ||
        (a.account_id || "").includes(q)
    );
  }, [adAccounts, search]);

  const needsReconnect =
    tokenStatus === "invalid" ||
    tokenStatus === "permission_insufficient" ||
    tokenStatus === "not_connected";

  const toggle = (accountId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const handleSave = async () => {
    const accounts = Array.from(checked);
    if (accounts.length === 0) {
      addToast(
        "warning",
        id ? "Pilih Akun Iklan" : "Select Ad Accounts",
        id ? "Centang minimal satu akun iklan untuk disimpan." : "Check at least one ad account to save."
      );
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/meta/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts, pageId: selectedPageId || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || (id ? "Gagal menyimpan akun." : "Failed to save accounts."));
      }
      addToast(
        "success",
        id ? "Akun Tersimpan" : "Accounts Saved",
        id
          ? `${accounts.length} akun iklan tersimpan. Menjalankan sinkronisasi pertama…`
          : `${accounts.length} ad accounts saved. Running the first sync…`
      );
      // First sync per saved account (server validates each target).
      for (const accountId of accounts) {
        await fetch("/api/marketing/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetAdAccountId: accountId }),
        }).catch(() => null);
      }
      await loadAssets();
    } catch (err) {
      addToast(
        "error",
        id ? "Gagal Menyimpan" : "Save Failed",
        err instanceof Error ? err.message : id ? "Gagal menyimpan akun iklan." : "Failed to save ad accounts."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAccount = async (accountId: string) => {
    try {
      const res = await fetch("/api/meta/assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId: accountId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || (id ? "Gagal menghapus akun." : "Failed to remove account."));
      }
      addToast(
        "info",
        id ? "Akun Dihapus dari Integrasi" : "Account Removed",
        id
          ? "Akun dihapus dari Haspro Ads. Akun Meta aslinya tidak diubah."
          : "The account was removed from Haspro Ads. The Meta account itself is unchanged."
      );
      await loadAssets();
    } catch (err) {
      addToast(
        "error",
        id ? "Gagal Menghapus" : "Remove Failed",
        err instanceof Error ? err.message : ""
      );
    }
  };

  const handleConfirmDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/meta/assets", { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowConfirmDisconnect(false);
        addToast(
          "info",
          id ? "Koneksi Diputuskan" : "Disconnected",
          id ? "Koneksi Meta Anda berhasil diputuskan." : "Your Meta connection was disconnected."
        );
        await loadAssets();
      } else {
        throw new Error(json.error || "");
      }
    } catch (err) {
      addToast(
        "error",
        id ? "Gagal Memutuskan" : "Disconnect Failed",
        err instanceof Error ? err.message : ""
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  const statusBadge = isLoading
    ? { text: id ? "Memuat…" : "Loading…", cls: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700" }
    : tokenStatus === "valid" && connectedAccounts.length > 0
      ? { text: id ? "Terhubung" : "Connected", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" }
      : tokenStatus === "valid"
        ? { text: id ? "Terhubung — pilih akun" : "Connected — select accounts", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" }
        : tokenStatus === "invalid"
          ? { text: id ? "Perlu Hubungkan Ulang" : "Reauthorization Required", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60" }
          : tokenStatus === "permission_insufficient"
            ? { text: id ? "Izin Tidak Mencukupi" : "Missing Permissions", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60" }
            : { text: id ? "Belum Terhubung" : "Not Connected", cls: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700" };

  return (
    <div className="surface-card rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {id ? "Integrasi Meta Ads" : "Meta Ads Integration"}
            </h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border font-mono ${statusBadge.cls}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusBadge.text}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {id
              ? `${connectedAccounts.length} akun iklan tersimpan di koneksi Meta Anda. Pilih akun di dashboard Ads untuk menentukan data yang ditampilkan.`
              : `${connectedAccounts.length} ad accounts saved to your Meta connection. Choose an account in the Ads dashboard to control which data is shown.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadAssets()}
            disabled={isLoading}
            className="rounded-xl border border-zinc-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
          >
            <svg className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-amber-500" : "text-zinc-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{id ? "Segarkan Akun" : "Refresh Accounts"}</span>
          </button>
          {connectedAccounts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowConfirmDisconnect(true)}
              disabled={isDisconnecting}
              className="rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-zinc-800 dark:text-rose-400 cursor-pointer disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              <svg className="h-3.5 w-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>{id ? "Putuskan Koneksi" : "Disconnect"}</span>
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-6 flex items-center justify-center gap-2.5 text-xs text-zinc-400">
          <svg className="h-4 w-4 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{id ? "Memuat akun iklan dari Meta Marketing API…" : "Loading ad accounts from Meta Marketing API…"}</span>
        </div>
      ) : needsReconnect ? (
        <div className="rounded-2xl border border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-950/10 p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {tokenStatus === "permission_insufficient"
                ? id
                  ? "Izin bacaan iklan belum diberikan"
                  : "Ad read permission was not granted"
                : tokenStatus === "invalid"
                  ? id
                    ? "Koneksi Meta perlu dihubungkan ulang"
                    : "The Meta connection needs to be reconnected"
                  : id
                    ? "Hubungkan Akun Meta Anda"
                    : "Connect Your Meta Account"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              {id
                ? "Masuk dengan akun Meta yang memiliki akses ke akun iklan properti, lalu setujui izin bacaan iklan (ads_read). Data hanya dibaca dan tidak akan diubah."
                : "Sign in with a Meta account that has access to ad accounts and grant read permission (ads_read). Data is read-only and never modified."}
            </p>
          </div>
          <div>
            <a
              href="/api/auth/meta/authorize"
              className="btn-solar inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>
                {tokenStatus === "not_connected"
                  ? id
                    ? "Otorisasi Akun Meta"
                    : "Authorize Meta Account"
                  : id
                    ? "Hubungkan Ulang Meta"
                    : "Reconnect Meta"}
              </span>
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="account-search" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {id ? "Pilih Akun Iklan yang Dikelola" : "Select Managed Ad Accounts"}
            </label>
            <div className="relative mb-3">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                id="account-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={id ? "Cari nama akun atau Ad Account ID…" : "Search by account name or ID…"}
                className="block w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-2 text-xs text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700/80 dark:bg-zinc-950 dark:text-zinc-100 transition-all"
              />
            </div>
            {visibleAccounts.length === 0 ? (
              <p role="status" className="text-xs text-zinc-400 italic py-4 text-center">
                {accountError
                  ? accountError === "rate_limited"
                    ? id ? "Meta membatasi permintaan. Tunggu sebentar lalu segarkan akun." : "Meta rate limited this request. Wait briefly, then refresh accounts."
                    : accountError === "network_error"
                      ? id ? "Tidak dapat terhubung ke Meta. Periksa koneksi lalu segarkan akun." : "Could not reach Meta. Check the connection, then refresh accounts."
                      : accountError === "pagination_error"
                        ? id ? "Daftar akun Meta terlalu besar untuk satu kali muat. Segarkan lagi atau hubungi dukungan." : "The Meta account list exceeded the safe page limit. Refresh or contact support."
                        : id ? "Meta gagal memuat akun iklan. Coba segarkan atau hubungkan ulang." : "Meta could not load ad accounts. Refresh or reconnect and try again."
                  : adAccounts.length === 0
                  ? id
                    ? "Tidak ada akun iklan yang dapat diakses identitas Meta ini."
                    : "No ad accounts are accessible to this Meta identity."
                  : id
                    ? "Tidak ada akun yang cocok dengan pencarian."
                    : "No accounts match your search."}
              </p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto pr-1 no-scrollbar">
                {visibleAccounts.map((acc) => {
                  const accId = acc.id || `act_${acc.account_id}`;
                  const already = connectedIds.has(accId) || connectedIds.has(`act_${acc.account_id}`);
                  return (
                    <li
                      key={accId}
                      className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                        checked.has(accId)
                          ? "border-amber-500/40 bg-amber-500/[0.04] dark:border-amber-500/30 dark:bg-amber-500/[0.06]"
                          : "border-zinc-200/80 bg-white hover:bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        id={`acc-${accId}`}
                        checked={checked.has(accId)}
                        onChange={() => toggle(accId)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded accent-amber-500 cursor-pointer"
                      />
                      <label htmlFor={`acc-${accId}`} className="min-w-0 flex-1 cursor-pointer select-none">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {acc.name || accId}
                          </span>
                          {already && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60">
                              {id ? "Tersimpan" : "Saved"}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                          {accId} · {acc.currency || "IDR"} · {acc.timezone_name || "Asia/Jakarta"} ·{" "}
                          {accountStatusLabel(acc.account_status, locale)}
                          {acc.business_name ? ` · ${acc.business_name}` : ""}
                        </span>
                      </label>
                      {already && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveAccount(accId)}
                          className="shrink-0 rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 cursor-pointer transition-colors"
                        >
                          {id ? "Hapus" : "Remove"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="selectPage" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {id
                ? "Facebook Page (opsional — tidak wajib untuk data iklan)"
                : "Facebook Page (optional — not required for ad reporting)"}
            </label>
            <select
              id="selectPage"
              value={selectedPageId}
              onChange={(e) => setSelectedPageId(e.target.value)}
              className="block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700/80 dark:bg-zinc-950 dark:text-zinc-100 cursor-pointer transition-all"
            >
              <option value="">{id ? "-- Tanpa Page --" : "-- No Page --"}</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.instagram_business_account
                    ? ` · IG @${p.instagram_business_account.username}`
                    : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-zinc-400">
              {id
                ? "Ketiadaan Page atau Instagram tidak menghalangi pelaporan akun iklan."
                : "A missing Page or Instagram account does not block ad account reporting."}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || checked.size === 0}
              className="btn-solar inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer transition-all shadow-xs"
            >
              {isSaving ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{id ? "Menyimpan & Menyinkronkan…" : "Saving & Syncing…"}</span>
                </>
              ) : (
                id ? `Simpan Akun Terpilih (${checked.size})` : `Save Selected Accounts (${checked.size})`
              )}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirmDisconnect}
        onClose={() => setShowConfirmDisconnect(false)}
        onConfirm={handleConfirmDisconnect}
        title={id ? "Putuskan Koneksi Meta?" : "Disconnect Meta Connection?"}
        description={
          id
            ? "Koneksi Meta Anda akan diputuskan dan kredensial tersimpan dihapus. Akun Meta asli tidak diubah."
            : "Your Meta connection will be disconnected and stored credentials removed. The Meta account itself is unchanged."
        }
        confirmText={id ? "Ya, Putuskan" : "Yes, Disconnect"}
        cancelText={id ? "Batal" : "Cancel"}
        variant="danger"
        isLoading={isDisconnecting}
      />
    </div>
  );
}
