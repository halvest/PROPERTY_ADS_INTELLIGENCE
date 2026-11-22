"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import type {
  MetaFacebookPage,
  MetaAdAccountResponse,
  MetaAssetSelection,
  MetaTokenStatus,
  ConnectedAdAccount,
} from "@/lib/marketing/meta/types";
import {
  Panel,
  PanelFooter,
  PanelHeader,
  SettingRow,
  StatusPill,
  fieldClassName,
  type SettingsTone,
} from "@/components/settings/SettingsFrame";
import { Button } from "@/components/ui/Button";
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
        window.history.replaceState({}, document.title, `${window.location.pathname}?tab=meta`);
        window.dispatchEvent(new Event("hd_settings_tab_change"));
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
        window.history.replaceState({}, document.title, `${window.location.pathname}?tab=meta`);
        window.dispatchEvent(new Event("hd_settings_tab_change"));
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

  const statusMeta: { text: string; tone: SettingsTone } = isLoading
    ? { text: id ? "Memuat…" : "Loading…", tone: "neutral" }
    : tokenStatus === "valid" && connectedAccounts.length > 0
      ? { text: id ? "Terhubung" : "Connected", tone: "good" }
      : tokenStatus === "valid"
        ? { text: id ? "Terhubung · Pilih Akun" : "Connected · Select Accounts", tone: "info" }
        : tokenStatus === "invalid"
          ? { text: id ? "Perlu Hubungkan Ulang" : "Reauthorization Required", tone: "bad" }
          : tokenStatus === "permission_insufficient"
            ? { text: id ? "Izin Tidak Mencukupi" : "Missing Permissions", tone: "warn" }
            : { text: id ? "Belum Terhubung" : "Not Connected", tone: "neutral" };

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          title={id ? "Integrasi Meta Marketing API" : "Meta Marketing API Integration"}
          description={
            id
              ? `${connectedAccounts.length} akun iklan tersimpan di koneksi organisasi ini.`
              : `${connectedAccounts.length} ad accounts saved to this organization's connection.`
          }
          badge={
            <StatusPill tone={statusMeta.tone} dot>
              {statusMeta.text}
            </StatusPill>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadAssets()}
                disabled={isLoading}
              >
                <svg
                  className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-amber-500" : "text-zinc-400"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{id ? "Segarkan" : "Refresh"}</span>
              </Button>
              {connectedAccounts.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmDisconnect(true)}
                  disabled={isDisconnecting}
                  className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  {id ? "Putuskan Meta" : "Disconnect Meta"}
                </Button>
              ) : null}
            </div>
          }
        />

        {isLoading ? (
          <div className="space-y-2.5 px-5 py-6" role="status">
            <div className="h-9 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-14 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-14 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ) : needsReconnect ? (
          <div className="px-5 py-8">
            <div className="mx-auto max-w-lg space-y-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.75"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                  {tokenStatus === "permission_insufficient"
                    ? id
                      ? "Izin bacaan iklan (ads_read) belum diberikan"
                      : "Ad read permission (ads_read) was not granted"
                    : tokenStatus === "invalid"
                      ? id
                        ? "Sesi OAuth Meta perlu dihubungkan ulang"
                        : "Your Meta OAuth session needs to be reconnected"
                      : id
                        ? "Hubungkan Akun Meta Bisnis Anda"
                        : "Connect Your Meta Business Account"}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {id
                    ? "Otorisasi menggunakan izin ads_read (read-only) untuk menyinkronkan metrik kampanye dan iklan. Aplikasi tidak pernah mengubah kampanye, anggaran, atau metode pembayaran."
                    : "Authorization uses read-only ads_read scope to synchronize campaign and ad insights. The platform never modifies campaigns, budgets, or billing."}
                </p>
              </div>
              <div className="pt-1">
                <a
                  href="/api/auth/meta/authorize"
                  className="btn-solar inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
          </div>
        ) : (
          <>
            <SettingRow
              label={id ? "Akun Iklan (Ad Accounts)" : "Ad Accounts"}
              hint={
                id
                  ? "Centang akun iklan yang ingin diaktifkan di pemilih akun halaman /ads."
                  : "Check the ad accounts you want available in the /ads account switcher."
              }
              htmlFor="account-search"
            >
              <div className="space-y-3">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    id="account-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={id ? "Cari nama akun atau Ad Account ID…" : "Search by account name or ID…"}
                    className={`${fieldClassName} pl-8`}
                  />
                </div>

                {visibleAccounts.length === 0 ? (
                  <p role="status" className="rounded-md border border-zinc-200/70 bg-zinc-50/60 px-3.5 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                    {accountError
                      ? accountError === "rate_limited"
                        ? id
                          ? "Meta membatasi permintaan. Tunggu sebentar lalu segarkan akun."
                          : "Meta rate limited this request. Wait briefly, then refresh accounts."
                        : accountError === "network_error"
                          ? id
                            ? "Tidak dapat terhubung ke Meta. Periksa koneksi lalu segarkan akun."
                            : "Could not reach Meta. Check the connection, then refresh accounts."
                          : accountError === "pagination_error"
                            ? id
                              ? "Daftar akun Meta terlalu besar untuk satu kali muat. Segarkan lagi atau hubungi dukungan."
                              : "The Meta account list exceeded the safe page limit. Refresh or contact support."
                            : id
                              ? "Meta gagal memuat akun iklan. Coba segarkan atau hubungkan ulang."
                              : "Meta could not load ad accounts. Refresh or reconnect and try again."
                      : adAccounts.length === 0
                        ? id
                          ? "Tidak ada akun iklan yang dapat diakses identitas Meta ini."
                          : "No ad accounts are accessible to this Meta identity."
                        : id
                          ? "Tidak ada akun yang cocok dengan pencarian."
                          : "No accounts match your search."}
                  </p>
                ) : (
                  <ul className="max-h-72 divide-y divide-zinc-200/70 overflow-y-auto rounded-md border border-zinc-200/90 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/40">
                    {visibleAccounts.map((acc) => {
                      const accId = acc.id || `act_${acc.account_id}`;
                      const already = connectedIds.has(accId) || connectedIds.has(`act_${acc.account_id}`);
                      const isChecked = checked.has(accId);
                      return (
                        <li
                          key={accId}
                          className={`flex items-start gap-3 px-3.5 py-2.5 transition-colors ${
                            isChecked
                              ? "bg-amber-500/[0.04] dark:bg-amber-500/[0.06]"
                              : "hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            id={`acc-${accId}`}
                            checked={isChecked}
                            onChange={() => toggle(accId)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 accent-zinc-900 dark:accent-amber-400 cursor-pointer"
                          />
                          <label htmlFor={`acc-${accId}`} className="min-w-0 flex-1 cursor-pointer select-none">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                                {acc.name || accId}
                              </span>
                              {already ? (
                                <StatusPill tone="good">
                                  {id ? "Tersimpan" : "Saved"}
                                </StatusPill>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                              {accId} · {acc.currency || "IDR"} · {acc.timezone_name || "Asia/Jakarta"} ·{" "}
                              {accountStatusLabel(acc.account_status, locale)}
                              {acc.business_name ? ` · ${acc.business_name}` : ""}
                            </span>
                          </label>
                          {already ? (
                            <button
                              type="button"
                              onClick={() => void handleRemoveAccount(accId)}
                              className="shrink-0 rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 cursor-pointer"
                            >
                              {id ? "Lepas" : "Remove"}
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </SettingRow>

            <SettingRow
              label={id ? "Facebook Page" : "Facebook Page"}
              hint={
                id
                  ? "Opsional. Ketiadaan Page atau Instagram tidak menghalangi pelaporan akun iklan."
                  : "Optional. A missing Page or Instagram account does not block ad account reporting."
              }
              htmlFor="selectPage"
            >
              <select
                id="selectPage"
                value={selectedPageId}
                onChange={(e) => setSelectedPageId(e.target.value)}
                className={fieldClassName}
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
            </SettingRow>

            <PanelFooter
              hint={
                id
                  ? `${checked.size} akun dipilih untuk disinkronkan.`
                  : `${checked.size} account(s) selected for synchronization.`
              }
            >
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || checked.size === 0}
                isLoading={isSaving}
              >
                {isSaving
                  ? id
                    ? "Menyimpan & Menyinkronkan…"
                    : "Saving & Syncing…"
                  : id
                    ? `Simpan Akun Terpilih (${checked.size})`
                    : `Save Selected Accounts (${checked.size})`}
              </Button>
            </PanelFooter>
          </>
        )}
      </Panel>

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
