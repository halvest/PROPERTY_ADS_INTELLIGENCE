"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { safeInternalRedirect } from "@/lib/security/redirect";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = safeInternalRedirect(searchParams.get("redirect"));
  const urlError = searchParams.get("error");
  const { dict, locale } = useI18n();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  // Compute error message without effect: formError takes precedence if explicitly set
  const urlErrorMessage = urlError
    ? urlError === "oauth_failed" || urlError === "access_denied"
      ? dict.auth.oauthFailed
      : decodeURIComponent(urlError)
    : "";
  const displayError = formError !== null ? formError : urlErrorMessage;

  // Email/password is the only enabled sign-in method for now.
  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setFormError(dict.auth.invalidCredentials);
      return;
    }

    setIsLoading(true);
    setFormError("");

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        const lower = error.message.toLowerCase();
        if (
          lower.includes("email not confirmed") ||
          lower.includes("not confirmed")
        ) {
          router.push(`/verify-otp?email=${encodeURIComponent(trimmedEmail)}`);
          return;
        }

        if (lower.includes("failed to fetch") || lower.includes("network")) {
          setFormError(dict.auth.networkError);
        } else if (
          error.message === "Invalid login credentials" ||
          lower.includes("invalid login credentials")
        ) {
          setFormError(dict.auth.invalidCredentials);
        } else {
          setFormError(error.message);
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        try {
          await fetch("/api/auth/provision", { method: "POST" });
        } catch {
          // Non-blocking provisioning error
        }

        toast.success(dict.common.login + " " + dict.common.saved);
        router.push(redirectTarget);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("failed to fetch")) {
        setFormError(dict.auth.networkError);
      } else {
        setFormError(msg || dict.toasts.changesNotSaved);
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
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-white">{dict.auth.welcomeBackTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{dict.auth.welcomeBackSubtitle}</p>
      </div>

      {displayError && (
        <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {displayError}
        </div>
      )}
      {searchParams.get("password_reset") === "true" && (
        <div role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          {locale === "id" ? "Password berhasil diperbarui. Silakan masuk kembali." : "Password updated. Sign in with your new password."}
        </div>
      )}

      <div className="mt-7 space-y-5">
        <form onSubmit={handleStandardLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{dict.auth.emailLabel}</label>
            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => { setEmail(e.target.value); setFormError(""); }} placeholder={dict.auth.emailPlaceholder} className="block min-h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{dict.auth.passwordLabel}</label><Link href="/forgot-password" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">{locale === "id" ? "Lupa password?" : "Forgot password?"}</Link></div>
            <div className="relative">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => { setPassword(e.target.value); setFormError(""); }} placeholder={dict.auth.passwordPlaceholder} className="block min-h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 pr-12 text-sm text-zinc-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute inset-y-0 right-3 grid place-items-center px-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? "Sembunyikan" : "Lihat"}
              </button>
            </div>
          </div>
          <button type="submit" disabled={isLoading} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#20263a] px-4 text-sm font-semibold text-white transition hover:bg-[#2c3450] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-indigo-500 dark:hover:bg-indigo-400">
            {isLoading ? dict.common.loading : dict.auth.signInButton}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {dict.auth.noAccount}{" "}<Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">{dict.auth.signUpLink}</Link>
      </p>
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-zinc-400">Loading workspace...</div>}>
      <LoginForm />
    </Suspense>
  );
}


