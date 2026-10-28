"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const { dict } = useI18n();
  const toast = useToast();

  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMsg("");
    setSuccessMsg("");

    const cleanEmail = email.trim();
    const cleanToken = token.trim().replace(/[\s-]/g, "");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMsg(dict.auth.invalidEmail);
      return;
    }

    if (!cleanToken || cleanToken.length < 6) {
      setErrorMsg(dict.auth.otpInvalid);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      // Attempt signup OTP verification
      let verifyResult = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: "signup",
      });

      // Fallback to email verification type
      if (verifyResult.error && verifyResult.error.message.toLowerCase().includes("signup")) {
        verifyResult = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: "email",
        });
      }

      if (verifyResult.error) {
        const lower = verifyResult.error.message.toLowerCase();
        if (lower.includes("expired")) {
          setErrorMsg(dict.auth.otpExpired);
        } else if (lower.includes("failed to fetch") || lower.includes("network")) {
          setErrorMsg(dict.auth.networkError);
        } else {
          setErrorMsg(dict.auth.otpInvalid);
        }
        setIsLoading(false);
        return;
      }

      setSuccessMsg(dict.auth.verificationSuccess);
      toast.success(dict.auth.verificationSuccess);

      // Provision organization and profile idempotently
      try {
        const provRes = await fetch("/api/auth/provision", { method: "POST" });
        if (!provRes.ok) {
          console.warn("[Verify OTP] Provisioning warning response:", provRes.status);
        }
      } catch (provErr) {
        console.warn("[Verify OTP] Provisioning network error:", provErr);
      }

      setTimeout(() => {
        router.push("/dashboard");
      }, 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("failed to fetch")) {
        setErrorMsg(dict.auth.networkError);
      } else {
        setErrorMsg(msg || dict.toasts.changesNotSaved);
      }
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (isResending || resendCooldown > 0) return;

    const cleanEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMsg(dict.auth.invalidEmail);
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");
    setIsResending(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: cleanEmail,
      });

      if (error) {
        const lower = error.message.toLowerCase();
        if (
          lower.includes("rate limit") ||
          lower.includes("rate_limit") ||
          (error as { code?: string }).code === "over_email_send_rate_limit" ||
          (error as { status?: number }).status === 429
        ) {
          setErrorMsg(dict.auth.rateLimitExceeded);
        } else if (lower.includes("failed to fetch") || lower.includes("network")) {
          setErrorMsg(dict.auth.networkError);
        } else {
          setErrorMsg(error.message || dict.toasts.changesNotSaved);
        }
        setIsResending(false);
        return;
      }

      setSuccessMsg(dict.auth.otpSentSuccess);
      toast.success(dict.auth.otpSentSuccess);
      setResendCooldown(60);

      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("failed to fetch")) {
        setErrorMsg(dict.auth.networkError);
      } else {
        setErrorMsg(msg || dict.toasts.changesNotSaved);
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthPageShell
      appName={dict.common.appName}
      brandHeadline={dict.auth.brandHeadline}
      brandSubheadline={dict.auth.brandSubheadline}
    >
      <div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-white">{dict.auth.verifyEmailTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{dict.auth.verifyEmailSubtitle}</p>
      </div>

      {errorMsg && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{errorMsg}</div>}
      {successMsg && <div role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">{successMsg}</div>}

      <form onSubmit={handleVerifyOtp} className="mt-7 space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{dict.auth.emailLabel}</label>
          <input id="email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={dict.auth.emailPlaceholder} className="block min-h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" />
        </div>
        <div>
          <label htmlFor="token" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{dict.auth.otpCodeLabel}</label>
          <input id="token" name="token" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required value={token} onChange={(e) => setToken(e.target.value)} placeholder={dict.auth.otpCodePlaceholder} className="block min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 text-center font-mono text-xl tracking-[0.35em] text-zinc-950 outline-none transition placeholder:tracking-normal placeholder:text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" />
        </div>
        <button type="submit" disabled={isLoading} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#20263a] px-4 text-sm font-semibold text-white transition hover:bg-[#2c3450] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-indigo-500 dark:hover:bg-indigo-400">
          {isLoading ? dict.common.loading : dict.auth.verifyButton}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" onClick={handleResendOtp} disabled={isResending || resendCooldown > 0} className="font-medium text-indigo-600 transition hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-indigo-400 dark:hover:text-indigo-300">
          {resendCooldown > 0 ? dict.auth.resendCooldown.replace("{seconds}", String(resendCooldown)) : isResending ? dict.auth.resending : dict.auth.resendOtp}
        </button>
        <Link href="/login" className="text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">{dict.auth.backToLogin}</Link>
      </div>
    </AuthPageShell>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-zinc-400">Loading...</div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}


