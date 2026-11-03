# AI Usage Quota — Migration Deployment Recommendation

Status: **REQUIRES APPROVAL** — dokumen ini adalah rekomendasi. Tidak ada
migration yang dijalankan saat dokumen ini dibuat.

## Reconciliation (read-only, terverifikasi)

| Pemeriksaan | Hasil |
|---|---|
| Migration ada di repository | Ya — `supabase/migrations/20261029103626_ai_analysis_quota.sql` |
| Tercatat di migration history database aktif | **Tidak** — history live memuat 10 migration, terakhir `crm_leads_manual_fields` |
| Tabel target ada di database aktif | **Tidak** — `public.ai_analysis_usage` dan `public.ai_analysis_quota_locks` tidak ada dalam daftar tabel `public` (MCP `list_tables`, project Haspro Digital Creative) |
| RPC target ada | Tidak (konsekuensi tabel/fungsi belum dibuat); endpoint `/api/ai/usage` dan ketiga endpoint analisis AI saat ini fail-closed dengan 503 `QUOTA_UNAVAILABLE` |
| Schema drift lain yang relevan | `integration_connections` ada di live tanpa tercatat di migration history (dibuat di luar jalur migration). Migration kuota tidak bergantung pada tabel tersebut |

## Isi migration (ringkasan)

- Tabel `ai_analysis_usage` (per **user**, constraint unik
  `(user_id, idempotency_key)`, status `reserved|succeeded|failed`).
- Tabel `ai_analysis_quota_locks` (lock baris per user untuk serialisasi).
- RPC `reserve_ai_analysis_usage`, `complete_ai_analysis_usage`,
  `get_ai_analysis_usage` — `SECURITY INVOKER`, di-revoke dari
  `public/anon/authenticated`, execute hanya untuk `service_role`.
- RLS aktif pada kedua tabel tanpa policy klien; akses hanya server-side
  melalui admin client.
- Aturan: maksimal 3 analisis **berhasil** per user dalam rolling
  7 × 24 jam (`completed_at > now() - interval '7 days'`); reservasi aktif
  (TTL 5 menit) ikut dihitung; reservasi kedaluwarsa tidak dapat
  diselesaikan sebagai sukses.

Migration bersifat aditif dan sebagian besar idempoten
(`CREATE TABLE IF NOT EXISTS`, index `IF NOT EXISTS`,
`CREATE OR REPLACE FUNCTION`). Tidak ada `DROP`, tidak ada perubahan data
lama, tidak melemahkan RLS tabel lain.

## Urutan deployment yang direkomendasikan (setelah persetujuan)

1. Terapkan migration tertunda yang menjadi konteks skema secara berurutan
   sesuai nama file, dengan rekonsiliasi manual untuk
   `integration_connections` yang sudah ada di live. Jangan `db push`
   membabi buta.
2. Terapkan `20261029103626_ai_analysis_quota.sql`.
3. Verifikasi PostgREST memuat skema baru (migration sudah diakhiri
   `notify pgrst, 'reload schema'`).
4. Verifikasi read-only pasca-terap:
   - `list_tables`: kedua tabel kuota muncul, RLS enabled.
   - `list_migrations`: migration tercatat.
   - Login sebagai user uji, panggil `GET /api/ai/usage` → harapkan
     `{ limit: 3, used: 0, reserved: 0, remaining: 3 }`.
5. Jalankan integration test DB-level
   (`tests/integration/ai-quota-db.test.ts`) terhadap project **staging/test
   khusus** — bukan produksi — dengan env `AI_QUOTA_TEST_*` sesuai header
   file test, untuk membuktikan konkurensi, expiry, dan isolasi per user.

## Risiko bila diterapkan

- Rendah untuk data: migration murni aditif, tidak menyentuh tabel bisnis.
- Perilaku aplikasi berubah dari "AI selalu 503" menjadi "AI berjalan
  dengan kuota 3/user/7 hari" — komunikasikan ke pengguna internal.
- Satu-satunya penulisan data saat runtime adalah baris kuota milik user
  pemanggil; tidak ada akses lintas user karena RPC hanya menerima
  `p_user_id` dari sesi server terverifikasi dan execute dibatasi
  `service_role`.
