"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MetaAssetOnboarding } from "@/components/meta/MetaAssetOnboarding";
import {
  NoticeBanner,
  Panel,
  PanelFooter,
  SettingRow,
  SettingsNavigation,
  StatusPill,
  fieldClassName,
  type SettingsNavItem,
  type SettingsSection,
  type SettingsTone,
} from "@/components/settings/SettingsFrame";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";
import type { Theme } from "@/lib/theme/types";
import { createClient } from "@/lib/supabase/client";
import type { IntegrationStatusItem } from "@/app/api/integrations/status/route";

type Quota = {
  limit: number;
  used: number;
  reserved: number;
  remaining: number;
  resetAt: string | null;
};

type ConnectionHealthStatus = "healthy" | "warning_inactive" | "disconnected" | "pending" | "error";

type WhatsAppConnectionItem = {
  id: string;
  sales_member_id: string | null;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  connection_status: string;
  integration_mode: string;
  coexistence_enabled?: boolean;
  last_echo_at: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  health_status: ConnectionHealthStatus;
  days_since_echo: number | null;
};

type WhatsAppPayload = {
  workspace?: { id: string; name: string; slug: string };
  userRole?: "owner" | "admin" | "sales" | "viewer";
  quota?: {
    connected_count: number;
    max_whatsapp_connections: number;
    plan: string;
    subscription_status: string;
  };
  connections?: WhatsAppConnectionItem[];
};

type AuthUserSummary = {
  id: string;
  email: string;
  confirmed: boolean;
  confirmedAt: string | null;
  lastSignInAt: string | null;
};

const TAB_EVENT = "hd_settings_tab_change";
const PLAN_ALLOWANCES = [
  { id: "starter", name: "Starter", connections: 1 },
  { id: "standard", name: "Standard", connections: 3 },
  { id: "premium", name: "Premium", connections: 5 },
] as const;

function subscribeTab(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", callback);
  window.addEventListener(TAB_EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(TAB_EVENT, callback);
  };
}

function getTabSnapshot(): SettingsSection {
  if (typeof window === "undefined") return "profile";
  try {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "whatsapp") return "whatsapp";
    if (tabParam === "meta" || tabParam === "integrations") return "meta";
    if (tabParam === "subscription" || tabParam === "ai") return "subscription";
    if (tabParam === "security" || tabParam === "privacy" || tabParam === "email") return "security";
    if (!tabParam && (params.get("meta_connected") === "true" || params.get("error"))) return "meta";
    return "profile";
  } catch {
    return "profile";
  }
}

function getServerTabSnapshot(): SettingsSection {
  return "profile";
}

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

function connectionTone(item: WhatsAppConnectionItem): SettingsTone {
  if (item.health_status === "warning_inactive") return "warn";
  if (item.connection_status === "connected") return "good";
  if (item.connection_status === "pending" || item.connection_status === "connecting") return "info";
  if (item.connection_status === "error" || item.connection_status === "reconnect_required") return "bad";
  return "neutral";
}

function connectionLabel(item: WhatsAppConnectionItem, isId: boolean): string {
  if (item.health_status === "warning_inactive") return isId ? "Perlu aktivitas HP" : "Check phone app";
  if (item.connection_status === "connected" && item.integration_mode === "coexistence" && item.coexistence_enabled === false) {
    return isId ? "Terhubung, riwayat belum sinkron" : "Connected, history sync failed";
  }
  if (item.connection_status === "connected") return isId ? "Terhubung" : "Connected";
  if (item.connection_status === "pending" || item.connection_status === "connecting") {
    return isId ? "Menunggu" : "Pending";
  }
  if (item.connection_status === "error" || item.connection_status === "reconnect_required") {
    return isId ? "Perlu sambungan ulang" : "Reconnect required";
  }
  return isId ? "Terputus" : "Disconnected";
}

function integrationTone(status: IntegrationStatusItem["status"]): SettingsTone {
  if (status === "connected") return "good";
  if (status === "configured") return "info";
  if (status === "error") return "bad";
  return "neutral";
}

function integrationLabel(status: IntegrationStatusItem["status"], isId: boolean): string {
  if (status === "connected") return isId ? "Terhubung" : "Connected";
  if (status === "configured") return isId ? "Terkonfigurasi" : "Configured";
  if (status === "error") return isId ? "Perlu Tindakan" : "Action Required";
  return isId ? "Belum Terhubung" : "Disconnected";
}

export default function SettingsPage() {
  const { locale, setLocale, dict } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const isId = locale === "id";
  const mounted = useMounted();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const activeTab = useSyncExternalStore(subscribeTab, getTabSnapshot, getServerTabSnapshot);
  const [user, setUser] = useState<AuthUserSummary | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaEnabled, setQuotaEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [savedFullName, setSavedFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [savedCompanyName, setSavedCompanyName] = useState("");
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [whatsapp, setWhatsapp] = useState<WhatsAppPayload | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [disconnectTarget, setDisconnectTarget] = useState<WhatsAppConnectionItem | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const [integrations, setIntegrations] = useState<IntegrationStatusItem[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);

  const handleSelectTab = (tab: SettingsSection) => {
    if (typeof window === "undefined") return;
    setNotice(null);
    const url = new URL(window.location.href);
    if (tab === "profile") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState({}, "", url.toString());
    window.dispatchEvent(new Event(TAB_EVENT));
  };

  const loadWhatsapp = useCallback(async () => {
    setWhatsappLoading(true);
    try {
      const response = await fetch("/api/whatsapp/connections", { cache: "no-store" });
      const json = (await response.json()) as WhatsAppPayload & { success?: boolean; error?: string };
      if (!response.ok || !json.success) {
        setWhatsapp(null);
        setWhatsappError(
          json.error ||
            (isId ? "Koneksi WhatsApp tidak dapat dimuat." : "WhatsApp connections could not be loaded.")
        );
      } else {
        setWhatsapp(json);
        setWhatsappError(null);
      }
    } catch {
      setWhatsapp(null);
      setWhatsappError(
        isId ? "Jaringan bermasalah saat memuat WhatsApp." : "Network error while loading WhatsApp."
      );
    } finally {
      setWhatsappLoading(false);
    }
  }, [isId]);

  const loadIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    try {
      const response = await fetch("/api/integrations/status", { cache: "no-store" });
      const json = (await response.json()) as {
        success?: boolean;
        integrations?: IntegrationStatusItem[];
      };
      if (response.ok && json.success) {
        setIntegrations(json.integrations || []);
      } else {
        setIntegrations([]);
      }
    } catch {
      setIntegrations([]);
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) {
      const u = authUser;
      setUser({
        id: u.id,
        email: u.email || "",
        confirmed: Boolean(u.email_confirmed_at),
        confirmedAt: u.email_confirmed_at || null,
        lastSignInAt: u.last_sign_in_at || null,
      });
      setEmail(u.email || "");

      const metaName = (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || "";
      const metaCompany = (u.user_metadata?.company_name as string) || "";

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, organization_id, organizations(name)")
        .eq("id", u.id)
        .maybeSingle();

      const resolvedName = profile?.full_name || metaName || "";
      const orgRecord = Array.isArray(profile?.organizations)
        ? profile?.organizations[0]
        : profile?.organizations;
      const resolvedCompany = metaCompany || orgRecord?.name || "";

      setFullName(resolvedName);
      setSavedFullName(resolvedName);
      setCompanyName(resolvedCompany);
      setSavedCompanyName(resolvedCompany);
      if (profile?.organization_id) setOrgId(profile.organization_id);
      if (profile?.role) setProfileRole(profile.role);
    }
    setLoading(false);
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const usage = await fetch("/api/ai/usage", { cache: "no-store" }).then(async (r) =>
        r.ok ? r.json() : null
      );
      if (usage?.success) {
        setQuotaEnabled(usage.data.enabled !== false);
        setQuota(usage.data.enabled === false ? null : usage.data);
      }
    } catch {
      setQuota(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (activeTab !== "whatsapp" && activeTab !== "subscription") return;
    void loadWhatsapp();
  }, [activeTab, loadWhatsapp]);

  useEffect(() => {
    if (activeTab !== "meta") return;
    void loadIntegrations();
  }, [activeTab, loadIntegrations]);

  useEffect(() => {
    if (activeTab !== "subscription") return;
    void loadUsage();
  }, [activeTab, loadUsage]);

  const updateProfile = async (event?: FormEvent) => {
    event?.preventDefault();
    setNotice(null);
    const trimmedName = fullName.trim();
    const trimmedCompany = companyName.trim();

    if (!trimmedName) {
      setNotice({
        kind: "error",
        text: isId ? "Nama lengkap wajib diisi." : "Full name is required.",
      });
      return;
    }

    setBusy("profile");
    try {
      const supabase = createClient();
      const { data: authData, error: authErr } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          company_name: trimmedCompany,
        },
      });

      if (authErr) throw authErr;

      if (authData.user) {
        await supabase
          .from("profiles")
          .update({
            full_name: trimmedName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", authData.user.id);

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

      setSavedFullName(trimmedName);
      setSavedCompanyName(trimmedCompany);

      const nextEmail = email.trim();
      if (user && nextEmail && nextEmail.toLowerCase() !== user.email.toLowerCase()) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
          setNotice({
            kind: "error",
            text: isId
              ? "Profil disimpan, namun format email baru tidak valid."
              : "Profile saved, but the new email format is invalid.",
          });
          return;
        }
        const { error: emailErr } = await supabase.auth.updateUser(
          { email: nextEmail },
          { emailRedirectTo: `${window.location.origin}/auth/callback?redirect=%2Fsettings` }
        );
        if (emailErr) throw emailErr;
        setNotice({
          kind: "success",
          text: isId
            ? "Profil disimpan & tautan konfirmasi telah dikirim ke email baru Anda."
            : "Profile saved & a confirmation link has been sent to your new email.",
        });
        return;
      }

      setNotice({
        kind: "success",
        text: isId
          ? "Perubahan profil dan workspace berhasil disimpan."
          : "Profile and workspace changes saved successfully.",
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

  const updatePassword = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (newPassword.length < 8) {
      setNotice({
        kind: "error",
        text: isId
          ? "Password baru harus terdiri dari minimal 8 karakter."
          : "New password must be at least 8 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({
        kind: "error",
        text: isId ? "Konfirmasi password tidak sama." : "Password confirmation does not match.",
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
      text: isId ? "Password berhasil diperbarui dengan aman." : "Password updated successfully.",
    });
  };

  const confirmDisconnect = async () => {
    if (!disconnectTarget) return;
    const target = disconnectTarget;
    setDisconnectingId(target.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/whatsapp/connections/${target.id}/disconnect`, { method: "POST" });
      const json = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !json.success) {
        setNotice({
          kind: "error",
          text: json.error || (isId ? "Gagal memutuskan koneksi nomor WhatsApp." : "Failed to disconnect number."),
        });
        return;
      }
      setDisconnectTarget(null);
      setNotice({
        kind: "success",
        text: isId
          ? "Nomor WhatsApp diputuskan. Riwayat percakapan dan analisis tetap tersimpan."
          : "The WhatsApp number was disconnected. Conversations and analyses remain stored.",
      });
      await loadWhatsapp();
    } catch {
      setNotice({
        kind: "error",
        text: isId ? "Jaringan bermasalah saat memutuskan koneksi." : "Network error while disconnecting.",
      });
    } finally {
      setDisconnectingId(null);
    }
  };

  const fmt = (date: string | null) =>
    date
      ? new Intl.DateTimeFormat(isId ? "id-ID" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(date))
      : "—";

  const waQuota = whatsapp?.quota;
  const waConnections = whatsapp?.connections ?? [];
  const canManage = whatsapp?.userRole === "owner" || whatsapp?.userRole === "admin";
  const quotaFull = Boolean(
    waQuota && waQuota.max_whatsapp_connections > 0 && waQuota.connected_count >= waQuota.max_whatsapp_connections
  );
  const usagePercent =
    quota && quota.limit > 0 ? Math.min(100, Math.round(((quota.used + quota.reserved) / quota.limit) * 100)) : 0;
  const waPercent =
    waQuota && waQuota.max_whatsapp_connections > 0
      ? Math.min(100, Math.round((waQuota.connected_count / waQuota.max_whatsapp_connections) * 100))
      : 0;

  const isProfileDirty =
    fullName.trim() !== savedFullName.trim() ||
    companyName.trim() !== savedCompanyName.trim() ||
    Boolean(user && email.trim().toLowerCase() !== user.email.toLowerCase());

  const navItems: SettingsNavItem[] = [
    { id: "profile", label: isId ? "Umum" : "General" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "meta", label: "Meta Ads" },
    { id: "subscription", label: isId ? "Paket & Kuota" : "Plan & Quota" },
    { id: "security", label: isId ? "Keamanan & Privasi" : "Security & Privacy" },
  ];

  const themes: Array<{ id: Theme; label: string; desc: string }> = [
    {
      id: "light",
      label: dict.common.light,
      desc: isId ? "Tampilan terang dengan kontras tinggi." : "High-contrast light workspace.",
    },
    {
      id: "dark",
      label: dict.common.dark,
      desc: isId ? "Permukaan gelap grafit rendah silau." : "Low-glare dark graphite surface.",
    },
    {
      id: "system",
      label: dict.common.system,
      desc: isId ? "Sinkron otomatis dengan perangkat." : "Automatically match system setting.",
    },
  ];

  return (
    <div className="relative w-full min-w-0 pb-16">
      <div className="mx-auto w-full min-w-0 max-w-[1800px] space-y-6 px-4 sm:px-6 lg:px-8 xl:px-10">
      <header className="solar-header flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-[1.75rem]">
            {isId ? "Pengaturan" : "Settings"}
          </h1>
          <p className="mt-1 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {whatsapp?.workspace?.name || companyName || user?.email || dict.settings.subtitle}
          </p>
        </div>
        {profileRole || whatsapp?.userRole ? (
          <div className="self-start">
            <StatusPill tone="neutral">{(profileRole || whatsapp?.userRole || "").toUpperCase()}</StatusPill>
          </div>
        ) : null}
      </header>

      <div className="surface-card min-w-0 rounded-2xl border border-zinc-200/80 bg-white px-4 py-5 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6 sm:py-6 lg:px-8">

        {/* Horizontal Segmented Pill Tabs */}
        <SettingsNavigation
          items={navItems}
          active={activeTab}
          onSelect={handleSelectTab}
          label={isId ? "Bagian pengaturan" : "Settings sections"}
        />

        {notice ? (
          <NoticeBanner
            kind={notice.kind}
            text={notice.text}
            onDismiss={() => setNotice(null)}
            dismissLabel={isId ? "Tutup pemberitahuan" : "Dismiss notice"}
          />
        ) : null}

        {/* ===================================================================
            TAB 1: GENERAL (No Round Profile Photo, Modern Solar Theme)
           =================================================================== */}
        {activeTab === "profile" ? (
          <form onSubmit={updateProfile}>
            <Panel>
              {/* Row 1: Full Name */}
              <SettingRow
                label={isId ? "Nama Lengkap" : "Full Name"}
                hint={isId ? "Nama yang tampil pada profil akun Anda." : "Displayed on your account profile."}
                htmlFor="settings-fullname"
              >
                <input
                  ref={nameInputRef}
                  id="settings-fullname"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  placeholder={isId ? "Nama lengkap Anda" : "Your full name"}
                  required
                  className={fieldClassName}
                />
              </SettingRow>

              {/* Row 2: Email */}
              <SettingRow
                label="Email"
                hint={
                  user?.confirmed
                    ? isId
                      ? "Email masuk terverifikasi. Mengubah email akan mengirim tautan konfirmasi."
                      : "Verified sign-in email. Changing it sends a confirmation link."
                    : isId
                      ? "Menunggu konfirmasi alamat email."
                      : "Pending email confirmation."
                }
                badge={
                  user ? (
                    <StatusPill tone={user.confirmed ? "good" : "warn"} dot>
                      {user.confirmed
                        ? isId
                          ? "Terverifikasi"
                          : "Verified"
                        : isId
                          ? "Belum konfirmasi"
                          : "Unverified"}
                    </StatusPill>
                  ) : undefined
                }
                htmlFor="settings-email"
              >
                <input
                  id="settings-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={fieldClassName}
                />
              </SettingRow>

              {/* Row 3: Company / Workspace Name */}
              <SettingRow
                label={isId ? "Perusahaan / Workspace" : "Company / Workspace"}
                hint={
                  isId
                    ? "Nama organisasi yang muncul pada laporan dan ruang kerja."
                    : "Organization name shown across reports and workspaces."
                }
                htmlFor="settings-company"
              >
                <input
                  id="settings-company"
                  type="text"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  autoComplete="organization"
                  placeholder={isId ? "Nama perusahaan atau proyek" : "Company or workspace name"}
                  className={fieldClassName}
                />
              </SettingRow>

              {/* Row 4: Interface Display Options (Modern Solar Accent) */}
              <SettingRow
                label={isId ? "Opsi tampilan antarmuka" : "Interface view options"}
                hint={
                  isId
                    ? "Sesuaikan tema dan bahasa pengantar aplikasi."
                    : "Customize theme and global display language."
                }
              >
                <div className="space-y-4">
                  <div className="space-y-2.5" role="radiogroup" aria-label={isId ? "Tema" : "Theme"}>
                    {themes.map((option) => {
                      const selected = mounted && theme === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => {
                            setTheme(option.id);
                            setNotice({
                              kind: "success",
                              text: isId ? "Tampilan diperbarui." : "Appearance updated.",
                            });
                          }}
                          className="flex w-full items-start gap-3 rounded-lg p-1.5 -ml-1.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
                              selected
                                ? "bg-indigo-500 text-zinc-950 dark:bg-indigo-400 dark:text-zinc-950"
                                : "border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
                            }`}
                          >
                            {selected ? (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : null}
                          </span>
                          <div>
                            <p className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-100">
                              {isId ? `Mode ${option.label}` : `${option.label} mode`}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{option.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1">
                    <select
                      value={locale}
                      onChange={(e) => {
                        const next = e.target.value as "id" | "en";
                        if (next === locale) return;
                        setLocale(next);
                        setNotice({
                          kind: "success",
                          text:
                            next === "id"
                              ? "Bahasa diganti ke Indonesia."
                              : "Language switched to English.",
                        });
                        router.refresh();
                      }}
                      aria-label={isId ? "Bahasa antarmuka" : "Interface language"}
                      className={fieldClassName}
                    >
                      <option value="id">{dict.common.indonesian} (id-ID)</option>
                      <option value="en">{dict.common.english} (en-US)</option>
                    </select>
                  </div>
                </div>
              </SettingRow>

              {/* Row 5: Reporting Options */}
              <SettingRow
                label={isId ? "Standar pelaporan" : "Reporting options"}
                hint={
                  isId
                    ? "Parameter baku untuk agregasi metrik iklan dan CRM."
                    : "Default parameters for ad metrics and CRM attribution."
                }
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-indigo-500 text-zinc-950 dark:bg-indigo-400 dark:text-zinc-950">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </span>
                      <span className="text-[13px] text-zinc-700 dark:text-zinc-300">
                        {isId ? "Zona waktu pelaporan harian" : "Daily reporting timezone"}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-md border border-zinc-200 bg-white px-2.5 py-1 font-mono text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                      Asia/Jakarta
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-indigo-500 text-zinc-950 dark:bg-indigo-400 dark:text-zinc-950">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </span>
                      <span className="text-[13px] text-zinc-700 dark:text-zinc-300">
                        {isId ? "Mata uang evaluasi biaya (Spend, CPR, CPQL)" : "Cost evaluation currency (Spend, CPR, CPQL)"}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-md border border-zinc-200 bg-white px-2.5 py-1 font-mono text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                      IDR (Rp)
                    </span>
                  </div>
                </div>
              </SettingRow>

              <PanelFooter
                hint={
                  isProfileDirty
                    ? isId
                      ? "Ada perubahan yang belum disimpan."
                      : "You have unsaved changes."
                    : isId
                      ? "Seluruh perubahan tersinkron dengan profil organisasi."
                      : "Changes sync directly with your organization profile."
                }
              >
                {isProfileDirty ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFullName(savedFullName);
                      setCompanyName(savedCompanyName);
                      setEmail(user?.email || "");
                    }}
                    disabled={busy !== null}
                  >
                    Reset
                  </Button>
                ) : null}
                <Button type="submit" disabled={busy !== null || loading} isLoading={busy === "profile"}>
                  {isId ? "Simpan Perubahan" : "Save Changes"}
                </Button>
              </PanelFooter>
            </Panel>
          </form>
        ) : null}

        {/* ===================================================================
            TAB 2: WHATSAPP CONNECTIONS
           =================================================================== */}
        {activeTab === "whatsapp" ? (
          <Panel>
            <SettingRow
              label={isId ? "Kapasitas Koneksi" : "Connection Capacity"}
              hint={
                isId
                  ? "Starter 1 nomor, Standard 3 nomor, Premium 5 nomor."
                  : "Starter 1 number, Standard 3 numbers, Premium 5 numbers."
              }
            >
              {whatsappLoading ? (
                <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" role="status" />
              ) : whatsappError ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                  <span>{whatsappError}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void loadWhatsapp()}>
                    {isId ? "Coba lagi" : "Retry"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {waQuota
                        ? isId
                          ? `${waQuota.connected_count} dari ${waQuota.max_whatsapp_connections} koneksi terpakai`
                          : `${waQuota.connected_count} of ${waQuota.max_whatsapp_connections} connections used`
                        : "—"}
                    </span>
                    {waQuota ? (
                      <StatusPill tone="good" dot>
                        {waQuota.plan.toUpperCase()} · {waQuota.subscription_status}
                      </StatusPill>
                    ) : null}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        quotaFull ? "bg-rose-500" : "bg-indigo-500 dark:bg-indigo-400"
                      }`}
                      style={{ width: `${waQuota ? Math.max(waPercent, waQuota.connected_count > 0 ? 12 : 4) : 0}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 pt-1 min-[420px]:grid-cols-3">
                    {PLAN_ALLOWANCES.map((plan) => {
                      const current = waQuota?.plan?.toLowerCase() === plan.id;
                      return (
                        <div
                          key={plan.id}
                          className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                            current
                              ? "border-indigo-500/60 bg-indigo-50/70 font-semibold text-zinc-950 dark:border-indigo-400/50 dark:bg-indigo-950/30 dark:text-zinc-50"
                              : "border-zinc-200/80 bg-zinc-50/40 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{plan.name}</span>
                            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                              {plan.connections}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </SettingRow>

            <SettingRow
              label={isId ? "Nomor Terhubung" : "Connected Numbers"}
              hint={
                isId
                  ? "Kelola sesi nomor WhatsApp Business tim sales Anda."
                  : "Manage your sales team's WhatsApp Business numbers."
              }
            >
              {whatsappLoading ? (
                <div className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" role="status" />
              ) : waConnections.length === 0 ? (
                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                    {isId ? "Belum ada nomor WhatsApp terhubung" : "No WhatsApp numbers connected yet"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {isId
                      ? "Hubungkan nomor WhatsApp Business melalui alur Meta Embedded Signup (Coexistence)."
                      : "Connect a WhatsApp Business number via Meta Embedded Signup (Coexistence)."}
                  </p>
                  {canManage && !quotaFull ? (
                    <div className="mt-3">
                      <Link
                        href="/connections"
                        className="btn-solar inline-flex h-8 items-center rounded-lg px-3.5 text-xs font-semibold"
                      >
                        {isId ? "Hubungkan Nomor WhatsApp →" : "Connect WhatsApp Number →"}
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="divide-y divide-zinc-200/75 rounded-xl border border-zinc-200/90 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/40">
                  {waConnections.map((item) => {
                    const needsReconnect =
                      item.connection_status === "disconnected" ||
                      item.connection_status === "error" ||
                      item.connection_status === "reconnect_required";
                    return (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[13px] font-semibold text-zinc-950 dark:text-zinc-50">
                              {item.verified_name || item.display_phone_number || item.phone_number_id}
                            </p>
                            <StatusPill tone={connectionTone(item)} dot>
                              {connectionLabel(item, isId)}
                            </StatusPill>
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {item.display_phone_number || item.phone_number_id} ·{" "}
                            {item.sales_member_id
                              ? isId
                                ? "Sales ditetapkan"
                                : "Sales assigned"
                              : isId
                                ? "Sales belum ditetapkan"
                                : "Sales unassigned"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {needsReconnect && canManage ? (
                            <Link
                              href="/connections"
                              className="inline-flex h-8 items-center rounded-lg border border-zinc-200 px-2.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                            >
                              {isId ? "Sambungkan ulang" : "Reconnect"}
                            </Link>
                          ) : null}
                          {item.connection_status === "connected" && canManage ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setDisconnectTarget(item)}
                              disabled={disconnectingId === item.id}
                              className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                            >
                              {isId ? "Putuskan" : "Disconnect"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SettingRow>

            <PanelFooter
              hint={
                isId
                  ? "Buka halaman Koneksi WhatsApp di sidebar untuk pendaftaran lengkap."
                  : "Open WhatsApp Connections in the sidebar for full onboarding."
              }
            >
              <Link
                href="/connections"
                className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {isId ? "Buka Halaman Koneksi →" : "Open Connections Page →"}
              </Link>
            </PanelFooter>
          </Panel>
        ) : null}

        {/* ===================================================================
            TAB 3: META ADS & INTEGRATIONS
           =================================================================== */}
        {activeTab === "meta" ? (
          <div className="space-y-6">
            <MetaAssetOnboarding />

            <Panel>
              <SettingRow
                label={isId ? "Status Adapter Sistem" : "System Adapter Status"}
                hint={
                  isId
                    ? "Konektor layanan eksternal dan basis data organisasi."
                    : "External service connectors and organization database."
                }
              >
                {integrationsLoading ? (
                  <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" role="status" />
                ) : (
                  <div className="space-y-2.5">
                    {integrations.map((item) => (
                      <div
                        key={item.provider}
                        className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/50"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{item.name}</p>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{item.details}</p>
                        </div>
                        <StatusPill tone={integrationTone(item.status)} dot>
                          {integrationLabel(item.status, isId)}
                        </StatusPill>
                      </div>
                    ))}
                  </div>
                )}
              </SettingRow>
            </Panel>
          </div>
        ) : null}

        {/* ===================================================================
            TAB 4: PLAN & QUOTA
           =================================================================== */}
        {activeTab === "subscription" ? (
          <Panel>
            <SettingRow
              label={isId ? "Paket Langganan WhatsApp" : "WhatsApp Subscription Plan"}
              hint={
                isId
                  ? "Kuota nomor WhatsApp Business pada workspace aktif."
                  : "WhatsApp Business connection quota for the active workspace."
              }
            >
              <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-3">
                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{isId ? "Paket" : "Plan"}</p>
                  <p className="mt-0.5 text-sm font-semibold capitalize text-zinc-950 dark:text-zinc-50">
                    {waQuota?.plan || "Starter"}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Status</p>
                  <p className="mt-0.5 text-sm font-semibold capitalize text-zinc-950 dark:text-zinc-50">
                    {waQuota?.subscription_status || "active"}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{isId ? "Terpakai" : "Used"}</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {waQuota ? `${waQuota.connected_count} / ${waQuota.max_whatsapp_connections}` : "—"}
                  </p>
                </div>
              </div>
            </SettingRow>

            <SettingRow
              label={isId ? "Kuota Analisis AI (7 Hari)" : "AI Analysis Quota (7-Day)"}
              hint={
                isId
                  ? "3 analisis mendalam berhasil per jendela 7 hari."
                  : "3 successful deep analyses per rolling 7-day window."
              }
            >
              {quotaEnabled === false ? (
                <StatusPill tone="info">{isId ? "Tanpa batas" : "Unlimited"}</StatusPill>
              ) : !quota ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {loading ? (isId ? "Memuat kuota…" : "Loading quota…") : isId ? "Tidak tersedia." : "Unavailable."}
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                    <span>
                      {isId
                        ? `${quota.used + quota.reserved} dari ${quota.limit} analisis terpakai`
                        : `${quota.used + quota.reserved} of ${quota.limit} analyses used`}
                    </span>
                    <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {isId ? "Reset" : "Resets"}: {fmt(quota.resetAt)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
                      style={{ width: `${Math.max(usagePercent, usagePercent > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: isId ? "Batas" : "Limit", val: quota.limit },
                      { label: isId ? "Selesai" : "Used", val: quota.used },
                      { label: isId ? "Diproses" : "Reserved", val: quota.reserved },
                      { label: isId ? "Sisa" : "Remaining", val: quota.remaining },
                    ].map((cell) => (
                      <div
                        key={cell.label}
                        className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50"
                      >
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{cell.label}</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {cell.val}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SettingRow>
          </Panel>
        ) : null}

        {/* ===================================================================
            TAB 5: SECURITY & PRIVACY
           =================================================================== */}
        {activeTab === "security" ? (
          <form onSubmit={updatePassword}>
            <Panel>
              <SettingRow
                label={isId ? "Password saat ini" : "Current password"}
                htmlFor="current-pw"
                hint={isId ? "Verifikasi identitas akun Anda." : "Verify your current identity."}
              >
                <input
                  id="current-pw"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className={fieldClassName}
                />
              </SettingRow>

              <SettingRow
                label={isId ? "Password baru" : "New password"}
                htmlFor="new-pw"
                hint={isId ? "Minimal 8 karakter." : "Minimum 8 characters."}
              >
                <input
                  id="new-pw"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className={fieldClassName}
                />
              </SettingRow>

              <SettingRow label={isId ? "Konfirmasi password" : "Confirm password"} htmlFor="confirm-pw">
                <input
                  id="confirm-pw"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={fieldClassName}
                />
                <div className="mt-3 flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(event) => setShowPassword(event.target.checked)}
                      className="h-3.5 w-3.5 rounded border-zinc-300 accent-indigo-500 dark:border-zinc-700"
                    />
                    <span>{isId ? "Tampilkan password" : "Show password"}</span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {isId ? "Lupa password?" : "Forgot password?"}
                  </Link>
                </div>
              </SettingRow>

              <SettingRow
                label={isId ? "Privasi & Dokumen Hukum" : "Privacy & Legal"}
                hint={
                  isId
                    ? "Isolasi data RLS, kebijakan privasi, dan prosedur penghapusan data."
                    : "RLS data isolation, privacy policy, and data deletion instructions."
                }
              >
                <div className="space-y-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <p className="leading-5">{dict.settings.serverOnlyDesc}</p>
                  <div className="flex flex-wrap gap-4 pt-1 font-medium text-indigo-600 dark:text-indigo-400">
                    <Link href="/privacy" className="hover:underline">
                      {isId ? "Kebijakan Privasi →" : "Privacy Policy →"}
                    </Link>
                    <Link href="/terms" className="hover:underline">
                      {isId ? "Ketentuan Layanan →" : "Terms of Service →"}
                    </Link>
                    <Link href="/data-deletion" className="hover:underline">
                      {isId ? "Penghapusan Data →" : "Data Deletion →"}
                    </Link>
                  </div>
                </div>
              </SettingRow>

              <PanelFooter>
                <Button type="submit" disabled={busy !== null} isLoading={busy === "password"}>
                  {isId ? "Perbarui Password" : "Update Password"}
                </Button>
              </PanelFooter>
            </Panel>
          </form>
        ) : null}
      </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(disconnectTarget)}
        onClose={() => {
          if (disconnectingId === null) setDisconnectTarget(null);
        }}
        onConfirm={() => void confirmDisconnect()}
        title={isId ? "Putuskan koneksi WhatsApp?" : "Disconnect this WhatsApp number?"}
        description={
          disconnectTarget
            ? isId
              ? `Nomor ${disconnectTarget.display_phone_number || disconnectTarget.phone_number_id} akan diputuskan dan token aksesnya dihapus. Percakapan, lead, dan analisis tetap ada.`
              : `${disconnectTarget.display_phone_number || disconnectTarget.phone_number_id} will be disconnected and its access token removed. Conversations, leads, and analyses stay.`
            : undefined
        }
        confirmText={isId ? "Putuskan" : "Disconnect"}
        cancelText={isId ? "Batal" : "Cancel"}
        variant="danger"
        isLoading={disconnectingId !== null}
      />
    </div>
  );
}
