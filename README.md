# HD Creative — Property Marketing Intelligence

Produk Haspro Digital Creative untuk analitik performa iklan properti dari Meta Marketing API dan data prospek CRM yang dimasukkan atau diunggah oleh klien.

## Fitur Utama

- **Analitik Iklan Meta:** Membaca metrik iklan dan menautkan data CRM ke iklan hanya jika informasi sumber tersedia.
- **Pengelolaan Data Prospek:** Klien dapat memasukkan prospek manual atau mengunggah spreadsheet CRM.
- **Analisis berbasis bukti yang tersedia:** Informasi yang tidak disediakan klien tidak ditebak atau dianggap sebagai fakta.
- **Cost Per Qualified Lead (CPQL):** Metrik efisiensi biaya iklan yang dihitung secara akurat hanya dari lead yang telah terbukti memenuhi ambang batas kualitas.
- **Rekomendasi Optimasi Iklan Deterministik:** Rekomendasi tindakan alokasi anggaran (*Scale Candidate, Investigate, Hold, Insufficient Data*) tanpa halusinasi LLM.
- **Persistent Review Audit Trail:** Audit peninjauan rekomendasi yang persisten di PostgreSQL Supabase dengan perlindungan Row Level Security (RLS) multi-tenant.

## Mulai Cepat

### 1. Konfigurasi Lingkungan

Salin template variabel lingkungan:
```bash
cp .env.example .env.local
```

### 2. Menjalankan Server Pengembangan

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) pada peramban Anda.

### 3. Menjalankan Pengujian & Verifikasi Kualitas

```bash
# Jalankan seluruh unit & integration tests
npm test

# Pengecekan statik TypeScript
npx tsc --noEmit

# Linting kode
npm run lint

# Kompilasi produksi Next.js
npm run build
```

## Dokumentasi Teknis

- [Panduan Brand dan Ikon](docs/BRAND_ASSETS_AND_ICONS.md)
- [Panduan Deployment & Migrasi Basis Data](docs/DEPLOYMENT_AND_MIGRATIONS.md)
- [Petunjuk Lengkap Arsitektur (AI Build Guide)](docs/PROPERTY_ADS_INTELLIGENCE_AI_BUILD_GUIDE.md)
