import type { LegalDocument } from "@/components/legal/LegalPageLayout";

export const privacyPolicy: LegalDocument = {
  title: { id: "Kebijakan Privasi", en: "Privacy Policy" },
  description: {
    id: "Kebijakan Privasi resmi Haspro (hdcreative.cloud) oleh Haspro Digital Creative — Platform CTWA Lead Intelligence & Analitik Pemasaran Properti.",
    en: "Official Privacy Policy for Haspro (hdcreative.cloud) by Haspro Digital Creative — AI-Powered CTWA Lead Intelligence & Property Marketing Analytics.",
  },
  sections: [
    {
      heading: { id: "1. Ruang Lingkup & Sifat Layanan (Strictly Analysis-Only)", en: "1. Scope & Service Nature (Strictly Analysis-Only)" },
      paragraphs: [
        {
          id: "Haspro (hdcreative.cloud) adalah platform intelijen pemasaran properti yang bersifat strictly analysis-only. Platform menerima sinkronisasi metadata dan pesan percakapan WhatsApp Business (melalui Meta WhatsApp Embedded Signup Coexistence & Webhook) serta metadata iklan Click-to-WhatsApp (CTWA) semata-mata untuk analitik kualitas prospek dan pelaporan performa iklan.",
          en: "Haspro (hdcreative.cloud) is a strictly analysis-only property marketing intelligence platform. We ingest WhatsApp Business message events (via Meta Embedded Signup Coexistence & Webhooks) and Click-to-WhatsApp (CTWA) ad attribution metadata solely for lead qualification analytics and ad performance reporting.",
        },
        {
          id: "Haspro tidak menyediakan fitur pengiriman pesan balasan (outbound messaging), broadcast massal, atau chatbot otomatis dari dashboard kami. Seluruh komunikasi dengan prospek tetap dilakukan langsung oleh tim sales Anda di WhatsApp Business App.",
          en: "Haspro does not provide outbound messaging, bulk broadcasting, or automated chatbot replies from our dashboard. All communication with prospects remains directly in your sales team's WhatsApp Business App.",
        },
      ],
    },
    {
      heading: { id: "2. Data yang Kami Proses & Masking Privasi", en: "2. Data We Process & Privacy Masking" },
      lists: [
        {
          items: [
            {
              id: "Data akun workspace: nama, email pengguna, keanggotaan workspace, dan peran (owner, admin, sales, viewer).",
              en: "Workspace account data: user name, email address, workspace membership, and assigned role (owner, admin, sales, viewer).",
            },
            {
              id: "Metadata koneksi WhatsApp & Meta Ads: Phone Number ID, WABA ID, nomor telepon bisnis yang terhubung, dan token akses terenkripsi (AES-256-GCM server-only).",
              en: "WhatsApp & Meta Ads connection metadata: Phone Number ID, WABA ID, connected business display phone number, and encrypted access tokens (AES-256-GCM server-only).",
            },
            {
              id: "Data percakapan CTWA: isi pesan masuk/echo terkait iklan CTWA, timestamp untuk perhitungan First Response Time (FRT), referral iklan (source_id, headline, ctwa_clid), serta nomor WhatsApp prospek yang ditampilkan dalam bentuk tersamar (masked, contoh: +62812****7890) pada dashboard.",
              en: "CTWA conversation data: inbound/echo message content linked to CTWA inquiries, timestamps for First Response Time (FRT) measurement, ad referral metadata (source_id, headline, ctwa_clid), and masked prospect phone numbers (e.g., +62812****7890) on the dashboard.",
            },
          ],
        },
      ],
    },
    {
      heading: { id: "3. Pemrosesan AI (Inference-Only)", en: "3. AI Processing (Inference-Only)" },
      paragraphs: [
        {
          id: "Teks percakapan diproses secara inference-only untuk menghasilkan ringkasan prospek, skor minat (0–100), suhu lead, dan saran tahapan pipeline berbasis bukti pesan (wamid). Data percakapan dan prospek tenant TIDAK pernah digunakan untuk melatih, menyempurnakan, atau dibagikan kepada model AI publik/umum.",
          en: "Conversation transcripts are processed strictly on an inference-only basis to generate prospect summaries, qualification scores (0–100), lead temperatures, and evidence-backed (wamid) stage suggestions. Tenant conversation and prospect data is NEVER used to train or fine-tune general or public AI models.",
        },
      ],
    },
    {
      heading: { id: "4. Isolasi Multi-Tenant & Keamanan", en: "4. Multi-Tenant Isolation & Security" },
      paragraphs: [
        {
          id: "Setiap data bisnis dipisahkan secara ketat per workspace (workspace_id) dan dilindungi Row Level Security (RLS) pada tingkat basis data Postgres. Kredensial rahasia WhatsApp disimpan terpisah menggunakan enkripsi AES-256-GCM dan tidak pernah diekspos ke browser maupun endpoint publik.",
          en: "All business data is strictly isolated per tenant (workspace_id) and enforced by Postgres Row Level Security (RLS). Sensitive WhatsApp credentials are encrypted with AES-256-GCM in server-exclusive storage and are never exposed to browsers or client logs.",
        },
      ],
    },
    {
      heading: { id: "5. Retensi Data & Meta Conversions API", en: "5. Data Retention & Meta Conversions API" },
      paragraphs: [
        {
          id: "Jika Anda mengaktifkan Meta Conversions API (CAPI) for Business Messaging, Haspro mengirimkan sinyal tahapan terverifikasi (QualifiedLead, Schedule, Purchase) beserta ctwa_clid ke Meta Graph API agar algoritma iklan Meta dapat mengoptimalkan kualitas prospek Anda.",
          en: "When Meta Conversions API (CAPI) for Business Messaging is configured, Haspro transmits verified funnel milestones (QualifiedLead, Schedule, Purchase) with the corresponding ctwa_clid to the Meta Graph API to help optimize your ad delivery.",
        },
        {
          id: "Jika Anda memutuskan nomor WhatsApp di halaman Koneksi WhatsApp, token akses rahasia langsung dihapus permanen. Data historis percakapan dan analitik tetap disimpan di workspace untuk keperluan pelaporan audit Anda hingga Anda meminta penghapusan workspace atau menggunakan alur Penghapusan Data.",
          en: "When you disconnect a WhatsApp number in WhatsApp Connections, encrypted access tokens are immediately and permanently deleted. Historical conversation analytics remain in your workspace for audit reporting until you request deletion via our Data Deletion procedure.",
        },
      ],
    },
    {
      heading: { id: "6. Kontak Dukungan & Privasi", en: "6. Privacy & Support Contact" },
      paragraphs: [
        {
          id: "Haspro Digital Creative (hdcreative.cloud). Untuk pertanyaan privasi, pencabutan akses, atau permintaan penghapusan data tenant, hubungi tim dukungan kami di support@hdcreative.cloud atau ikuti instruksi pada https://hdcreative.cloud/data-deletion.",
          en: "Haspro Digital Creative (hdcreative.cloud). For privacy inquiries, access revocation, or tenant data deletion requests, contact support@hdcreative.cloud or follow the instructions at https://hdcreative.cloud/data-deletion.",
        },
      ],
    },
  ],
};

export const termsOfService: LegalDocument = {
  title: { id: "Ketentuan Layanan", en: "Terms of Service" },
  description: {
    id: "Ketentuan penggunaan Haspro (hdcreative.cloud) — Platform AI-Powered CTWA Lead Intelligence untuk tim pemasaran properti.",
    en: "Terms of Service for Haspro (hdcreative.cloud) — AI-Powered CTWA Lead Intelligence for property marketing teams.",
  },
  sections: [
    {
      heading: { id: "1. Deskripsi Layanan", en: "1. Service Description" },
      paragraphs: [
        {
          id: "Haspro (hdcreative.cloud) disediakan oleh Haspro Digital Creative untuk membantu pengembang dan agensi properti mengevaluasi kualitas leads WhatsApp yang berasal dari iklan Click-to-WhatsApp (CTWA), mengukur First Response Time (FRT), serta menghitung Cost per Qualified Lead (CPQL).",
          en: "Haspro (hdcreative.cloud) is operated by Haspro Digital Creative to help property developers and agencies evaluate Click-to-WhatsApp (CTWA) lead quality, measure sales First Response Time (FRT), and compute Cost per Qualified Lead (CPQL).",
        },
      ],
    },
    {
      heading: { id: "2. Kewenangan Workspace & Integrasi Meta", en: "2. Workspace Authority & Meta Integrations" },
      paragraphs: [
        {
          id: "Anda menyatakan berwenang atas nomor WhatsApp Business dan akun Meta Ads yang Anda hubungkan melalui Embedded Signup atau OAuth. Pengaturan koneksi hanya boleh dilakukan oleh pengguna dengan peran Owner atau Admin pada workspace bersangkutan.",
          en: "You represent that you are authorized to connect the WhatsApp Business numbers and Meta Ads accounts linked through Embedded Signup or OAuth. Connection management is restricted to workspace Owners and Admins.",
        },
      ],
    },
    {
      heading: { id: "3. Batasan Analysis-Only & Kontrol Manusia", en: "3. Analysis-Only Scope & Human Governance" },
      paragraphs: [
        {
          id: "Haspro tidak mengirim pesan komersial, spam, atau balasan otomatis ke prospek. Penilaian AI merupakan alat bantu intelijen bisnis berbasis transkrip percakapan dan berada di bawah kendali manusia melalui fitur Human Override dan Manual Stage Lock.",
          en: "Haspro does not send commercial messages, spam, or automated replies to prospects. AI scoring is an analytical decision-support aid subject to human oversight via Human Override and Manual Stage Lock controls.",
        },
      ],
    },
    {
      heading: { id: "4. Penggunaan yang Dilarang", en: "4. Prohibited Use" },
      lists: [
        {
          items: [
            {
              id: "Mencoba mengakses data workspace lain atau melewati mekanisme isolasi tenant.",
              en: "Attempting to access another workspace's data or bypass tenant isolation controls.",
            },
            {
              id: "Menggunakan layanan untuk aktivitas yang melanggar Kebijakan Meta WhatsApp Business, Meta Advertising Standards, atau peraturan perlindungan data pribadi yang berlaku.",
              en: "Using the service in violation of Meta WhatsApp Business Policies, Meta Advertising Standards, or applicable data protection laws.",
            },
          ],
        },
      ],
    },
    {
      heading: { id: "5. Penghentian & Kontak", en: "5. Termination & Contact" },
      paragraphs: [
        {
          id: "Anda dapat memutuskan koneksi WhatsApp atau meminta penghapusan data kapan saja melalui halaman Penghapusan Data (/data-deletion) atau menghubungi support@hdcreative.cloud.",
          en: "You may disconnect WhatsApp numbers or request data deletion at any time via the Data Deletion page (/data-deletion) or by contacting support@hdcreative.cloud.",
        },
      ],
    },
  ],
};

export const dataDeletion: LegalDocument = {
  title: { id: "Penghapusan Data Pengguna", en: "User Data Deletion Instructions" },
  description: {
    id: "Panduan resmi cara memutuskan koneksi WhatsApp Business / Meta dan meminta penghapusan data di Haspro (hdcreative.cloud).",
    en: "Official instructions to disconnect WhatsApp Business / Meta access and request data deletion on Haspro (hdcreative.cloud).",
  },
  sections: [
    {
      heading: { id: "1. Putuskan Nomor WhatsApp di Dashboard Haspro", en: "1. Disconnect WhatsApp in Haspro Dashboard" },
      lists: [
        {
          ordered: true,
          items: [
            {
              id: "Masuk ke workspace Anda di https://hdcreative.cloud dan buka menu Koneksi WhatsApp (/connections).",
              en: "Sign in to your workspace at https://hdcreative.cloud and open WhatsApp Connections (/connections).",
            },
            {
              id: "Klik tombol Putuskan (Disconnect) pada nomor WhatsApp yang ingin dicabut. Tindakan ini segera mengubah status menjadi disconnected dan menghapus token akses Meta terenkripsi dari penyimpanan rahasia kami.",
              en: "Click Disconnect on the desired WhatsApp number. This immediately marks the connection disconnected and permanently deletes the encrypted Meta access token from our secrets storage.",
            },
            {
              id: "Secara paralel, Anda juga dapat mencabut izin aplikasi Haspro melalui Facebook Business Integrations pada pengaturan akun Meta Anda.",
              en: "You can also revoke Haspro app permissions directly in Facebook Business Integrations under your Meta account settings.",
            },
          ],
        },
      ],
    },
    {
      heading: { id: "2. Meminta Penghapusan Penuh Data Workspace / Leads", en: "2. Request Full Workspace / Lead Data Deletion" },
      lists: [
        {
          ordered: true,
          items: [
            {
              id: "Kirim permintaan ke support@hdcreative.cloud dengan subjek \"Data Deletion Request — <Nama Workspace>\" dari email Owner/Admin workspace.",
              en: "Email support@hdcreative.cloud with subject \"Data Deletion Request — <Workspace Name>\" from the workspace Owner/Admin email.",
            },
            {
              id: "Jika Anda menghapus integrasi aplikasi langsung dari pengaturan Meta Facebook, Meta akan memanggil endpoint otomatis Data Deletion Callback kami dan menampilkan kode konfirmasi penghapusan Anda.",
              en: "If you remove the app directly from Meta Facebook settings, Meta triggers our automated Data Deletion Callback and provides a confirmation code for tracking.",
            },
            {
              id: "Tim kami memproses penghapusan riwayat percakapan, data leads, hasil analisis AI, dan snapshot iklan dalam maksimal 7 hari kerja setelah verifikasi kepemilikan.",
              en: "Our team purges conversation transcripts, lead records, AI snapshots, and ad insights within 7 business days upon ownership verification.",
            },
          ],
        },
      ],
    },
    {
      heading: { id: "3. Kontak Dukungan", en: "3. Support Contact" },
      paragraphs: [
        {
          id: "Untuk status permintaan atau kode konfirmasi penghapusan data, hubungi support@hdcreative.cloud.",
          en: "To check deletion request status or follow up with a confirmation code, email support@hdcreative.cloud.",
        },
      ],
    },
  ],
};
