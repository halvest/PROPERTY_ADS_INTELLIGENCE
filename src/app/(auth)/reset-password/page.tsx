"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { dict, locale } = useI18n();
  const id = locale === "id";
  const [validSession, setValidSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void createClient().auth.getUser().then(({ data, error: authError }) => {
      if (active) setValidSession(Boolean(data.user && !authError));
    });
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (password.length < 8) { setError(id ? "Password harus terdiri dari minimal 8 karakter." : "Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError(id ? "Konfirmasi password tidak sama." : "Password confirmation does not match."); return; }
    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) { setError(updateError.message); return; }
    await supabase.auth.signOut();
    router.replace("/login?password_reset=true");
  };

  return <AuthPageShell appName={dict.common.appName} brandHeadline={dict.auth.brandHeadline} brandSubheadline={dict.auth.brandSubheadline}>
    <div><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-white">{id ? "Buat password baru" : "Set a new password"}</h1><p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{id ? "Pilih password baru untuk akun Anda." : "Choose a new password for your account."}</p></div>
    {validSession === null ? <p className="mt-7 text-sm text-zinc-500">{id ? "Memvalidasi tautan…" : "Validating recovery link…"}</p> : !validSession ? <div className="mt-7 space-y-4"><p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{id ? "Tautan pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru." : "This recovery link is invalid or expired. Request a new one."}</p><Link href="/forgot-password" className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">{id ? "Minta tautan baru" : "Request a new link"}</Link></div> : <form onSubmit={submit} className="mt-7 space-y-4">
      <input type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={id ? "Password baru (minimal 8 karakter)" : "New password (at least 8 characters)"} className="min-h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"/>
      <input type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={id ? "Konfirmasi password baru" : "Confirm new password"} className="min-h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"/>
      <label className="flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="rounded border-zinc-300"/>{id ? "Tampilkan password" : "Show password"}</label>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      <button disabled={busy} className="min-h-12 w-full rounded-xl bg-[#20263a] px-4 text-sm font-semibold text-white hover:bg-[#2c3450] disabled:opacity-50 dark:bg-indigo-500">{busy ? (id ? "Memperbarui…" : "Updating…") : (id ? "Simpan password baru" : "Save new password")}</button>
    </form>}
  </AuthPageShell>;
}
