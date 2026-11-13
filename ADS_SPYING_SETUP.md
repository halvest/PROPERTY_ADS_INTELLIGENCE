# Panduan Setup: Ads Spying AI & Tencent Cloud Scraper Worker

Modul **Ads Spying AI** di `PROPERTY_ADS_INTELLIGENCE` menggunakan arsitektur terdistribusi:
1. **Next.js App (Frontend & AI Teardown):** Menjalankan *Winning Radar*, *Funnel X-Ray*, *WhatsApp Decoder*, *Safe-Zone Overlay*, dan *Grounded AI Teardown*.
2. **Scraper Worker (Tencent Cloud Lighthouse):** Layanan Python + FastAPI + Playwright untuk menyadap Meta Ad Library publik Indonesia (`country=ID`) dan mengunggah gambar/video permanen ke **Tencent Cloud Object Storage (COS)**.

---

## 1. Menjalankan Scraper Worker di Tencent Cloud Lighthouse

### A. Clone / Unggah Folder `scraper-worker`
Unggah folder `/scraper-worker` ke instance Tencent Cloud Lighthouse Anda (misal di `/root/scraper-worker`).

```bash
cd /root/scraper-worker
```

### B. Konfigurasi Environment File (`.env`)
Salin file template `.env.example`:
```bash
cp .env.example .env
nano .env
```

Isi variabel environment berikut:
```env
# Kunci rahasia komunikasi antara Next.js dan Worker
WORKER_API_SECRET=rahasia_worker_api_kamu_di_sini

# Kredensial Tencent Cloud Object Storage (COS)
TENCENT_COS_SECRET_ID=AKIDxxxxxxxxxxxxxxxxxxxxxxxx
TENCENT_COS_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TENCENT_COS_REGION=ap-jakarta
TENCENT_COS_BUCKET=property-ads-spy-1250000000
TENCENT_COS_PUBLIC_DOMAIN=https://property-ads-spy-1250000000.cos.ap-jakarta.myqcloud.com

# Kredensial Supabase Project (Service Role Key)
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh......(service_role_secret)
```

### C. Build & Run dengan Docker
Gunakan Docker untuk menjalankan worker secara otomatis:

```bash
# 1. Build image Docker
docker build -t ads-scraper-worker .

# 2. Jalankan container di port 8000 dengan batas memori ketat (1.2GB max pada VPS 1.9GB)
docker run -d \
  --name ads-scraper-worker \
  --restart always \
  --memory="1.2g" \
  --memory-swap="2g" \
  --cpus="1.5" \
  -p 8000:8000 \
  --env-file .env \
  ads-scraper-worker

# 3. Cek log worker
docker logs -f ads-scraper-worker
```

> **Firewall:** Pastikan port `8000` dibuka pada menu Firewall di konsol Tencent Cloud Lighthouse Anda.

---

## 2. Menghubungkan Worker ke Next.js (`.env.local`)

Di proyek Next.js `PROPERTY_ADS_INTELLIGENCE`, tambahkan URL dan Secret Lighthouse ke file `.env.local`:

```env
# URL IP/Domain publik instance Tencent Cloud Lighthouse Anda
LIGHTHOUSE_SCRAPER_URL=http://<IP_LIGHTHOUSE_ANDA>:8000
WORKER_API_SECRET=rahasia_worker_api_kamu_di_sini
```

---

## 3. Cara Penggunaan di Aplikasi

1. Buka halaman **Ads Spying AI** di browser:
   `http://localhost:3000/ads-spying-ai`
2. Ketik kata kunci (misal: `"rumah bsd city"`, `"perumahan karawang"`, `"cluster tangerang"`), lalu klik **"Scrape Live Meta Ads"**.
3. Sistem akan mengirim sinyal scrape ke Tencent Lighthouse Worker, menyadap payload Meta Ad Library, mengunggah media ke Tencent COS, dan memperbarui database secara instan.
4. Gunakan filter:
   - **Longevity:** *Evergreen (≥15 Hari)*, *Validating*, *Testing*.
   - **Scaling Count:** Filter iklan yang di-scale dengan *collation count ≥ 3*.
   - **Safe-Zone Overlay:** Klik tombol 🎯 untuk melihat batas aman feed/reels Instagram.
   - **WhatsApp Script:** Salin langsung pesan pembuka calon pembeli kompetitor.
   - **Bedah Anatomi AI:** Klik tombol ⚡ untuk mendapatkan teardown berbasis bukti tanpa halusinasi.
