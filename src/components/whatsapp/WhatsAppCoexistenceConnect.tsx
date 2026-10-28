"use client";

import React, { useEffect, useState } from "react";
import type { WhatsAppConnectionRecord, WhatsAppConnectionStatus } from "@/lib/whatsapp/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (options: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
      login: (
        callback: (response: {
          authResponse?: { code: string; [key: string]: unknown };
          status?: string;
        }) => void,
        options: {
          config_id?: string;
          response_type?: string;
          override_default_response_type?: boolean;
          extras?: {
            setup?: Record<string, unknown>;
            featureType?: string;
            sessionInfoVersion?: string;
          };
        }
      ) => void;
    };
  }
}

export function WhatsAppCoexistenceConnect() {
  const { locale } = useI18n();
  const { addToast } = useToast();

  const [connectionStatus, setConnectionStatus] = useState<WhatsAppConnectionStatus>("disconnected");
  const [connection, setConnection] = useState<WhatsAppConnectionRecord | null>(null);
  const [isLiveVerified, setIsLiveVerified] = useState(false);
  const [metaAppConfigured, setMetaAppConfigured] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [csrfState, setCsrfState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);
  const [metaSessionData, setMetaSessionData] = useState<{ phoneNumberId?: string; wabaId?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"onboarding" | "prerequisites" | "technical">("onboarding");

  useEffect(() => {
    let ignore = false;
    async function loadConnection() {
      try {
        const res = await fetch("/api/whatsapp/connect");
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.success) {
            setConnectionStatus(data.connectionStatus || "disconnected");
            setConnection(data.connection || null);
            setIsLiveVerified(Boolean(data.isLiveVerified));
            setMetaAppConfigured(Boolean(data.metaAppConfigured));
            setAppId(data.appId || null);
            setConfigId(data.configId || null);
            setCsrfState(data.csrfState || null);
          }
        }
      } catch {
        if (!ignore) {
          addToast(
            "error",
            locale === "id" ? "Gagal Memuat WhatsApp" : "Failed to Load WhatsApp",
            locale === "id"
              ? "Gagal memuat status koneksi WhatsApp Business dari server."
              : "Failed to load WhatsApp Business status from server."
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadConnection();
    return () => {
      ignore = true;
    };
  }, [addToast, locale]);

  // Load Meta Facebook JavaScript SDK dynamically when appId is configured
  useEffect(() => {
    if (!appId || typeof window === "undefined" || window.FB) return;

    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
    };

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      const existing = document.getElementById("facebook-jssdk");
      if (existing) existing.remove();
    };
  }, [appId]);

  // Listen to official Meta Embedded Signup message events
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP") {
          if (data.event === "FINISH") {
            const { phone_number_id, waba_id } = data.data || {};
            if (phone_number_id && waba_id) {
              setMetaSessionData({ phoneNumberId: phone_number_id, wabaId: waba_id });
              addToast(
                "info",
                locale === "id" ? "Otorisasi Diterima" : "Authorization Received",
                locale === "id"
                  ? "Menyinkronkan aset bisnis dan nomor WhatsApp ke server..."
                  : "Syncing business assets and WhatsApp number to server..."
              );
            }
          } else if (data.event === "CANCEL") {
            addToast(
              "info",
              locale === "id" ? "Pendaftaran Dibatalkan" : "Signup Cancelled",
              locale === "id"
                ? "Proses pendaftaran WhatsApp Embedded Signup dibatalkan."
                : "WhatsApp Embedded Signup flow was cancelled."
            );
            setIsProcessing(false);
            setConnectionStatus("disconnected");
          } else if (data.event === "ERROR") {
            addToast(
              "error",
              locale === "id" ? "Kendala Pendaftaran" : "Signup Error",
              data.data?.error_message || (locale === "id" ? "Terjadi kesalahan tidak diketahui." : "Unknown error occurred.")
            );
            setIsProcessing(false);
            setConnectionStatus("error");
          }
        }
      } catch {
        // Ignored unparsable non-Meta messages
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [addToast, locale]);

  const submitAuthorizationToServer = async (code: string) => {
    if (!csrfState) {
      addToast(
        "error",
        locale === "id" ? "Sesi Belum Siap" : "Session Not Ready",
        locale === "id" ? "Sesi keamanan anti-CSRF belum siap. Silakan muat ulang halaman." : "Anti-CSRF security session not ready. Please reload."
      );
      setIsProcessing(false);
      setConnectionStatus("disconnected");
      return;
    }

    const wabaId = metaSessionData?.wabaId || connection?.wabaId;
    const phoneNumberId = metaSessionData?.phoneNumberId || connection?.phoneNumberId;

    if (!wabaId || !phoneNumberId) {
      addToast(
        "error",
        locale === "id" ? "Aset Tidak Ditemukan" : "Assets Not Found",
        locale === "id"
          ? "WABA ID atau Phone Number ID dari Meta Onboarding tidak ditemukan. Silakan ulangi proses hingga tuntas."
          : "WABA ID or Phone Number ID not found from Meta Onboarding. Please complete the flow."
      );
      setIsProcessing(false);
      setConnectionStatus("disconnected");
      return;
    }

    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          wabaId,
          phoneNumberId,
          state: csrfState,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setConnectionStatus("connected");
        setConnection(json.connection);
        addToast(
          "success",
          locale === "id" ? "WhatsApp Terhubung" : "WhatsApp Connected",
          locale === "id"
            ? "Selamat! Nomor WhatsApp Business Coexistence Anda berhasil terhubung resmi."
            : "WhatsApp Business Coexistence number connected successfully."
        );
      } else {
        setConnectionStatus("error");
        addToast(
          "error",
          locale === "id" ? "Validasi Gagal" : "Validation Failed",
          json.error || (locale === "id" ? "Gagal memvalidasi otorisasi Meta pada server." : "Failed to validate Meta authorization on server.")
        );
      }
    } catch (err) {
      setConnectionStatus("error");
      addToast(
        "error",
        locale === "id" ? "Kesalahan Server" : "Server Error",
        err instanceof Error ? err.message : (locale === "id" ? "Gagal menghubungi server untuk pertukaran kode." : "Failed to exchange auth code with server.")
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Initiate official Meta Embedded Signup with Coexistence flag
  const handleStartEmbeddedSignup = () => {
    if (!metaAppConfigured || !configId) {
      addToast(
        "warning",
        locale === "id" ? "Konfigurasi Belum Lengkap" : "Configuration Incomplete",
        locale === "id"
          ? "META_APP_ID atau WHATSAPP_CONFIG_ID belum dikonfigurasi di server."
          : "META_APP_ID or WHATSAPP_CONFIG_ID is missing in server environment."
      );
      return;
    }

    if (!window.FB) {
      addToast(
        "info",
        locale === "id" ? "Memuat SDK" : "Loading SDK",
        locale === "id" ? "Meta JavaScript SDK sedang dimuat. Coba beberapa detik lagi." : "Meta JavaScript SDK is loading. Try again in a moment."
      );
      return;
    }

    setIsProcessing(true);
    setConnectionStatus("connecting");

    window.FB.login(
      (response) => {
        if (response.authResponse?.code) {
          const authCode = response.authResponse.code;
          submitAuthorizationToServer(authCode);
        } else {
          setIsProcessing(false);
          setConnectionStatus("disconnected");
          addToast(
            "info",
            locale === "id" ? "Otorisasi Dibatalkan" : "Authorization Cancelled",
            locale === "id" ? "Otorisasi dibatalkan. Tidak ada akun yang terhubung." : "Authorization was cancelled. No account connected."
          );
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding", // GASS-style official Coexistence flag
          sessionInfoVersion: "3",
        },
      }
    );
  };

  const handleConfirmDisconnect = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        setConnectionStatus("disconnected");
        setConnection(null);
        setShowConfirmDisconnect(false);
        addToast(
          "info",
          locale === "id" ? "Koneksi Diputuskan" : "Connection Disconnected",
          locale === "id" ? "Koneksi WhatsApp Business Coexistence berhasil diputuskan." : "WhatsApp Business Coexistence connection disconnected."
        );
      } else {
        addToast(
          "error",
          locale === "id" ? "Gagal Memutuskan" : "Disconnect Failed",
          json.error || (locale === "id" ? "Gagal memutuskan koneksi pada server." : "Failed to disconnect on server.")
        );
      }
    } catch {
      addToast(
        "error",
        locale === "id" ? "Kesalahan Jaringan" : "Network Error",
        locale === "id" ? "Terjadi kesalahan saat memutuskan koneksi." : "Error occurred while disconnecting."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: WhatsAppConnectionStatus) => {
    switch (status) {
      case "connected":
        return isLiveVerified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {locale === "id" ? "Terhubung (Live Verified)" : "Connected (Live Verified)"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {locale === "id" ? "Terhubung (Menunggu Webhook)" : "Connected (Awaiting Webhook)"}
          </span>
        );
      case "connecting":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            {locale === "id" ? "Menghubungkan..." : "Connecting..."}
          </span>
        );
      case "reconnect_required":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60 font-mono">
            {locale === "id" ? "Perlu Koneksi Ulang" : "Reconnect Required"}
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60 font-mono">
            {locale === "id" ? "Kendala Koneksi" : "Connection Error"}
          </span>
        );
      case "disconnected":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 font-mono">
            {locale === "id" ? "Belum Terhubung" : "Not Connected"}
          </span>
        );
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-5 transition-colors">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {locale === "id" ? "WhatsApp Business Coexistence Onboarding" : "WhatsApp Business Coexistence Onboarding"}
            </h2>
            {getStatusBadge(connectionStatus)}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {locale === "id"
              ? "Hubungkan nomor WhatsApp Business ponsel Anda tanpa memutus aplikasi WhatsApp di smartphone. Didukung penuh oleh Meta Cloud API Coexistence resmi."
              : "Connect your existing smartphone WhatsApp Business number without losing mobile app access. Fully supported by official Meta Cloud API Coexistence."}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("onboarding")}
            className={`rounded-md px-3 py-1 font-medium transition cursor-pointer ${
              activeTab === "onboarding"
                ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-100 font-semibold"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {locale === "id" ? "Alur Onboarding" : "Onboarding Flow"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("prerequisites")}
            className={`rounded-md px-3 py-1 font-medium transition cursor-pointer ${
              activeTab === "prerequisites"
                ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-100 font-semibold"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {locale === "id" ? "Syarat Profil" : "Prerequisites"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("technical")}
            className={`rounded-md px-3 py-1 font-medium transition cursor-pointer ${
              activeTab === "technical"
                ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-100 font-semibold"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {locale === "id" ? "Detail Teknis" : "Technical Details"}
          </button>
        </div>
      </div>

      {/* Tab 1: Alur Onboarding GASS-Style */}
      {activeTab === "onboarding" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40 space-y-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white font-mono">
                1
              </span>
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                {locale === "id" ? "Buka Meta Onboarding" : "Launch Meta Flow"}
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {locale === "id" ? "Klik tombol di bawah untuk membuka popup resmi Facebook Login for Business." : "Click below to trigger official Facebook Login for Business."}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40 space-y-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white font-mono">
                2
              </span>
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                {locale === "id" ? "Pilih Opsi Coexistence" : "Select Coexistence"}
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {locale === "id" ? "Pilih opsi 'Hubungkan aplikasi WhatsApp Business yang ada'." : "Choose 'Connect an existing WhatsApp Business app'."}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40 space-y-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white font-mono">
                3
              </span>
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                {locale === "id" ? "Scan QR Code Resmi" : "Scan Official QR"}
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {locale === "id" ? "Buka aplikasi WhatsApp ponsel > Perangkat Tertaut > Scan QR di dialog Meta." : "Open phone WhatsApp > Linked Devices > Scan QR displayed by Meta."}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40 space-y-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white font-mono">
                4
              </span>
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                {locale === "id" ? "Verifikasi Otomatis" : "Server Verification"}
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {locale === "id" ? "Server memverifikasi WABA & Phone Number ID autoritatif ke Graph API." : "Server verifies WABA & Phone Number ID against Graph API."}
              </p>
            </div>
          </div>

          {/* Current Asset Status Card */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs mb-2">
              {locale === "id" ? "Status Aset WhatsApp Terdaftar:" : "Registered WhatsApp Asset Status:"}
            </h3>

            {isLoading ? (
              <p className="text-xs text-zinc-400">{locale === "id" ? "Memeriksa status dari server..." : "Checking server status..."}</p>
            ) : connection && connectionStatus === "connected" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div>
                  <span className="text-zinc-400 block text-[10px]">{locale === "id" ? "Nama Akun Bisnis:" : "Business Name:"}</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{connection.verifiedName || "WhatsApp Business"}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">{locale === "id" ? "Nomor WhatsApp:" : "WhatsApp Phone:"}</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200">{connection.displayPhoneNumber || connection.phoneNumberId}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">Phone Number ID:</span>
                  <span className="font-mono text-zinc-500">{connection.phoneNumberId}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">WABA ID:</span>
                  <span className="font-mono text-zinc-500">{connection.wabaId}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px]">{locale === "id" ? "Status Webhook:" : "Webhook Status:"}</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {connection.lastWebhookReceivedAt
                      ? (locale === "id" ? "Terverifikasi Aktif" : "Verified Live")
                      : (locale === "id" ? "Menunggu Event" : "Awaiting Events")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                <p>{locale === "id" ? "Belum ada nomor WhatsApp Business yang terhubung untuk organisasi ini." : "No WhatsApp Business number connected for this organization."}</p>
                {!metaAppConfigured && (
                  <p className="text-amber-600 dark:text-amber-400 font-medium text-[11px] pt-1 flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {locale === "id"
                      ? "Membutuhkan NEXT_PUBLIC_META_APP_ID dan NEXT_PUBLIC_WHATSAPP_CONFIG_ID di server untuk mengaktifkan popup Meta Embedded Signup."
                      : "Requires NEXT_PUBLIC_META_APP_ID and NEXT_PUBLIC_WHATSAPP_CONFIG_ID on server to launch Meta popup."}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Prerequisites */}
      {activeTab === "prerequisites" && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-800/30 space-y-3 text-xs">
          <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {locale === "id" ? "Persyaratan Keselarasan Nama Bisnis:" : "Business Profile Alignment Requirements:"}
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            {locale === "id"
              ? "Untuk memastikan proses onboarding Coexistence disetujui Meta tanpa kendala, pastikan nama bisnis Anda SAMA PERSIS di 5 platform berikut:"
              : "To prevent Meta onboarding suspensions, verify your brand name matches identically across these 5 assets:"}
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-zinc-700 dark:text-zinc-300">
            <li><strong>Facebook Fan Page</strong></li>
            <li><strong>Instagram Business Account</strong></li>
            <li><strong>WhatsApp Business Mobile App</strong></li>
            <li><strong>Landing Page / Website</strong></li>
            <li><strong>Meta Business Portfolio</strong></li>
          </ol>
          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px]">
            <strong>{locale === "id" ? "Ketentuan WhatsApp Ponsel:" : "Mobile App Rule:"}</strong>{" "}
            {locale === "id"
              ? "Aplikasi WhatsApp Business di smartphone fisik harus tetap aktif dan dibuka minimal sekali setiap 13 hari agar sesi Coexistence Cloud API tidak kedaluwarsa."
              : "WhatsApp Business on your smartphone must be opened at least once every 13 days to keep the Coexistence Cloud session active."}
          </div>
        </div>
      )}

      {/* Tab 3: Technical Details */}
      {activeTab === "technical" && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-800/30 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
          <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {locale === "id" ? "Batasan Keamanan & Protokol Cloud API:" : "Security Boundaries & Cloud API Protocols:"}
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Zero Unofficial Libraries:</strong> {locale === "id" ? "Tidak menggunakan library QR scraping (Baileys/Puppeteer) yang rentan banned." : "No unofficial QR scraping libraries that violate Meta ToS."}</li>
            <li><strong>Outbound Echo Isolation:</strong> {locale === "id" ? "Balasan staf via ponsel ditangkap webhook smb_message_echoes sebagai echo outbound, tidak pernah dihitung sebagai buyer lead baru." : "Staff mobile replies are routed via smb_message_echoes and never counted as new buyer leads."}</li>
            <li><strong>Tenant Isolation:</strong> {locale === "id" ? "Seluruh kredensial dan pesan dilindungi RLS." : "All credentials and message logs are protected by Supabase RLS."}</li>
            <li><strong>Anti-CSRF State:</strong> {locale === "id" ? "Token otorisasi diverifikasi langsung ke Graph API v21.0." : "Authorization tokens are validated server-to-server with Graph API v21.0."}</li>
          </ul>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <div className="text-[11px] text-zinc-400">
          * {locale === "id" ? "Diperlukan role Owner atau Admin untuk mengelola koneksi WhatsApp Business." : "Owner or Admin role required to configure WhatsApp connection."}
        </div>

        <div className="flex items-center gap-2">
          {connectionStatus === "connected" ? (
            <button
              type="button"
              onClick={() => setShowConfirmDisconnect(true)}
              disabled={isProcessing}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-50 dark:border-rose-900/50 dark:bg-zinc-800 dark:text-rose-400 dark:hover:bg-zinc-700 cursor-pointer disabled:opacity-50 transition-colors"
            >
              {isProcessing ? (locale === "id" ? "Memproses..." : "Processing...") : (locale === "id" ? "Putuskan Koneksi" : "Disconnect")}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartEmbeddedSignup}
              disabled={isProcessing || !metaAppConfigured}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
              </svg>
              {isProcessing
                ? (locale === "id" ? "Membuka Meta Embedded Signup..." : "Opening Meta Embedded Signup...")
                : metaAppConfigured
                ? (locale === "id" ? "Mulai Onboarding WhatsApp Coexistence" : "Start WhatsApp Coexistence Onboarding")
                : (locale === "id" ? "Menunggu Konfigurasi Meta App (Disabled)" : "Awaiting Meta App Config (Disabled)")}
            </button>
          )}
        </div>
      </div>

      {/* Accessible Confirmation Dialog for Disconnecting WhatsApp */}
      <ConfirmDialog
        isOpen={showConfirmDisconnect}
        onClose={() => setShowConfirmDisconnect(false)}
        onConfirm={handleConfirmDisconnect}
        title={locale === "id" ? "Putuskan Koneksi WhatsApp Business?" : "Disconnect WhatsApp Business?"}
        description={
          locale === "id"
            ? "Apakah Anda yakin ingin memutuskan koneksi WhatsApp Business Coexistence? Webhook percakapan dan atribusi lead otomatis akan dihentikan."
            : "Are you sure you want to disconnect WhatsApp Business Coexistence? Automated conversation webhooks and lead attribution will stop."
        }
        confirmText={locale === "id" ? "Ya, Putuskan" : "Yes, Disconnect"}
        cancelText={locale === "id" ? "Batal" : "Cancel"}
        variant="danger"
        isLoading={isProcessing}
      />
    </div>
  );
}
