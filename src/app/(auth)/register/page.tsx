"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { useToast } from "@/components/ui/Toast";

export default function RegisterPage() {
  const router = useRouter();
  const { dict } = useI18n();
  const toast = useToast();

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Proactively purge foreign or orphaned Supabase project cookies on localhost
  // to instantly protect against HTTP 431 header bloat
  useEffect(() => {
    if (typeof document === "undefined") return;
    const currentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const activeRef = currentUrl.includes("supabase.co")
      ? currentUrl.split("//")[1]?.split(".")[0]
      : null;

    const cookiePairs = document.cookie.split("; ");
    cookiePairs.forEach((pair) => {
      const eqIdx = pair.indexOf("=");
      const name = eqIdx > -1 ? pair.substring(0, eqIdx).trim() : pair.trim();
      if (
        name.startsWith("sb-") &&
        (name.includes("-auth-token") || name.includes("-code-verifier")) &&
        activeRef &&
        !name.startsWith(`sb-${activeRef}-`)
      ) {
        document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    });
  }, []);

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading || isLoading) return;
    setIsGoogleLoading(true);
    setErrorMsg("");

    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const callbackUrl = new URL("/auth/callback", origin);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setErrorMsg(error.message || dict.auth.oauthFailed);
        setIsGoogleLoading(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || dict.auth.oauthFailed);
      setIsGoogleLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMsg("");

    const trimmedName = fullName.trim();
    const trimmedCompany = companyName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      setErrorMsg(dict.auth.requiredFields);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg(dict.auth.invalidEmail);
      return;
    }

    if (password.length < 8) {
      setErrorMsg(dict.auth.passwordMinLength);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg(dict.auth.passwordMismatch);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
            company_name: trimmedCompany || trimmedName,
          },
        },
      });

      if (error) {
        const lower = error.message.toLowerCase();
        if (
          lower.includes("already registered") ||
          lower.includes("already exists") ||
          (error as { status?: number }).status === 422
        ) {
          setErrorMsg(dict.auth.emailAlreadyRegistered);
        } else if (
          lower.includes("rate limit") ||
          lower.includes("rate_limit") ||
          (error as { code?: string }).code === "over_email_send_rate_limit" ||
          (error as { status?: number }).status === 429
        ) {
          setErrorMsg(dict.auth.rateLimitExceeded);
        } else if (lower.includes("invalid") && lower.includes("email")) {
          setErrorMsg(dict.auth.invalidEmail);
        } else if (lower.includes("failed to fetch") || lower.includes("network")) {
          setErrorMsg(dict.auth.networkError);
        } else {
          setErrorMsg(error.message || dict.toasts.changesNotSaved);
        }
        setIsLoading(false);
        return;
      }

      // Supabase anti-enumeration: If user already exists, GoTrue returns identities: []
      if (
        data.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        setErrorMsg(dict.auth.emailAlreadyRegistered);
        setIsLoading(false);
        return;
      }

      // Scenario A: Email confirmation required (Standard production flow)
      if (data.user && !data.session) {
        toast.success(dict.auth.otpSentSuccess);
        router.push(`/verify-otp?email=${encodeURIComponent(trimmedEmail)}`);
        return;
      }

      // Scenario B: Auto-confirmed session (Development or direct session)
      if (data.session) {
        try {
          const provRes = await fetch("/api/auth/provision", { method: "POST" });
          if (!provRes.ok) {
            console.warn("[Register] Provisioning non-200 response:", provRes.status);
          }
        } catch (provErr) {
          console.warn("[Register] Provisioning fetch error:", provErr);
        }
        toast.success(dict.auth.verificationSuccess);
        router.push("/dashboard");
        return;
      }

      setIsLoading(false);
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

  return (
    <AuthPageShell
      appName={dict.common.appName}
      brandHeadline={dict.auth.brandHeadline}
      brandSubheadline={dict.auth.brandSubheadline}
    >
      <div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-white">{dict.auth.signUpTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{dict.auth.signUpSubtitle}</p>
      </div>

      {errorMsg && (
        <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      <div className="mt-7 space-y-5">
        <button type="button" onClick={handleGoogleSignIn} disabled={isLoading || isGoogleLoading} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.08]" aria-label={dict.auth.continueWithGoogle}>
          {isGoogleLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800 dark:border-zinc-600 dark:border-t-white" /> : (
            <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          )}
          <span>{isGoogleLoading ? dict.common.loading : dict.auth.continueWithGoogle}</span>
        </button>

        <div className="flex items-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" /><span>{dict.auth.orContinueWithEmail}</span><span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
        </div>

        <form onSubmit={handleRegister} className="grid grid-cols-1 gap-y-4 lg:grid-cols-2 lg:gap-x-4 lg:gap-y-3">
          <div>
            <label htmlFor="fullName" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{dict.auth.fullNameLabel}</label>
            <input id="fullName" name="fullName" type="text" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={dict.auth.fullNamePlaceholder} className="block min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" />
          </div>
          <div>
            <label htmlFor="companyName" className="mb-2 flex min-w-0 items-baseline justify-between gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span className="truncate">{dict.auth.companyNameLabel}</span>
              <span className="shrink-0 text-xs font-normal text-zinc-400 dark:text-zinc-500">{dict.auth.optionalLabel}</span>
            </label>
            <input id="companyName" name="companyName" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={dict.auth.companyNamePlaceholder} className="block min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" />
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{dict.auth.emailLabel}</label>
            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={dict.auth.emailPlaceholder} className="block min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{dict.auth.passwordLabel}</label>
            <div className="relative">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={dict.auth.passwordPlaceholder} className="block min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 pr-12 text-sm text-zinc-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute inset-y-0 right-3 px-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Sembunyikan" : "Lihat"}</button>
            </div>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{dict.auth.confirmPasswordLabel}</label>
            <input id="confirmPassword" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={dict.auth.passwordPlaceholder} className="block min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" />
          </div>
          <button type="submit" disabled={isLoading || isGoogleLoading} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#20263a] px-4 text-sm font-semibold text-white transition hover:bg-[#2c3450] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-indigo-500 dark:hover:bg-indigo-400 lg:col-span-2">
            {isLoading ? dict.common.loading : dict.auth.signUpButton}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{dict.auth.hasAccount}{" "}<Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">{dict.auth.signInLink}</Link></p>
    </AuthPageShell>
  );
}


