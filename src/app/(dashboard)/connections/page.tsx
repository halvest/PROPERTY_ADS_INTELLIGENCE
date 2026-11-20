"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useI18n } from "@/lib/i18n/I18nProvider";

type ConnectionHealthStatus =
  | "healthy"
  | "warning_inactive"
  | "disconnected"
  | "pending"
  | "error";

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
          extras: {
            feature: "whatsapp_embedded_signup";
            featureType: "whatsapp_business_app_onboarding";
            sessionInfoVersion: "3";
          };
        }
      ) => void;
    };
  }
}

const META_APP_ID = (process.env.NEXT_PUBLIC_META_APP_ID ?? "").trim();
const META_CONFIG_ID = (process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID ?? "").trim();
const META_GRAPH_VERSION = (process.env.NEXT_PUBLIC_META_GRAPH_API_VERSION ?? "v26.0").trim() || "v26.0";

function isTrustedFacebookOrigin(origin: string): boolean {
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

export default function WhatsAppConnectionsPage() {
  const { locale } = useI18n();
  const isId = locale === "id";

  const [data, setData] = useState<ConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [confirmDisconnectItem, setConfirmDisconnectItem] =
    useState<WhatsAppConnectionItem | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const pendingSignupRef = useRef<{
    code: string | null;
    phoneNumberId: string | null;
    wabaId: string | null;
    submitted: boolean;
  }>({ code: null, phoneNumberId: null, wabaId: null, submitted: false });

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/connections", { cache: "no-store" });
      const json = (await res.json()) as ConnectionsResponse;
      if (!res.ok || !json.success) {
        setNotice({
          kind: "error",
          text:
            json.error ||
            (isId ? "Gagal memuat daftar koneksi WhatsApp." : "Failed to load WhatsApp connections."),
        });
      }
      setData(json);
    } catch {
      setNotice({
        kind: "error",
        text: isId
          ? "Terjadi kesalahan jaringan saat memuat koneksi."
          : "Network error while loading connections.",
      });
    } finally {
      setLoading(false);
    }
  }, [isId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchInitial() {
      try {
        const res = await fetch("/api/whatsapp/connections", { cache: "no-store" });
        const json = (await res.json()) as ConnectionsResponse;
        if (cancelled) return;
        if (!res.ok || !json.success) {
          setNotice({
            kind: "error",
            text:
              json.error ||
              (isId ? "Gagal memuat daftar koneksi WhatsApp." : "Failed to load WhatsApp connections."),
          });
        }
        setData(json);
      } catch {
        if (!cancelled) {
          setNotice({
            kind: "error",
            text: isId
              ? "Terjadi kesalahan jaringan saat memuat koneksi."
              : "Network error while loading connections.",
          });
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
  }, [isId]);

  const tryFinalizeSignup = useCallback(async () => {
    const state = pendingSignupRef.current;
    const workspaceId = data?.workspace?.id;
    if (
      state.submitted ||
      !workspaceId ||
      !state.code ||
      !state.phoneNumberId ||
      !state.wabaId
    ) {
      return;
    }

    state.submitted = true;
    setConnecting(true);
    setNotice(null);

    try {
      const res = await fetch("/api/whatsapp/embedded-signup/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          code: state.code,
          phoneNumberId: state.phoneNumberId,
          wabaId: state.wabaId,
          integrationMode: "coexistence",
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !json.success) {
        setNotice({
          kind: "error",
          text:
            json.error ||
            (isId
              ? "Gagal menyelesaikan onboarding WhatsApp Business."
              : "Failed to complete WhatsApp Business onboarding."),
        });
      } else {
        setNotice({
          kind: "success",
          text: isId
            ? "Nomor WhatsApp Business berhasil terhubung dalam mode Coexistence."
            : "WhatsApp Business number connected successfully in Coexistence mode.",
        });
        await loadConnections();
      }
    } catch {
      setNotice({
        kind: "error",
        text: isId
          ? "Gagal menghubungi server saat menyimpan koneksi WhatsApp."
          : "Failed to reach server while saving WhatsApp connection.",
      });
    } finally {
      setConnecting(false);
      pendingSignupRef.current = {
        code: null,
        phoneNumberId: null,
        wabaId: null,
        submitted: false,
      };
    }
  }, [data?.workspace?.id, isId, loadConnections]);

  // Meta Embedded Signup sessionInfo listener (v3)
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
        };
      };

      if (msg.type !== "WA_EMBEDDED_SIGNUP") return;

      if (msg.event === "CANCEL") {
        setConnecting(false);
        pendingSignupRef.current = {
          code: null,
          phoneNumberId: null,
          wabaId: null,
          submitted: false,
        };
        setNotice({
          kind: "error",
          text: isId
            ? "Proses menghubungkan WhatsApp dibatalkan."
            : "WhatsApp connection flow was canceled.",
        });
        return;
      }

      if (msg.data?.phone_number_id && msg.data?.waba_id) {
        pendingSignupRef.current.phoneNumberId = String(msg.data.phone_number_id);
        pendingSignupRef.current.wabaId = String(msg.data.waba_id);
        void tryFinalizeSignup();
      }
    }

    window.addEventListener("message", handleMetaMessage);
    return () => window.removeEventListener("message", handleMetaMessage);
  }, [isId, tryFinalizeSignup]);

  const initFacebookSdk = useCallback(() => {
    if (!META_APP_ID || typeof window === "undefined" || !window.FB) return;
    window.FB.init({
      appId: META_APP_ID,
      autoLogAppEvents: true,
      xfbml: false,
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
    setNotice(null);

    if (!META_APP_ID || !META_CONFIG_ID) {
      setNotice({
        kind: "error",
        text: isId
          ? "Konfigurasi Meta Embedded Signup (NEXT_PUBLIC_META_APP_ID / NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID) belum diisi."
          : "Meta Embedded Signup configuration is missing.",
      });
      return;
    }

    if (!window.FB) {
      setNotice({
        kind: "error",
        text: isId
          ? "Meta JS SDK masih dimuat. Silakan coba beberapa detik lagi."
          : "Meta JS SDK is still loading. Please try again in a few seconds.",
      });
      return;
    }

    pendingSignupRef.current = {
      code: null,
      phoneNumberId: null,
      wabaId: null,
      submitted: false,
    };
    setConnecting(true);

    window.FB.login(
      (response: FacebookLoginResponse) => {
        const code = response?.authResponse?.code;
        if (!code) {
          setConnecting(false);
          setNotice({
            kind: "error",
            text: isId
              ? "Otorisasi Meta tidak menghasilkan kode akses. Silakan coba lagi."
              : "Meta authorization did not return an access code.",
          });
          return;
        }
        pendingSignupRef.current.code = code;
        void tryFinalizeSignup();
      },
      {
        config_id: META_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          feature: "whatsapp_embedded_signup",
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      }
    );
  };

  const handleConfirmDisconnect = async () => {
    if (!confirmDisconnectItem) return;
    const target = confirmDisconnectItem;
    setDisconnectingId(target.id);
    setNotice(null);

    try {
      const res = await fetch(`/api/whatsapp/connections/${target.id}/disconnect`, {
        method: "POST",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setNotice({
          kind: "error",
          text:
            json.error ||
            (isId ? "Gagal memutuskan koneksi nomor WhatsApp." : "Failed to disconnect number."),
        });
      } else {
        setNotice({
          kind: "success",
          text: isId
            ? "Koneksi nomor diputuskan dan token dihapus. Data percakapan & analisis lead tetap dipertahankan."
            : "Connection disconnected and access token removed. Historical conversations & lead analyses are preserved.",
        });
        await loadConnections();
      }
    } catch {
      setNotice({
        kind: "error",
        text: isId
          ? "Gagal menghubungi server saat memutuskan koneksi."
          : "Network error while disconnecting number.",
      });
    } finally {
      setDisconnectingId(null);
      setConfirmDisconnectItem(null);
    }
  };

  const quota = data?.quota ?? {
    connected_count: 0,
    max_whatsapp_connections: 1,
    plan: "starter",
    subscription_status: "active",
  };
  const connections = data?.connections ?? [];
  const canManageConnections = data?.userRole === "owner" || data?.userRole === "admin";
  const isQuotaFull = quota.connected_count >= quota.max_whatsapp_connections;
  const quotaPct = Math.min(
    100,
    Math.round((quota.connected_count / Math.max(1, quota.max_whatsapp_connections)) * 100)
  );
  const envConfigured = Boolean(META_APP_ID && META_CONFIG_ID);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {META_APP_ID && (
        <Script
          src="https://connect.facebook.net/en_US/sdk.js"
          strategy="afterInteractive"
          onLoad={initFacebookSdk}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {isId ? "Koneksi WhatsApp Business" : "WhatsApp Business Connections"}
            </h1>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Analysis-Only
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {isId
              ? "Hubungkan WhatsApp Business App sales Anda melalui Meta Coexistence untuk pelacakan atribusi iklan CTWA & skor AI."
              : "Connect your sales team's WhatsApp Business App via Meta Coexistence for CTWA ad attribution & AI lead scoring."}
          </p>
        </div>

        {data?.workspace && (
          <div className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-zinc-500 dark:text-zinc-400">Workspace: </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {data.workspace.name}
            </span>
            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {data.userRole}
            </span>
          </div>
        )}
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Quota Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {isId ? "Kuota Nomor WhatsApp" : "WhatsApp Number Quota"}
            </p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {quota.connected_count} / {quota.max_whatsapp_connections}{" "}
              <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                {isId ? "nomor terhubung" : "numbers connected"}
              </span>
            </p>
          </div>
          <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            Plan: {quota.plan}
          </span>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full transition-all duration-300 ${
              isQuotaFull ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${quotaPct}%` }}
          />
        </div>

        {isQuotaFull && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            {isId
              ? `Batas paket ${quota.plan} telah tercapai (${quota.max_whatsapp_connections} nomor aktif). Putuskan nomor lama atau upgrade paket untuk menambah nomor baru.`
              : `Your ${quota.plan} plan limit (${quota.max_whatsapp_connections} active numbers) has been reached.`}
          </p>
        )}
      </div>

      {/* Consent Disclosure Box (Mandatory for Meta App Review) + Connect Action */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {isId
              ? "Transparansi Izin Data & Coexistence (Meta App Review Disclosure)"
              : "Data Permissions & Coexistence Disclosure"}
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              {isId
                ? "Haspro hanya membaca dan menganalisis metadata serta isi percakapan Click-to-WhatsApp (CTWA) untuk keperluan lead intelligence, perhitungan waktu respons, dan klasifikasi pipeline."
                : "Haspro strictly reads and analyzes Click-to-WhatsApp (CTWA) conversation events for lead intelligence, response speed metrics, and pipeline classification."}
            </li>
            <li>
              {isId
                ? "Aplikasi ini TIDAK mengirim pesan keluar, tidak melakukan broadcast, dan tidak mengaktifkan auto-reply atau chatbot ke pelanggan Anda."
                : "This application NEVER sends outbound messages, broadcasts, or automated chatbot replies to your customers."}
            </li>
            <li>
              {isId
                ? "Sales tetap membalas chat langsung dari aplikasi WhatsApp Business di HP (mode Coexistence). Anda dapat memutuskan koneksi kapan saja untuk mencabut akses token secara permanen."
                : "Your sales team continues replying directly from the WhatsApp Business mobile app (Coexistence mode). You may disconnect anytime to revoke and delete stored tokens."}
            </li>
          </ul>
        </div>

        {!envConfigured && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-200">
            {isId
              ? "Variabel NEXT_PUBLIC_META_APP_ID dan NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID perlu diisi di .env.local untuk mengaktifkan popup Meta Embedded Signup."
              : "Set NEXT_PUBLIC_META_APP_ID and NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID in .env.local to launch Meta Embedded Signup."}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {!canManageConnections
              ? isId
                ? "Hanya role owner atau admin workspace yang dapat menghubungkan nomor."
                : "Only workspace owners or admins can connect WhatsApp numbers."
              : sdkReady || !envConfigured
                ? isId
                  ? "Nomor tetap aktif di HP sales saat terhubung via Embedded Signup Coexistence."
                  : "Numbers stay active on your sales phone via Embedded Signup Coexistence."
                : isId
                  ? "Memuat Meta Embedded Signup SDK..."
                  : "Loading Meta Embedded Signup SDK..."}
          </p>

          <button
            type="button"
            onClick={handleLaunchEmbeddedSignup}
            disabled={
              loading ||
              connecting ||
              !canManageConnections ||
              isQuotaFull ||
              !envConfigured
            }
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {connecting
              ? isId
                ? "Menghubungkan..."
                : "Connecting..."
              : isId
                ? "Connect WhatsApp Business"
                : "Connect WhatsApp Business"}
          </button>
        </div>
      </div>

      {/* Connections List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {isId ? "Nomor WhatsApp Terdaftar" : "Registered WhatsApp Numbers"}
        </h2>

        {loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            {isId ? "Memuat daftar koneksi..." : "Loading connections..."}
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {isId
                ? "Belum ada nomor WhatsApp Business yang terhubung."
                : "No WhatsApp Business numbers connected yet."}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {isId
                ? "Klik 'Connect WhatsApp Business' di atas untuk memulai Meta Embedded Signup."
                : "Click 'Connect WhatsApp Business' above to start Meta Embedded Signup."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {connections.map((item) => {
              const isConnected = item.connection_status === "connected";
              const hasInactivityWarning = item.health_status === "warning_inactive";

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="space-y-3">
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
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase ${
                          isConnected
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {item.connection_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950/60">
                      <div>
                        <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                          Mode
                        </span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {item.integration_mode === "coexistence"
                            ? "Coexistence App"
                            : "Cloud API"}
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
                        <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                          {item.phone_number_id}
                        </span>
                      </div>
                    </div>

                    {hasInactivityWarning && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                        {isId
                          ? "Peringatan Coexistence: belum ada echo pesan sales masuk dalam >10 hari (atau >3 hari sejak terhubung). Buka WhatsApp Business App di HP agar sinkronisasi Coexistence tidak terputus otomatis setelah 14 hari inaktif."
                          : "Coexistence warning: no outbound sales echoes detected recently. Open the WhatsApp Business mobile app periodically to avoid Meta's 14-day inactivity unlink."}
                      </div>
                    )}
                  </div>

                  {isConnected && canManageConnections && (
                    <div className="mt-4 flex justify-end border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setConfirmDisconnectItem(item)}
                        disabled={disconnectingId === item.id}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                      >
                        {disconnectingId === item.id
                          ? isId
                            ? "Memutuskan..."
                            : "Disconnecting..."
                          : isId
                            ? "Disconnect"
                            : "Disconnect"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Dialog */}
      {confirmDisconnectItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disconnect-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <h3
              id="disconnect-dialog-title"
              className="text-base font-bold text-zinc-900 dark:text-zinc-50"
            >
              {isId ? "Putuskan Koneksi WhatsApp?" : "Disconnect WhatsApp Number?"}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {isId
                ? `Nomor ${
                    confirmDisconnectItem.display_phone_number ||
                    confirmDisconnectItem.phone_number_id
                  } akan diputuskan dan access token dihapus permanen. Data percakapan, lead, dan analisis AI tetap dipertahankan.`
                : `Number ${
                    confirmDisconnectItem.display_phone_number ||
                    confirmDisconnectItem.phone_number_id
                  } will be disconnected and its access token permanently removed. Existing conversations, leads, and AI analyses will remain intact.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDisconnectItem(null)}
                disabled={disconnectingId !== null}
                className="rounded-lg border border-zinc-300 px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {isId ? "Batal" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                disabled={disconnectingId !== null}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {disconnectingId !== null
                  ? isId
                    ? "Memutuskan..."
                    : "Disconnecting..."
                  : isId
                    ? "Ya, Putuskan Koneksi"
                    : "Yes, Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
