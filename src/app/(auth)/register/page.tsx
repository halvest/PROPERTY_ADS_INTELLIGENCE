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
  const { dict, locale } = useI18n();
  const toast = useToast();

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
          <button type="submit" disabled={isLoading} className="flex min-h-12 w-full items-center justify-center rounded-xl btn-solar px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer lg:col-span-2">
            {isLoading ? dict.common.loading : dict.auth.signUpButton}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {locale === "en" ? "Before registering, please read the " : "Sebelum mendaftar, baca "}
        <Link href="/terms-of-service" className="text-indigo-600 underline dark:text-indigo-300">{locale === "en" ? "Terms of Service" : "Ketentuan Layanan"}</Link>
        {locale === "en" ? " and " : " dan "}
        <Link href="/privacy-policy" className="text-indigo-600 underline dark:text-indigo-300">{locale === "en" ? "Privacy Policy" : "Kebijakan Privasi"}</Link>.
      </p>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{dict.auth.hasAccount}{" "}<Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">{dict.auth.signInLink}</Link></p>
    </AuthPageShell>
  );
}


