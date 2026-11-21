"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EMBEDDED_SIGNUP_EXTRAS } from "@/lib/meta/embedded-signup-launch";

type ConnectionHealthStatus =
  | "healthy"
  | "warning_inactive"
  | "disconnected"
  | "pending"
  | "error";

type SignupStep = "idle" | "popup" | "saving";

interface WhatsAppConnectionItem {
  id: string;
  workspace_id: string | null;
  sales_member_id: string | null;
  phone_number_id: string;
  waba_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  connection_status: string;
  integration_mode: string;
  last_echo_at: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
  health_status: ConnectionHealthStatus;
  days_since_echo: number | null;
}

interface ConnectionsResponse {
  success: boolean;
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
  userRole?: "owner" | "admin" | "sales" | "viewer";
  quota?: {
    connected_count: number;
    max_whatsapp_connections: number;
    plan: string;
    subscription_status: string;
  };
  connections?: WhatsAppConnectionItem[];
  error?: string;
}

interface FacebookLoginResponse {
  authResponse?: {
    code?: string;
  };
  status?: string;
}

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (params: {
        appId: string;
        autoLogAppEvents?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options: {
          config_id: string;
          response_type: "code";
          override_default_response_type: boolean;
          extras: typeof EMBEDDED_SIGNUP_EXTRAS;
        }
      ) => void;
    };
  }
}

const META_APP_ID = (process.env.NEXT_PUBLIC_META_APP_ID ?? "").trim();
const META_CONFIG_ID = (process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID ?? "").trim();
const META_GRAPH_VERSION =
  (process.env.NEXT_PUBLIC_META_GRAPH_API_VERSION ?? "v27.0").trim() || "v27.0";

const TRUSTED_FACEBOOK_ORIGINS = new Set([
  "https://www.facebook.com",
  "https://web.facebook.com",
  "https://business.facebook.com",
]);

function isTrustedFacebookOrigin(origin: string): boolean {
  if (TRUSTED_FACEBOOK_ORIGINS.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === "facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale === "id" ? "id-ID" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadgeConfig(
  item: WhatsAppConnectionItem,
  isId: boolean
): { label: string; className: string; dotClassName: string } {
  if (item.health_status === "warning_inactive") {
    return {
      label: isId ? "Perlu Aktivitas HP" : "Check Phone App",
      className:
        "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      dotClassName: "bg-amber-500",
    };
  }
  if (item.connection_status === "connected") {
    return {
      label: isId ? "Terhubung" : "Connected",
      className:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      dotClassName: "bg-emerald-500",
    };
  }
  if (item.connection_status === "pending" || item.connection_status === "connecting") {
    return {
      label: isId ? "Menunggu" : "Pending",
      className:
        "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
      dotClassName: "bg-blue-500",
    };
  }
  if (item.connection_status === "error" || item.connection_status === "reconnect_required") {
    return {
      label: isId ? "Perlu Koneksi Ulang" : "Reconnect Required",
      className:
        "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      dotClassName: "bg-rose-500",
    };
  }
  return {
    label: isId ? "Terputus" : "Disconnected",
    className:
      "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    dotClassName: "bg-zinc-400",
  };
}

function WhatsAppIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </svg>
  );
}

export default function WhatsAppConnectionsPage() {
  const { locale } = useI18n();
  const toast = useToast();
  const isId = locale === "id";

  const [data, setData] = useState<ConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [signupStep, setSignupStep] = useState<SignupStep>("idle");
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [confirmDisconnectItem, setConfirmDisconnectItem] =
    useState<WhatsAppConnectionItem | null>(null);
  const [showDisclosure, setShowDisclosure] = useState(false);

  const pendingSignupRef = useRef<{
    code: string | null;
    phoneNumberId: string | null;
    wabaId: string | null;
    submitted: boolean;
  }>({
    code: null,
    phoneNumberId: null,
    wabaId: null,
    submitted: false,
  });

  const resetPendingSignup = useCallback(() => {
    setSignupStep("idle");
    pendingSignupRef.current = {
      code: null,
      phoneNumberId: null,
      wabaId: null,
      submitted: false,
    };
  }, []);

  const loadConnections = useCallback(
    async (options?: { manual?: boolean }) => {
      const isManual = Boolean(options?.manual);
      if (isManual) setRefreshing(true);

      try {
        const res = await fetch("/api/whatsapp/connections", { cache: "no-store" });
        const json = (await res.json()) as ConnectionsResponse;
        if (!res.ok || !json.success) {
          const errMsg =
            json.error ||
            (isId ? "Gagal memuat daftar koneksi WhatsApp." : "Failed to load WhatsApp connections.");
          setLoadError(errMsg);
          toast.error(errMsg, isId ? "Gagal Memuat Data" : "Failed to Load");
        } else {
          setLoadError(null);
          setData(json);
          if (isManual) {
            toast.success(
              isId ? "Daftar koneksi WhatsApp diperbarui." : "WhatsApp connections refreshed.",
              isId ? "Data Diperbarui" : "Refreshed",
              2500
            );
          }
        }
      } catch {
        const netErr = isId
          ? "Terjadi kesalahan jaringan saat memuat koneksi."
          : "Network error while loading connections.";
        setLoadError(netErr);
        toast.error(netErr, isId ? "Koneksi Bermasalah" : "Network Error");
      } finally {
        setLoading(false);
        if (isManual) setRefreshing(false);
      }
    },
    [isId, toast]
  );

  useEffect(() => {
    let cancelled = false;
    async function fetchInitial() {
      try {
        const res = await fetch("/api/whatsapp/connections", { cache: "no-store" });
        const json = (await res.json()) as ConnectionsResponse;
        if (cancelled) return;
        if (!res.ok || !json.success) {
          const errMsg =
            json.error ||
            (isId ? "Gagal memuat daftar koneksi WhatsApp." : "Failed to load WhatsApp connections.");
          setLoadError(errMsg);
          toast.error(errMsg, isId ? "Gagal Memuat Data" : "Failed to Load");
        } else {
          setLoadError(null);
          setData(json);
        }
      } catch {
        if (!cancelled) {
          const netErr = isId
            ? "Terjadi kesalahan jaringan saat memuat koneksi."
            : "Network error while loading connections.";
          setLoadError(netErr);
          toast.error(netErr, isId ? "Koneksi Bermasalah" : "Network Error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void fetchInitial();
    return () => {
      cancelled = true;
    };
  }, [isId, toast]);

  const tryFinalizeSignup = useCallback(async () => {
    const state = pendingSignupRef.current;
    const workspaceId = data?.workspace?.id;
    if (state.submitted || !workspaceId || !state.code || !state.wabaId) {
      return;
    }

    state.submitted = true;
    setSignupStep("saving");

    try {
      const res = await fetch("/api/whatsapp/embedded-signup/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          code: state.code,
          ...(state.phoneNumberId ? { phoneNumberId: state.phoneNumberId } : {}),
          wabaId: state.wabaId,
          integrationMode: "coexistence",
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; syncWarnings?: string[] };

      if (!res.ok || !json.success) {
        toast.error(
          json.error ||
            (isId
              ? "Gagal menyelesaikan onboarding WhatsApp Business."
              : "Failed to complete WhatsApp Business onboarding."),
          isId ? "Gagal Menghubungkan" : "Connection Failed"
        );
      } else {
        toast.success(
          isId
            ? "WhatsApp Business Sales berhasil terhubung. Chat & balasan HP kini tersinkronisasi otomatis."
            : "Sales WhatsApp Business connected successfully. Chats & mobile replies now sync automatically.",
          isId ? "WhatsApp Terhubung" : "WhatsApp Connected"
        );
        if (json.syncWarnings && json.syncWarnings.length > 0) {
          toast.warning(json.syncWarnings.join(" "), isId ? "Sinkronisasi belum lengkap" : "Sync incomplete");
        }
        await loadConnections();
      }
    } catch {
      toast.error(
        isId
          ? "Gagal menghubungi server saat menyimpan koneksi WhatsApp."
          : "Failed to reach server while saving WhatsApp connection.",
        isId ? "Kesalahan Server" : "Server Error"
      );
    } finally {
      resetPendingSignup();
    }
  }, [data?.workspace?.id, isId, loadConnections, resetPendingSignup, toast]);

  // Embedded Signup v5 posts WA_EMBEDDED_SIGNUP. Coexistence uses
  // messaging_account_ids; older payloads still send waba_id.
  useEffect(() => {
    function handleMetaMessage(event: MessageEvent) {
      if (!isTrustedFacebookOrigin(event.origin)) return;

      let payload: unknown = event.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (!payload || typeof payload !== "object") return;
      const msg = payload as {
        type?: string;
        event?: string;
        data?: {
          phone_number_id?: string;
          waba_id?: string;
          messaging_account_ids?: string[];
          error_message?: string;
        };
      };

      if (msg.type !== "WA_EMBEDDED_SIGNUP") return;

      if (msg.event === "CANCEL" || msg.event === "ERROR") {
        resetPendingSignup();
        if (msg.event === "ERROR") {
          toast.error(
            msg.data?.error_message ||
              (isId
                ? "Terjadi kesalahan pada alur Meta Embedded Signup. Silakan coba lagi."
                : "An error occurred during Meta Embedded Signup. Please try again."),
            isId ? "Otorisasi Meta Gagal" : "Meta Signup Error"
          );
        } else {
          toast.info(
            isId
              ? "Proses menghubungkan WhatsApp dibatalkan."
              : "WhatsApp connection flow was canceled.",
            isId ? "Koneksi Dibatalkan" : "Canceled"
          );
        }
        return;
      }

      const messagingAccountId =
        msg.data?.waba_id ||
        (Array.isArray(msg.data?.messaging_account_ids) ? msg.data.messaging_account_ids.find(Boolean) : undefined);
      const isFinishEvent =
        msg.event === "FINISH" ||
        msg.event === "FINISH_ONLY_WABA" ||
        msg.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" ||
        Boolean(msg.data?.phone_number_id && messagingAccountId);

      if (!isFinishEvent) return;

      if (messagingAccountId) {
        pendingSignupRef.current.wabaId = String(messagingAccountId);
      }
      if (msg.data?.phone_number_id) {
        pendingSignupRef.current.phoneNumberId = String(msg.data.phone_number_id);
      }

      if (pendingSignupRef.current.wabaId) {
        void tryFinalizeSignup();
      }
    }

    window.addEventListener("message", handleMetaMessage);
    return () => window.removeEventListener("message", handleMetaMessage);
  }, [isId, resetPendingSignup, toast, tryFinalizeSignup]);

  const initFacebookSdk = useCallback(() => {
    if (!META_APP_ID || typeof window === "undefined" || !window.FB) return;
    window.FB.init({
      appId: META_APP_ID,
      autoLogAppEvents: true,
      xfbml: true,
      version: META_GRAPH_VERSION,
    });
    setSdkReady(true);
  }, []);

  useEffect(() => {
    if (!META_APP_ID) return;
    window.fbAsyncInit = initFacebookSdk;
    if (window.FB) {
      queueMicrotask(initFacebookSdk);
    }
  }, [initFacebookSdk]);

  const handleLaunchEmbeddedSignup = () => {
    if (!META_APP_ID || !META_CONFIG_ID) {
      toast.error(
        isId
          ? "Konfigurasi Meta Embedded Signup belum tersedia. Hubungi administrator workspace."
          : "Meta Embedded Signup configuration is missing. Contact your workspace administrator.",
        isId ? "Konfigurasi Belum Lengkap" : "Configuration Missing"
      );
      return;
    }

    if (typeof window !== "undefined" && window.location.protocol !== "https:") {
      toast.warning(
        isId
          ? "Popup otorisasi WhatsApp membutuhkan halaman HTTPS yang aman agar dapat dibuka."
          : "WhatsApp authorization popup requires a secure HTTPS page to open.",
        isId ? "Koneksi Aman Diperlukan" : "Secure Connection Required"
      );
      return;
    }

    if (!window.FB) {
      toast.info(
        isId
          ? "Meta SDK masih dimuat. Tunggu beberapa detik lalu klik tombol kembali."
          : "Meta SDK is still loading. Please wait a few seconds and try again.",
        isId ? "Menyiapkan SDK" : "Loading SDK"
      );
      return;
    }

    pendingSignupRef.current = {
      code: null,
      phoneNumberId: null,
      wabaId: null,
      submitted: false,
    };
    setSignupStep("popup");

    try {
      window.FB.login(
        (response: FacebookLoginResponse) => {
          const code = response?.authResponse?.code;
          if (!code) {
            resetPendingSignup();
            toast.info(
              isId
                ? "Popup ditutup sebelum otorisasi selesai."
                : "Popup closed before authorization completed.",
              isId ? "Koneksi Dibatalkan" : "Connection Canceled"
            );
            return;
          }
          pendingSignupRef.current.code = code;
          void tryFinalizeSignup();
        },
        {
          config_id: META_CONFIG_ID,
          response_type: "code",
          override_default_response_type: true,
          extras: EMBEDDED_SIGNUP_EXTRAS,
        }
      );
    } catch {
      resetPendingSignup();
      toast.error(
        isId
          ? "Gagal membuka popup otorisasi Meta. Pastikan pop-up diizinkan pada browser ini."
          : "Failed to open Meta authorization popup. Make sure pop-ups are allowed.",
        isId ? "Popup Diblokir" : "Popup Blocked"
      );
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!confirmDisconnectItem) return;
    const target = confirmDisconnectItem;
    setDisconnectingId(target.id);

    try {
      const res = await fetch(`/api/whatsapp/connections/${target.id}/disconnect`, {
        method: "POST",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast.error(
          json.error ||
            (isId ? "Gagal memutuskan koneksi nomor WhatsApp." : "Failed to disconnect number."),
          isId ? "Gagal Memutuskan Koneksi" : "Disconnect Failed"
        );
      } else {
        toast.success(
          isId
            ? `Nomor ${
                target.display_phone_number || target.phone_number_id
              } diputuskan. Data percakapan & analisis lead tetap tersimpan.`
            : `Number ${
                target.display_phone_number || target.phone_number_id
              } disconnected. Historical conversations & lead analyses are preserved.`,
          isId ? "Koneksi Diputuskan" : "Disconnected"
        );
        await loadConnections();
      }
    } catch {
      toast.error(
        isId
          ? "Gagal menghubungi server saat memutuskan koneksi."
          : "Network error while disconnecting number.",
        isId ? "Kesalahan Jaringan" : "Network Error"
      );
    } finally {
      setDisconnectingId(null);
      setConfirmDisconnectItem(null);
    }
  };

  const handleCopyPhoneId = async (phoneNumberId: string) => {
    try {
      await navigator.clipboard.writeText(phoneNumberId);
      toast.success(
        isId ? `Phone ID ${phoneNumberId} disalin ke clipboard.` : `Phone ID ${phoneNumberId} copied.`,
        isId ? "Disalin" : "Copied",
        2500
      );
    } catch {
      toast.error(isId ? "Gagal menyalin ke clipboard." : "Failed to copy to clipboard.");
    }
  };

  const canManageConnections = data?.userRole === "owner" || data?.userRole === "admin";
  const connections = data?.connections ?? [];
  const quota = data?.quota ?? {
    connected_count: 0,
    max_whatsapp_connections: 1,
    plan: "starter",
    subscription_status: "active",
  };
  const isQuotaFull = quota.connected_count >= quota.max_whatsapp_connections;
  const quotaPct = Math.min(
    100,
    Math.round((quota.connected_count / Math.max(1, quota.max_whatsapp_connections)) * 100)
  );
  const envConfigured = Boolean(META_APP_ID && META_CONFIG_ID);
  const connecting = signupStep !== "idle";

  const healthyCount = connections.filter(
    (c) => c.connection_status === "connected" && c.health_status === "healthy"
  ).length;
  const warningCount = connections.filter((c) => c.health_status === "warning_inactive").length;

  return (
    <div className="space-y-6">
      {META_APP_ID && (
        <Script
          src="https://connect.facebook.net/en_US/sdk.js"
          strategy="afterInteractive"
          onLoad={initFacebookSdk}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {isId ? "Koneksi WhatsApp Business" : "WhatsApp Business Connections"}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Coexistence · Analysis-Only
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {isId
              ? "Hubungkan WhatsApp Business App sales untuk melacak lead iklan Meta, SLA respons, dan skor AI tanpa mengganggu chat di HP."
              : "Connect sales WhatsApp Business App numbers to track Meta ad attribution, response SLAs, and AI scoring without leaving the phone app."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data?.workspace && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-[var(--shadow-card)] dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">Workspace</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {data.workspace.name}
              </span>
              {data.userRole && (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {data.userRole}
                </span>
              )}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadConnections({ manual: true })}
            isLoading={refreshing}
            disabled={loading}
          >
            {isId ? "Muat Ulang" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Inline Load Error Recovery Banner */}
      {loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-800 dark:text-rose-200"
        >
          <span>{loadError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadConnections({ manual: true })}
            isLoading={refreshing}
          >
            {isId ? "Coba Lagi" : "Retry"}
          </Button>
        </div>
      )}

      {/* Primary Two-Column Layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Onboarding Card */}
        <section className="lg:col-span-7 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <WhatsAppIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {isId
                      ? "Hubungkan WhatsApp Business Sales (Coexistence)"
                      : "Connect Sales WhatsApp Business (Coexistence)"}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {isId
                      ? "Ikuti 3 langkah singkat berikut saat popup Meta terbuka."
                      : "Follow these 3 quick steps when the Meta popup opens."}
                  </p>
                </div>
              </div>
            </div>

            {/* Scannable 3-Step Guide */}
            <ol className="space-y-2.5">
              <li className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/40">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  1
                </span>
                <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {isId ? (
                    <>
                      Nomor wajib aktif di <strong>WhatsApp Business App</strong> versi terbaru
                      (bukan WhatsApp Messenger biasa).
                    </>
                  ) : (
                    <>
                      The number must be active on the latest{" "}
                      <strong>WhatsApp Business App</strong> (not standard WhatsApp Messenger).
                    </>
                  )}
                </p>
              </li>

              <li className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/40">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  2
                </span>
                <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {isId
                    ? "HP Sales tetap bisa dipakai balas chat normal seperti biasa (tidak logout / tidak pindah ke WA API)."
                    : "The sales phone continues replying to chats normally (no logout / no migration to standalone Cloud API)."}
                </p>
              </li>

              <li className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/40">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  3
                </span>
                <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {isId ? (
                    <>
                      Saat popup Meta muncul, pilih{" "}
                      <strong>&ldquo;Connect your existing WhatsApp Business App&rdquo;</strong>{" "}
                      lalu scan QR dari menu <strong>Perangkat Tertaut (Linked Devices)</strong> di
                      HP Sales.
                    </>
                  ) : (
                    <>
                      When the Meta popup opens, select{" "}
                      <strong>&ldquo;Connect your existing WhatsApp Business App&rdquo;</strong> and
                      scan the QR code from <strong>Linked Devices</strong> on the sales phone.
                    </>
                  )}
                </p>
              </li>
            </ol>

            {/* Collapsible Data Transparency Disclosure */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/30">
              <button
                type="button"
                onClick={() => setShowDisclosure((prev) => !prev)}
                aria-expanded={showDisclosure}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 cursor-pointer"
              >
                <span>
                  {isId
                    ? "Transparansi Izin Data & Privasi (Analysis-Only)"
                    : "Data Permissions & Privacy Disclosure (Analysis-Only)"}
                </span>
                <svg
                  className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-150 ${
                    showDisclosure ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {showDisclosure && (
                <ul className="space-y-1.5 border-t border-zinc-200/80 px-3.5 py-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  <li>
                    •{" "}
                    {isId
                      ? "Hanya membaca metadata & isi percakapan Click-to-WhatsApp (CTWA) untuk atribusi iklan, SLA respons, dan klasifikasi pipeline."
                      : "Strictly reads Click-to-WhatsApp (CTWA) conversation metadata & messages for attribution, response SLAs, and pipeline scoring."}
                  </li>
                  <li>
                    •{" "}
                    {isId
                      ? "Sistem TIDAK mengirim pesan keluar, tidak melakukan broadcast, dan tidak mengaktifkan auto-reply/chatbot."
                      : "This app NEVER sends outbound messages, broadcasts, or automated chatbot replies."}
                  </li>
                  <li>
                    •{" "}
                    {isId
                      ? "Anda dapat memutuskan koneksi kapan saja untuk mencabut dan menghapus access token secara permanen."
                      : "You can disconnect anytime to permanently revoke and delete stored access tokens."}
                  </li>
                </ul>
              )}
            </div>
          </div>

          {/* Active Flow Indicator + Primary CTA */}
          <div className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            {connecting && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  {signupStep === "saving"
                    ? isId
                      ? "Menyimpan koneksi & mengaktifkan webhook WABA..."
                      : "Saving connection & activating WABA webhook..."
                    : isId
                      ? "Popup Meta aktif — selesaikan pilihan & scan QR di jendela popup."
                      : "Meta popup active — complete the steps and scan the QR code in the popup."}
                </span>
                {signupStep === "popup" && (
                  <button
                    type="button"
                    onClick={() => {
                      resetPendingSignup();
                      toast.info(
                        isId ? "Status koneksi direset." : "Connection flow reset.",
                        undefined,
                        2500
                      );
                    }}
                    className="font-semibold underline hover:no-underline cursor-pointer"
                  >
                    {isId ? "Batalkan" : "Cancel"}
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {!canManageConnections && !loading
                  ? isId
                    ? "Hanya role owner atau admin workspace yang dapat menghubungkan nomor."
                    : "Only workspace owners or admins can connect WhatsApp numbers."
                  : !envConfigured
                    ? isId
                      ? "Konfigurasi Meta Embedded Signup belum aktif di workspace ini."
                      : "Meta Embedded Signup configuration is not active yet."
                    : sdkReady
                      ? isId
                        ? "Siap dihubungkan — nomor tetap aktif di HP sales."
                        : "Ready to connect — your sales phone remains active."
                      : isId
                        ? "Menyiapkan Meta Embedded Signup SDK..."
                        : "Preparing Meta Embedded Signup SDK..."}
              </p>

              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={handleLaunchEmbeddedSignup}
                isLoading={connecting}
                leftIcon={<WhatsAppIcon className="h-4 w-4" />}
                disabled={
                  loading ||
                  connecting ||
                  !canManageConnections ||
                  isQuotaFull ||
                  !envConfigured
                }
                className="w-full sm:w-auto shrink-0"
              >
                {signupStep === "saving"
                  ? isId
                    ? "Menyimpan Koneksi..."
                    : "Saving Connection..."
                  : signupStep === "popup"
                    ? isId
                      ? "Menunggu Popup Meta..."
                      : "Waiting for Meta Popup..."
                    : isId
                      ? "Hubungkan WhatsApp Business"
                      : "Connect WhatsApp Business"}
              </Button>
            </div>
          </div>
        </section>

        {/* Quota & Diagnostics Summary Card */}
        <aside className="lg:col-span-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-[var(--shadow-card)] dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {isId ? "Kuota & Kesehatan Koneksi" : "Quota & Connection Health"}
                </p>
                <p className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {quota.connected_count}{" "}
                  <span className="text-base font-normal text-zinc-400 dark:text-zinc-500">
                    / {quota.max_whatsapp_connections}
                  </span>{" "}
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {isId ? "nomor aktif" : "active numbers"}
                  </span>
                </p>
              </div>
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {quota.plan}
              </span>
            </div>

            <div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isQuotaFull ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${quotaPct}%` }}
                />
              </div>
              {isQuotaFull && (
                <p className="mt-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  {isId
                    ? `Kuota paket ${quota.plan} (${quota.max_whatsapp_connections} nomor) sudah penuh. Putuskan nomor lama atau upgrade paket untuk menambah nomor baru.`
                    : `Your ${quota.plan} plan limit (${quota.max_whatsapp_connections} active numbers) is full. Disconnect a number or upgrade to add more.`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {isId ? "Sinkronisasi Sehat" : "Healthy Sync"}
                </p>
                <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {healthyCount}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {isId ? "Perlu Perhatian" : "Needs Attention"}
                </p>
                <p
                  className={`mt-1 text-lg font-bold ${
                    warningCount > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {warningCount}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
            <p className="font-semibold text-zinc-800 dark:text-zinc-200">
              {isId ? "Tips Menjaga Coexistence Aktif" : "Keep Coexistence Active"}
            </p>
            <p className="mt-1">
              {isId
                ? "Pastikan aplikasi WhatsApp Business di HP sales tetap dibuka setidaknya 1× setiap 14 hari agar tautan perangkat dari Meta tetap aktif."
                : "Open WhatsApp Business on the sales phone at least once every 14 days so Meta keeps the linked session active."}
            </p>
          </div>
        </aside>
      </div>

      {/* Connections List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {isId ? "Nomor WhatsApp Terdaftar" : "Registered WhatsApp Numbers"}
            </h2>
            {!loading && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {connections.length}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1].map((idx) => (
              <div
                key={idx}
                className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-3 w-28 rounded bg-zinc-100 dark:bg-zinc-800/70" />
                  </div>
                  <div className="h-5 w-20 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800/60" />
                  <div className="h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800/60" />
                </div>
              </div>
            ))}
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <WhatsAppIcon className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {isId
                ? "Belum ada nomor WhatsApp Business yang terhubung"
                : "No WhatsApp Business numbers connected yet"}
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500 dark:text-zinc-400">
              {isId
                ? "Klik tombol \"Hubungkan WhatsApp Business\" di atas untuk menautkan nomor WhatsApp Business HP sales ke workspace ini."
                : "Click \"Connect WhatsApp Business\" above to link your sales team's WhatsApp Business mobile app to this workspace."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {connections.map((item) => {
              const isConnected = item.connection_status === "connected";
              const hasInactivityWarning = item.health_status === "warning_inactive";
              const badge = getStatusBadgeConfig(item, isId);

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-[var(--shadow-card)] dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="space-y-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
                          {item.verified_name ||
                            item.display_phone_number ||
                            item.phone_number_id}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {item.display_phone_number || `ID: ${item.phone_number_id}`}
                        </p>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClassName}`} />
                        {badge.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950/60">
                      <div>
                        <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                          Mode
                        </span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {item.integration_mode === "coexistence"
                            ? "Coexistence App"
                            : item.integration_mode}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isId ? "Terakhir Echo" : "Last Echo"}
                        </span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {formatDate(item.last_echo_at, locale)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isId ? "Terhubung Sejak" : "Connected At"}
                        </span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {formatDate(item.connected_at, locale)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                          Phone ID
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopyPhoneId(item.phone_number_id)}
                          title={isId ? "Salin Phone ID" : "Copy Phone ID"}
                          className="inline-flex max-w-full items-center gap-1 font-mono text-[11px] text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white cursor-pointer"
                        >
                          <span className="truncate">{item.phone_number_id}</span>
                        </button>
                      </div>
                    </div>

                    {hasInactivityWarning && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                        {isId
                          ? "Peringatan Coexistence: belum ada echo pesan sales masuk dalam >10 hari (atau >3 hari sejak terhubung). Buka WhatsApp Business App di HP agar sinkronisasi Coexistence tidak terputus otomatis setelah 14 hari inaktif."
                          : "Coexistence warning: no outbound sales echoes detected recently. Open the WhatsApp Business mobile app periodically to avoid Meta's 14-day inactivity unlink."}
                      </div>
                    )}
                  </div>

                  {isConnected && canManageConnections && (
                    <div className="mt-4 flex justify-end border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDisconnectItem(item)}
                        disabled={disconnectingId === item.id}
                        className="border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      >
                        {disconnectingId === item.id
                          ? isId
                            ? "Memutuskan..."
                            : "Disconnecting..."
                          : isId
                            ? "Putuskan Koneksi"
                            : "Disconnect"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Disconnect Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(confirmDisconnectItem)}
        onClose={() => {
          if (disconnectingId === null) setConfirmDisconnectItem(null);
        }}
        onConfirm={() => void handleConfirmDisconnect()}
        title={isId ? "Putuskan Koneksi WhatsApp?" : "Disconnect WhatsApp Number?"}
        description={
          confirmDisconnectItem
            ? isId
              ? `Nomor ${
                  confirmDisconnectItem.display_phone_number ||
                  confirmDisconnectItem.phone_number_id
                } akan diputuskan dan access token dihapus permanen. Data percakapan, lead, dan analisis AI tetap dipertahankan.`
              : `Number ${
                  confirmDisconnectItem.display_phone_number ||
                  confirmDisconnectItem.phone_number_id
                } will be disconnected and its access token permanently removed. Existing conversations, leads, and AI analyses will remain intact.`
            : undefined
        }
        confirmText={isId ? "Ya, Putuskan Koneksi" : "Yes, Disconnect"}
        cancelText={isId ? "Batal" : "Cancel"}
        variant="danger"
        isLoading={disconnectingId !== null}
      />
    </div>
  );
}
