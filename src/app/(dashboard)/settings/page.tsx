"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { MetaAssetOnboarding } from "@/components/meta/MetaAssetOnboarding";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Quota = { limit: number; used: number; reserved: number; remaining: number; resetAt: string | null };

function Card({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
    <div className="mb-5"><h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p></div>{children}
  </section>;
}

export default function SettingsPage() {
  const { locale } = useI18n();
  const id = locale === "id";
  const [user, setUser] = useState<{ email: string; confirmed: boolean } | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaEnabled, setQuotaEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [auth, usage] = await Promise.all([
      createClient().auth.getUser(),
      fetch("/api/ai/usage", { cache: "no-store" }).then(async (r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    if (auth.data.user) {
      setUser({ email: auth.data.user.email || "", confirmed: Boolean(auth.data.user.email_confirmed_at) });
      setEmail(auth.data.user.email || "");
    }
    if (usage?.success) {
      setQuotaEnabled(usage.data.enabled !== false);
      setQuota(usage.data.enabled === false ? null : usage.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const updateEmail = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    const nextEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setNotice({ kind: "error", text: id ? "Masukkan alamat email yang valid." : "Enter a valid email address." }); return;
    }
    if (nextEmail.toLowerCase() === user?.email.toLowerCase()) {
      setNotice({ kind: "error", text: id ? "Gunakan email yang berbeda dari email saat ini." : "Enter an email different from your current address." }); return;
    }
    setBusy("email");
    const { error } = await createClient().auth.updateUser({ email: nextEmail }, { emailRedirectTo: `${window.location.origin}/auth/callback?redirect=%2Fsettings` });
    setBusy(null);
    setNotice(error
      ? { kind: "error", text: error.message }
      : { kind: "success", text: id ? "Tautan konfirmasi telah dikirim. Selesaikan konfirmasi untuk memperbarui email." : "A confirmation link was sent. Confirm it to finish updating your email." });
  };

  const updatePassword = async (event: FormEvent) => {
    event.preventDefault(); setNotice(null);
    if (newPassword.length < 8) { setNotice({ kind: "error", text: id ? "Password harus terdiri dari minimal 8 karakter." : "Password must be at least 8 characters." }); return; }
    if (newPassword !== confirmPassword) { setNotice({ kind: "error", text: id ? "Konfirmasi password tidak sama." : "Password confirmation does not match." }); return; }
    setBusy("password");
    const { error } = await createClient().auth.updateUser({ password: newPassword, current_password: currentPassword });
    setBusy(null);
    if (error) { setNotice({ kind: "error", text: error.message }); return; }
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setNotice({ kind: "success", text: id ? "Password berhasil diperbarui." : "Password updated successfully." });
  };

  const fmt = (date: string | null) => date ? new Intl.DateTimeFormat(id ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)) : (id ? "Belum ada penggunaan" : "No usage yet");

  return <main className="mx-auto max-w-4xl space-y-6 pb-12">
    <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{id ? "Pengaturan" : "Settings"}</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{id ? "Kelola akun, koneksi Meta Ads, dan penggunaan analisis AI Anda." : "Manage your account, Meta Ads connection, and AI analysis usage."}</p>
    </header>

    <Card title={id ? "Akun Saya" : "My Account"} description={id ? "Perbarui informasi login dan keamanan akun Anda." : "Update your sign-in and account security details."}>
      {loading ? <div className="animate-pulse space-y-3"><div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700"/><div className="h-10 rounded bg-zinc-100 dark:bg-zinc-800"/></div> : <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60"><div><p className="text-xs text-zinc-500 dark:text-zinc-400">{id ? "Email saat ini" : "Current email"}</p><p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{user?.email || "—"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user?.confirmed ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>{user?.confirmed ? (id ? "Terverifikasi" : "Verified") : (id ? "Belum terverifikasi" : "Not verified")}</span></div>
        <form onSubmit={updateEmail} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div><label htmlFor="settings-email" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{id ? "Ganti email" : "Change email"}</label><input id="settings-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" /></div><button disabled={busy !== null} className="min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900">{busy === "email" ? (id ? "Menyimpan…" : "Saving…") : (id ? "Kirim konfirmasi" : "Send confirmation")}</button></form>
        <form onSubmit={updatePassword} className="space-y-3 border-t border-zinc-100 pt-5 dark:border-zinc-800"><h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{id ? "Ganti password" : "Change password"}</h3><div className="grid gap-3 sm:grid-cols-3"><input aria-label={id ? "Password saat ini" : "Current password"} type={showPassword ? "text" : "password"} autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder={id ? "Password saat ini" : "Current password"} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"/><input aria-label={id ? "Password baru" : "New password"} type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={id ? "Password baru" : "New password"} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"/><input aria-label={id ? "Konfirmasi password" : "Confirm password"} type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={id ? "Konfirmasi password" : "Confirm password"} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"/></div><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="rounded border-zinc-300"/>{id ? "Tampilkan password" : "Show password"}</label><button disabled={busy !== null} className="min-h-10 rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">{busy === "password" ? (id ? "Memperbarui…" : "Updating…") : (id ? "Perbarui password" : "Update password")}</button></div></form>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{id ? "Lupa password?" : "Forgot your password?"} <Link href="/forgot-password" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">{id ? "Kirim tautan reset" : "Send a reset link"}</Link></p>
      </div>}
      {notice && <p role="status" className={`mt-4 rounded-xl px-3 py-2.5 text-sm ${notice.kind === "success" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"}`}>{notice.text}</p>}
    </Card>

    <Card title={id ? "Integrasi Meta Ads" : "Meta Ads Integration"} description={id ? "Hubungkan identitas Meta Anda dan pilih akun iklan yang dikelola." : "Connect your Meta identity and choose the ad accounts you manage."}>
      <MetaAssetOnboarding />
    </Card>

    <Card title={id ? "Penggunaan AI" : "AI Usage"} description={quotaEnabled === false ? (id ? "Pembatasan analisis sementara dinonaktifkan selama mode testing." : "Analysis limits are temporarily disabled during testing.") : (id ? "Paket Free mencakup maksimal 3 analisis sukses dalam setiap periode 7 hari." : "The Free plan includes up to 3 successful analyses in each rolling 7-day period.")}>
      {quotaEnabled === false ? <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">{id ? "Kuota per pengguna sedang dinonaktifkan. Analisis AI dapat dijalankan tanpa batas selama pengujian." : "Per-user quota is disabled. AI analysis can run without a limit during testing."}</div> : !quota ? <p className="text-sm text-zinc-500">{loading || quotaEnabled === null ? (id ? "Memuat penggunaan…" : "Loading usage…") : (id ? "Penggunaan belum dapat dimuat. Coba segarkan halaman." : "Usage could not be loaded. Refresh the page to try again.")}</p> : <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">Free</span><p className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{id ? `${quota.used} dari ${quota.limit} analisis digunakan` : `${quota.used} of ${quota.limit} analyses used`}</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{id ? `Sisa ${quota.remaining} analisis${quota.reserved ? ` · ${quota.reserved} sedang diproses` : ""}` : `${quota.remaining} analyses remaining${quota.reserved ? ` · ${quota.reserved} in progress` : ""}`}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${quota.remaining > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>{quota.remaining > 0 ? (id ? "Kuota tersedia" : "Available") : (id ? "Kuota habis" : "Limit reached")}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, ((quota.used + quota.reserved) / quota.limit) * 100)}%` }}/></div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{id ? "Penggunaan berikutnya tersedia" : "Next analysis available"}: <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(quota.resetAt)}</span></p>
      </div>}
    </Card>
  </main>;
}
