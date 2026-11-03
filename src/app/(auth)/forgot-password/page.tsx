"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function ForgotPasswordPage() {
  const { dict, locale } = useI18n();
  const id = locale === "id";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const { error: authError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?redirect=%2Freset-password`,
    });
    setBusy(false);
    if (authError) setError(authError.message);
    else setMessage(id ? "Jika email terdaftar, kami mengirim tautan untuk mengatur ulang password." : "If the email is registered, we sent a link to reset the password.");
  };

  return <AuthPageShell appName={dict.common.appName} brandHeadline={dict.auth.brandHeadline} brandSubheadline={dict.auth.brandSubheadline}>
    <div><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-white">{id ? "Reset password" : "Reset password"}</h1><p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{id ? "Masukkan email akun Anda untuk menerima tautan pemulihan." : "Enter your account email to receive a recovery link."}</p></div>
    <form onSubmit={submit} className="mt-7 space-y-4"><div><label htmlFor="recovery-email" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{dict.auth.emailLabel}</label><input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"/></div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}{message && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{message}</p>}
      <button disabled={busy} className="min-h-12 w-full rounded-xl btn-solar px-4 text-sm font-semibold disabled:opacity-50 cursor-pointer">{busy ? (id ? "Mengirim…" : "Sending…") : (id ? "Kirim tautan reset" : "Send reset link")}</button>
    </form><p className="mt-6 text-center text-sm text-zinc-500"><Link href="/login" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">{id ? "Kembali ke login" : "Back to sign in"}</Link></p>
  </AuthPageShell>;
}
