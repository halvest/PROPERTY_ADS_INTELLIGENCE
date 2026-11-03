"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { MetaAssetOnboarding } from "@/components/meta/MetaAssetOnboarding";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Quota = {
  limit: number;
  used: number;
  reserved: number;
  remaining: number;
  resetAt: string | null;
};

type SettingsTab = "account" | "meta" | "ai" | "workspace";

const TAB_EVENT = "hd_settings_tab_change";

function subscribeTab(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", callback);
  window.addEventListener(TAB_EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(TAB_EVENT, callback);
  };
}

function getTabSnapshot(): SettingsTab {
  if (typeof window === "undefined") return "account";
  try {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "meta" || params.get("meta_connected") === "true" || params.get("error")) {
      return "meta";
    }
    if (tabParam === "ai") return "ai";
    if (tabParam === "workspace") return "workspace";
    return "account";
  } catch {
    return "account";
  }
}

function getServerTabSnapshot(): SettingsTab {
  return "account";
}

export default function SettingsPage() {
  const { locale, dict } = useI18n();
  const id = locale === "id";

  const activeTab = useSyncExternalStore(subscribeTab, getTabSnapshot, getServerTabSnapshot);
  const [user, setUser] = useState<{ email: string; confirmed: boolean } | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaEnabled, setQuotaEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const handleSelectTab = (tab: SettingsTab) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
      window.dispatchEvent(new Event(TAB_EVENT));
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [auth, usage] = await Promise.all([
      supabase.auth.getUser(),
      fetch("/api/ai/usage", { cache: "no-store" })
        .then(async (r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);
    if (auth.data.user) {
      const u = auth.data.user;
      setUser({
        email: u.email || "",
        confirmed: Boolean(u.email_confirmed_at),
      });
      setEmail(u.email || "");

      const metaName = (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || "";
      const metaCompany = (u.user_metadata?.company_name as string) || "";

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, organization_id, organizations(name)")
        .eq("id", u.id)
        .maybeSingle();

      const resolvedName = profile?.full_name || metaName || "";
      const orgRecord = Array.isArray(profile?.organizations) ? profile?.organizations[0] : profile?.organizations;
      const resolvedCompany = metaCompany || orgRecord?.name || "";

      setFullName(resolvedName);
      setCompanyName(resolvedCompany);
      if (profile?.organization_id) setOrgId(profile.organization_id);
    }
    if (usage?.success) {
      setQuotaEnabled(usage.data.enabled !== false);
      setQuota(usage.data.enabled === false ? null : usage.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const updateProfile = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    const trimmedName = fullName.trim();
    const trimmedCompany = companyName.trim();

    if (!trimmedName) {
      setNotice({
        kind: "error",
        text: id ? "Nama lengkap wajib diisi." : "Full name is required.",
      });
      return;
    }

    setBusy("profile");
    try {
      const supabase = createClient();
      // 1. Update user auth metadata
      const { data: authData, error: authErr } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          company_name: trimmedCompany,
        },
      });

      if (authErr) throw authErr;

      // 2. Update profiles table
      if (authData.user) {
        await supabase
          .from("profiles")
          .update({
            full_name: trimmedName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", authData.user.id);

        // 3. Update organizations table if company provided
        if (orgId && trimmedCompany) {
          await supabase
            .from("organizations")
            .update({
              name: trimmedCompany,
              updated_at: new Date().toISOString(),
            })
            .eq("id", orgId);
        }
      }

      setNotice({
        kind: "success",
        text: id
          ? "Profil pengiklan dan nama perusahaan berhasil diperbarui."
          : "Advertiser profile and company name updated successfully.",
      });
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Gagal memperbarui profil.",
      });
    } finally {
      setBusy(null);
    }
  };

  const updateEmail = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    const nextEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setNotice({
        kind: "error",
        text: id ? "Masukkan alamat email yang valid." : "Enter a valid email address.",
      });
      return;
    }
    if (nextEmail.toLowerCase() === user?.email.toLowerCase()) {
      setNotice({
        kind: "error",
        text: id
          ? "Gunakan email yang berbeda dari email saat ini."
          : "Enter an email different from your current address.",
      });
      return;
    }
    setBusy("email");
    const { error } = await createClient().auth.updateUser(
      { email: nextEmail },
      { emailRedirectTo: `${window.location.origin}/auth/callback?redirect=%2Fsettings` }
    );
    setBusy(null);
    setNotice(
      error
        ? { kind: "error", text: error.message }
        : {
            kind: "success",
            text: id
              ? "Tautan konfirmasi telah dikirim ke email baru. Selesaikan konfirmasi untuk memperbarui email."
              : "A confirmation link was sent to your new email. Confirm it to finish updating.",
          }
    );
  };

  const updatePassword = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (newPassword.length < 8) {
      setNotice({
        kind: "error",
        text: id
          ? "Password baru harus terdiri dari minimal 8 karakter."
          : "New password must be at least 8 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({
        kind: "error",
        text: id ? "Konfirmasi password tidak sama." : "Password confirmation does not match.",
      });
      return;
    }
    setBusy("password");
    const { error } = await createClient().auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });
    setBusy(null);
    if (error) {
      setNotice({ kind: "error", text: error.message });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNotice({
      kind: "success",
      text: id ? "Password berhasil diperbarui dengan aman." : "Password updated successfully.",
    });
  };

  const fmt = (date: string | null) =>
    date
      ? new Intl.DateTimeFormat(id ? "id-ID" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(date))
      : id
        ? "Belum ada penggunaan"
        : "No usage yet";

  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* ── Page Header with Solar Glow ── */}
      <header className="solar-header surface-card rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              {id ? "Pusat Konfigurasi" : "Configuration Center"}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {id ? "Pengaturan Sistem" : "System Settings"}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
              {id
                ? "Kelola profil pengiklan, integrasi Meta Ads, kuota analisis AI, dan preferensi operasional iklan Anda."
                : "Manage advertiser profile, Meta Ads integration, AI analysis quota, and operational ad preferences."}
            </p>
          </div>

          {/* Quick User Snapshot Pill */}
          {user && (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2.5 sm:px-3.5 sm:py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40 shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-zinc-950 shadow-2xs">
                {user.email ? user.email[0].toUpperCase() : "U"}
              </div>
              <div className="text-left text-xs">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[160px] sm:max-w-[200px]">
                  {fullName || user.email}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      user.confirmed ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {user.confirmed
                      ? id
                        ? "Terverifikasi"
                        : "Verified"
                      : id
                        ? "Belum verifikasi"
                        : "Unverified"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Tabbed Segmented Navigation ── */}
        <nav
          aria-label="Settings navigation"
          className="mt-6 flex overflow-x-auto rounded-xl border border-zinc-200/90 bg-zinc-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-800/60 no-scrollbar"
        >
          <button
            type="button"
            onClick={() => handleSelectTab("account")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "account"
                ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-900 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <svg
              className={`h-4 w-4 ${activeTab === "account" ? "text-amber-500" : "text-zinc-400"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>{id ? "Profil & Bisnis" : "Profile & Business"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab("meta")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "meta"
                ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-900 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <svg
              className={`h-4 w-4 ${activeTab === "meta" ? "text-amber-500" : "text-zinc-400"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <span>{id ? "Integrasi Meta Ads" : "Meta Integration"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab("ai")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "ai"
                ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-900 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <svg
              className={`h-4 w-4 ${activeTab === "ai" ? "text-amber-500" : "text-zinc-400"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span>{id ? "Kredit & Kuota AI" : "AI Usage & Limits"}</span>
            {quota && (
              <span className="ml-1 rounded-full bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                {quota.remaining} {id ? "sisa" : "left"}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab("workspace")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "workspace"
                ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-900 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <svg
              className={`h-4 w-4 ${activeTab === "workspace" ? "text-amber-500" : "text-zinc-400"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span>{id ? "Preferensi Sistem" : "System Preferences"}</span>
          </button>
        </nav>
      </header>

      {/* ── Global Notice / Feedback Banner ── */}
      {notice && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-xs font-medium transition-all ${
            notice.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notice.kind === "success" ? (
              <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-current opacity-60 hover:opacity-100 cursor-pointer p-0.5"
            aria-label="Tutup notifikasi"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: PROFIL & BISNIS ── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeTab === "account" && (
        <div className="space-y-6">
          {/* Advertiser Profile Card */}
          <section className="surface-card rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
            <div className="mb-5 border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {id ? "Profil Pengiklan & Bisnis" : "Advertiser & Business Profile"}
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {id
                  ? "Informasi identitas pengiklan dan nama bisnis atau developer properti yang Anda kelola."
                  : "Advertiser identity and property business or developer details under your management."}
              </p>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Profile Form (Full Name & Company/Developer) */}
                <form onSubmit={updateProfile} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="settings-fullname"
                        className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                      >
                        {id ? "Nama Lengkap" : "Full Name"}
                      </label>
                      <input
                        id="settings-fullname"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={id ? "Contoh: Ahmad Zaky" : "e.g. John Doe"}
                        className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700/80 dark:bg-zinc-950 dark:text-white transition-all"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="settings-company"
                          className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                        >
                          {id ? "Perusahaan / Developer" : "Company / Developer"}
                        </label>
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {id ? "Opsional" : "Optional"}
                        </span>
                      </div>
                      <input
                        id="settings-company"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder={id ? "Contoh: PT Graha Harmoni Nusantara" : "e.g. Horizon Real Estate"}
                        className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700/80 dark:bg-zinc-950 dark:text-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={busy !== null}
                      className="btn-solar h-9 rounded-xl px-4 text-xs font-semibold disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-2"
                    >
                      {busy === "profile" ? (
                        <>
                          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>{id ? "Menyimpan…" : "Saving…"}</span>
                        </>
                      ) : (
                        id ? "Simpan Perubahan Profil" : "Save Profile Changes"
                      )}
                    </button>
                  </div>
                </form>

                <div className="border-t border-zinc-100 pt-5 dark:border-zinc-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          {id ? "Alamat Email Bisnis" : "Business Email Address"}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {user?.email || "—"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold self-start sm:self-center ${
                        user?.confirmed
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50"
                          : "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          user?.confirmed ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      {user?.confirmed
                        ? id
                          ? "Terverifikasi"
                          : "Verified"
                        : id
                          ? "Menunggu Konfirmasi"
                          : "Pending Confirmation"}
                    </span>
                  </div>

                  {/* Change Email Form */}
                  <form onSubmit={updateEmail} className="space-y-3 pt-4">
                    <label
                      htmlFor="settings-email"
                      className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                    >
                      {id ? "Perbarui Alamat Email Bisnis" : "Update Business Email Address"}
                    </label>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                            />
                          </svg>
                        </div>
                        <input
                          id="settings-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nama@perusahaan.com"
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-xs text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700/80 dark:bg-zinc-950 dark:text-white transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busy !== null}
                        className="btn-solar h-10 rounded-xl px-5 text-xs font-semibold disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-2"
                      >
                        {busy === "email" ? (
                          <>
                            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>{id ? "Mengirim Tautan…" : "Sending Link…"}</span>
                          </>
                        ) : (
                          id ? "Kirim Tautan Konfirmasi" : "Send Confirmation Link"
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      {id
                        ? "Kami akan mengirim tautan verifikasi ke email baru. Alamat tidak akan diganti sebelum Anda mengeklik tautan tersebut."
                        : "We will send a confirmation link to the new address. Your email will not change until you click that link."}
                    </p>
                  </form>
                </div>
              </div>
            )}
          </section>

          {/* Change Password Card */}
          <section className="surface-card rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
            <div className="mb-5 border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {id ? "Kata Sandi & Kredensial" : "Password & Credentials"}
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {id
                  ? "Pastikan akun Anda menggunakan kata sandi unik minimal 8 karakter untuk menjaga keamanan data."
                  : "Ensure your account uses a unique password of at least 8 characters to maintain data security."}
              </p>
            </div>

            <form onSubmit={updatePassword} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="current-pw"
                    className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    {id ? "Password Saat Ini" : "Current Password"}
                  </label>
                  <input
                    id="current-pw"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700/80 dark:bg-zinc-950 dark:text-white transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-pw"
                    className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    {id ? "Password Baru" : "New Password"}
                  </label>
                  <input
                    id="new-pw"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={id ? "Min. 8 karakter" : "Min. 8 characters"}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700/80 dark:bg-zinc-950 dark:text-white transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-pw"
                    className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    {id ? "Konfirmasi Password" : "Confirm Password"}
                  </label>
                  <input
                    id="confirm-pw"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700/80 dark:bg-zinc-950 dark:text-white transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 accent-amber-500"
                  />
                  <span>{id ? "Tampilkan karakter password" : "Show password text"}</span>
                </label>

                <button
                  type="submit"
                  disabled={busy !== null}
                  className="rounded-xl border border-zinc-200/90 bg-white px-5 py-2 text-xs font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 disabled:opacity-50 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 cursor-pointer transition-all inline-flex items-center gap-2"
                >
                  {busy === "password" ? (
                    <>
                      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>{id ? "Memperbarui Password…" : "Updating Password…"}</span>
                    </>
                  ) : (
                    id ? "Perbarui Kata Sandi" : "Update Password"
                  )}
                </button>
              </div>

              <div className="mt-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {id ? "Lupa kata sandi saat ini?" : "Forgot your current password?"}{" "}
                  <Link
                    href="/forgot-password"
                    className="font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:underline"
                  >
                    {id ? "Kirim tautan reset kata sandi" : "Send reset link"}
                  </Link>
                </p>
              </div>
            </form>
          </section>

          {/* Security Architecture Guarantees */}
          <section className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="flex items-center gap-2 mb-4">
              <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                {dict.settings.securityGuaranteesTitle}
              </h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {dict.settings.serverOnlyTitle}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {dict.settings.serverOnlyDesc}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {dict.settings.rlsTitle}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {dict.settings.rlsDesc}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {dict.settings.failClosedTitle}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {dict.settings.failClosedDesc}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: INTEGRASI META ADS ── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeTab === "meta" && (
        <div className="space-y-6">
          {/* Architectural Trust Notice */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-50/50 p-4 sm:p-5 dark:border-amber-500/20 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {id ? "Integrasi Meta Marketing API Read-Only" : "Read-Only Meta Marketing API Integration"}
                </h4>
                <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                  {id
                    ? "HD Creative hanya meminta hak akses baca (ads_read) untuk menarik metrik insight iklan, biaya kampanye, dan memvalidasi prospek CRM WhatsApp. Sistem tidak dapat mengubah iklan, anggaran, atau kartu pembayaran Anda."
                    : "HD Creative requests read-only permission (ads_read) to aggregate ad metrics, campaign spend, and validate CRM WhatsApp leads. The system cannot edit ads, change budgets, or access payment methods."}
                </p>
              </div>
            </div>
          </div>

          {/* Meta Asset Onboarding Component */}
          <MetaAssetOnboarding />
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: KUOTA & PENGGUNAAN AI ── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          <section className="surface-card rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {id ? "Alokasi Kuota Analisis AI" : "AI Analysis Quota Allocation"}
                </h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {quotaEnabled === false
                    ? id
                      ? "Pembatasan analisis sementara dinonaktifkan selama periode pengujian intensif."
                      : "Analysis limits are temporarily disabled during high-intensity testing."
                    : id
                      ? "Paket Free mencakup 3 analisis mendalam sukses dalam setiap jendela bergulir 7 hari."
                      : "The Free plan includes 3 successful deep analyses in each rolling 7-day period."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  {quotaEnabled === false ? "UNLIMITED TESTING" : "FREE PLAN"}
                </span>
              </div>
            </div>

            {quotaEnabled === false ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-5 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-sky-500 animate-ping" />
                  {id ? "Mode Pengujian Tanpa Batas Aktif" : "Unlimited Testing Mode Active"}
                </div>
                <p className="mt-1 leading-relaxed opacity-90">
                  {id
                    ? "Kuota per pengguna sedang dinonaktifkan di tingkat sistem. Anda dapat menjalankan analisis AI kinerja kampanye tanpa batas kuota."
                    : "Per-user quotas are globally relaxed. You may run ad performance evaluations without hitting rate caps."}
                </p>
              </div>
            ) : !quota ? (
              <p role="status" className="text-xs text-zinc-400 py-4">
                {loading || quotaEnabled === null
                  ? id
                    ? "Memuat alokasi kuota AI…"
                    : "Loading AI quota allocation…"
                  : id
                    ? "Penggunaan belum dapat dimuat. Coba segarkan halaman."
                    : "Usage could not be loaded. Please refresh."}
              </p>
            ) : (
              <div className="space-y-6">
                {/* Visual Progress Meter */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {id ? "Tingkat Penggunaan Kuota" : "Quota Consumption Level"}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-mono">
                      {Math.round(((quota.used + quota.reserved) / quota.limit) * 100)}%
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(4, ((quota.used + quota.reserved) / quota.limit) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* KPI Breakdown Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {id ? "Batas Periode" : "Cycle Limit"}
                    </p>
                    <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                      {quota.limit}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">{id ? "per 7 hari" : "per 7 days"}</p>
                  </div>

                  <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {id ? "Telah Digunakan" : "Used Analyses"}
                    </p>
                    <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                      {quota.used}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">{id ? "analisis selesai" : "completed"}</p>
                  </div>

                  <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {id ? "Sisa Tersedia" : "Remaining"}
                    </p>
                    <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {quota.remaining}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">{id ? "dapat digunakan" : "available now"}</p>
                  </div>

                  <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {id ? "Sedang Diproses" : "In Progress"}
                    </p>
                    <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">
                      {quota.reserved}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">{id ? "kunci sementara" : "reserved slot"}</p>
                  </div>
                </div>

                {/* Reset schedule indicator */}
                <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 text-xs dark:border-zinc-800 dark:bg-zinc-800/40">
                  <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {id ? "Penggunaan kuota berikutnya diperbarui pada:" : "Next analysis slot unlocks at:"}{" "}
                    <strong className="text-zinc-900 dark:text-zinc-200">{fmt(quota.resetAt)}</strong>
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* AI Feature Suite Checklist */}
          <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {id ? "Fitur AI Properti yang Termasuk" : "Included AI Property Features"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl border border-zinc-200/70 p-3.5 dark:border-zinc-800">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {id ? "Diagnostik Performa Iklan Properti" : "Property Ad Performance Diagnostics"}
                  </h4>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {id
                      ? "Analisis mendalam metrik CTR, CPC, CPM, Frequency, dan rasio konversi WhatsApp (CTWA)."
                      : "Deep analysis of CTR, CPC, CPM, Frequency, and WhatsApp CTWA conversion rates."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-zinc-200/70 p-3.5 dark:border-zinc-800">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {id ? "Optimasi Copywriting & Hook Iklan" : "Ad Copywriting & Hook Optimization"}
                  </h4>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {id
                      ? "Rekomendasi headline dan hook copy berbasis psikologi pencari rumah dan segmen pasar."
                      : "Actionable headline and copy angles based on property buyer psychology."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-zinc-200/70 p-3.5 dark:border-zinc-800">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {id ? "AI Property Creative Studio" : "AI Property Creative Studio"}
                  </h4>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {id
                      ? "Generasi visual materi iklan berstandar agensi dengan integrasi Muse Image Engine."
                      : "Agency-grade property advertisement visual production via Muse Image Engine."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-zinc-200/70 p-3.5 dark:border-zinc-800">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {id ? "Audit & Atribusi Prospek Real-Time" : "Real-Time Lead Attribution Audit"}
                  </h4>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {id
                      ? "Verifikasi sumber lead CRM dengan bukti Meta Ads autentik tanpa manipulasi data."
                      : "Verification of CRM lead sources backed by Meta Ads cryptographic audit."}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 4: WORKSPACE & PREFERENSI ── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeTab === "workspace" && (
        <div className="space-y-6">
          <section className="surface-card rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
            <div className="mb-5 border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {dict.settings.workspaceCardTitle}
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {id
                  ? "Pengaturan format pelaporan, zona waktu, dan mode koneksi data iklan properti."
                  : "Reporting format settings, timezone, and property ad data connection mode."}
              </p>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              <div className="flex items-center justify-between py-3.5">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {id ? "Perusahaan / Brand Iklan" : "Company / Ad Brand"}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {id ? "Nama akun bisnis atau developer properti aktif" : "Active property business or developer brand"}
                  </p>
                </div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg">
                  {companyName || fullName || (id ? "Akun Pengiklan Pribadi" : "Personal Advertiser Account")}
                </span>
              </div>

              <div className="flex items-center justify-between py-3.5">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {id ? "Mode Operasi Data" : "Data Operation Mode"}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {id ? "Koneksi data yang sedang aktif" : "Active data connection pipeline"}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live Production Data
                </span>
              </div>

              <div className="flex items-center justify-between py-3.5">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {id ? "Zona Waktu Default" : "Default Timezone"}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {id ? "Dasar perhitungan tanggal metrik" : "Basis for daily metric aggregation"}
                  </p>
                </div>
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">Asia/Jakarta (WIB · UTC+7)</span>
              </div>

              <div className="flex items-center justify-between py-3.5">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {id ? "Mata Uang Pelaporan" : "Reporting Currency"}
                  </p>
                  <p className="text-[11px] text-zinc-400">{id ? "Format angka biaya iklan" : "Ad spend format"}</p>
                </div>
                <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">IDR (Rp)</span>
              </div>
            </div>
          </section>

          {/* Preferences Quick Actions */}
          <section className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 mb-3">
              {id ? "Tampilan & Bahasa Antarmuka" : "Display & Interface Language"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
              {id
                ? "HD Creative mendukung Dual Theme (Light Mode & Dark Mode) dan multi-bahasa instan (Bahasa Indonesia & English). Anda dapat beralih tema atau bahasa kapan saja menggunakan tombol kontrol di header navigasi utama di bagian atas layar."
                : "HD Creative fully supports Dual Theme (Light Mode & Dark Mode) and instant bilingual switching (Bahasa Indonesia & English). You can switch themes or language at any time via the quick toggle buttons in the top header."}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                {id ? "Tema Aktif:" : "Active Theme:"}{" "}
                <strong className="text-amber-600 dark:text-amber-400">Modern Solar</strong>
              </div>
              <div className="rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                {id ? "Bahasa Aktif:" : "Active Language:"}{" "}
                <strong className="text-amber-600 dark:text-amber-400">
                  {id ? "Bahasa Indonesia (ID)" : "English (EN)"}
                </strong>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
