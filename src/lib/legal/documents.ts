import type { LegalDocument } from "@/components/legal/LegalPageLayout";

export const privacyPolicy: LegalDocument = {
  title: { id: "Kebijakan Privasi", en: "Privacy Policy" },
  description: {
    id: "Kebijakan ini menjelaskan pemrosesan data pada HD Creative, produk analitik pemasaran properti dari Haspro Digital Creative.",
    en: "This policy explains how HD Creative, a property marketing analytics product by Haspro Digital Creative, processes data.",
  },
  sections: [
    {
      heading: { id: "1. Data yang kami proses", en: "1. Data we process" },
      paragraphs: [
        {
          id: "Kami memproses informasi akun dan organisasi seperti nama, alamat email, peran, serta data autentikasi yang dikelola penyedia autentikasi kami. Jika Anda menghubungkan Meta Ads, kami menerima identitas koneksi yang tersedia, izin yang diberikan, akun iklan yang Anda pilih, serta data kampanye, iklan, dan performa yang dapat dibaca dari akun tersebut.",
          en: "We process account and organization information such as name, email address, role, and authentication data managed by our authentication provider. If you connect Meta Ads, we receive available connection identity, granted permissions, the ad accounts you select, and campaign, ad, and performance data readable from those accounts.",
        },
        {
          id: "Jika Anda menggunakan CRM, data prospek yang Anda masukkan atau unggah—yang dapat mencakup nama, nomor telepon, catatan, dan tahap tindak lanjut—diproses untuk menampilkan CRM dan laporan atribusi di organisasi Anda. Anda bertanggung jawab memastikan Anda memiliki dasar dan izin yang diperlukan untuk mengunggah data tersebut.",
          en: "If you use the CRM, prospect data you enter or upload—which may include names, phone numbers, notes, and follow-up stages—is processed to provide CRM and attribution reports to your organization. You are responsible for ensuring you have the required basis and permissions to upload that data.",
        },
      ],
    },
    {
      heading: { id: "2. Cara kami menggunakan data", en: "2. How we use data" },
      lists: [{ items: [
        { id: "Menyediakan akun, ruang kerja organisasi, pengaturan integrasi, sinkronisasi, dan laporan yang Anda minta.", en: "Provide the account, organization workspace, integration settings, synchronization, and reports you request." },
        { id: "Menghitung metrik dari data iklan dan data CRM yang tersedia untuk organisasi Anda.", en: "Calculate metrics from advertising and CRM data available to your organization." },
        { id: "Menjaga keamanan, mencegah penyalahgunaan, memecahkan masalah, dan memenuhi kewajiban hukum yang berlaku.", en: "Maintain security, prevent abuse, troubleshoot, and meet applicable legal obligations." },
      ] }],
      paragraphs: [{
        id: "HD Creative menggunakan koneksi Meta untuk membaca data iklan. Aplikasi tidak membuat atau mengubah kampanye, iklan, anggaran, bidding, atau status delivery Anda.",
        en: "HD Creative uses the Meta connection to read advertising data. The application does not create or change your campaigns, ads, budgets, bidding, or delivery status.",
      }],
    },
    {
      heading: { id: "3. Koneksi Meta", en: "3. Meta connection" },
      paragraphs: [
        {
          id: "Jika Anda mengotorisasi koneksi Meta, HD Creative menyimpan kredensial akses terenkripsi di sisi server dan meminta izin baca iklan yang diperlukan untuk fungsi yang Anda gunakan. Data Meta digunakan untuk menyediakan layanan bagi organisasi yang mengotorisasi koneksi tersebut. Anda dapat memutuskan koneksi dari Settings → Integrations → Meta Ads. Pemutusan menghapus kredensial tersimpan untuk organisasi itu dan tidak menghapus atau mengubah aset di Meta.",
          en: "If you authorize a Meta connection, HD Creative stores encrypted access credentials server-side and requests the advertising read permission needed for the functions you use. Meta data is used to provide the service to the organization that authorized the connection. You can disconnect it from Settings → Integrations → Meta Ads. Disconnecting removes the stored credentials for that organization and does not delete or change assets on Meta.",
        },
        {
          id: "Penggunaan data yang diterima dari Meta tunduk pada kebijakan dan ketentuan Meta yang berlaku. HD Creative tidak berafiliasi dengan atau didukung oleh Meta.",
          en: "Use of data received from Meta is subject to Meta's applicable policies and terms. HD Creative is not affiliated with or endorsed by Meta.",
        },
      ],
    },
    {
      heading: { id: "4. Penyimpanan dan perlindungan", en: "4. Storage and protection" },
      paragraphs: [
        {
          id: "Data akun, integrasi, sinkronisasi, kampanye, Insights, dan CRM disimpan pada layanan basis data dan autentikasi yang digunakan untuk menjalankan HD Creative. Kredensial Meta dienkripsi saat disimpan. Kami menerapkan pembatasan akses organisasi di aplikasi dan basis data. Tidak ada sistem yang dapat menjamin keamanan mutlak.",
          en: "Account, integration, synchronization, campaign, Insights, and CRM data is stored with the database and authentication services used to operate HD Creative. Meta credentials are encrypted at rest. We apply organization-level access controls in the application and database. No system can guarantee absolute security.",
        },
        {
          id: "Data disimpan selama diperlukan untuk menyediakan layanan, menjaga riwayat laporan organisasi, dan memenuhi kewajiban yang berlaku. Untuk meminta penghapusan data, ikuti petunjuk pada halaman Penghapusan Data.",
          en: "Data is retained as needed to provide the service, maintain organization reporting history, and meet applicable obligations. To request deletion, follow the instructions on the Data Deletion page.",
        },
      ],
    },
    {
      heading: { id: "5. Pemroses dan pengungkapan", en: "5. Processors and disclosure" },
      paragraphs: [{
        id: "Kami menggunakan penyedia layanan yang diperlukan untuk autentikasi, penyimpanan basis data, dan koneksi yang Anda pilih. Data tidak dijual. Data hanya dapat diungkapkan jika diperlukan untuk menyediakan layanan, atas instruksi atau persetujuan Anda, untuk melindungi layanan dan pengguna, atau jika diwajibkan oleh hukum.",
        en: "We use service providers needed for authentication, database storage, and connections you choose. We do not sell data. Data may be disclosed only as needed to provide the service, at your direction or with your consent, to protect the service and users, or when required by law.",
      }],
    },
    {
      heading: { id: "6. Pilihan dan hak Anda", en: "6. Your choices and rights" },
      paragraphs: [{
        id: "Anda dapat mengelola koneksi Meta dan akun iklan terpilih dari pengaturan organisasi. Untuk permintaan akses, koreksi, atau penghapusan data, hubungi pemilik/admin organisasi dan gunakan kanal dukungan Haspro yang disampaikan saat onboarding atau dalam perjanjian layanan. Permintaan dapat memerlukan verifikasi identitas dan kewenangan organisasi.",
        en: "You can manage the Meta connection and selected ad accounts in organization settings. For access, correction, or deletion requests, contact your organization owner/admin and use the Haspro support channel provided during onboarding or in your service agreement. Requests may require identity and organizational-authority verification.",
      }],
    },
    {
      heading: { id: "7. Perubahan dan kontak", en: "7. Changes and contact" },
      paragraphs: [{
        id: "Kami dapat memperbarui kebijakan ini ketika layanan atau kewajiban yang berlaku berubah. Versi terbaru tersedia di URL ini. HD Creative disediakan oleh Haspro Digital Creative. Untuk pertanyaan privasi, hubungi kanal dukungan Haspro pada perjanjian atau komunikasi onboarding organisasi Anda.",
        en: "We may update this policy when the service or applicable obligations change. The latest version is available at this URL. HD Creative is provided by Haspro Digital Creative. For privacy questions, contact the Haspro support channel in your organization's agreement or onboarding communications.",
      }],
    },
  ],
};

export const termsOfService: LegalDocument = {
  title: { id: "Ketentuan Layanan", en: "Terms of Service" },
  description: {
    id: "Ketentuan penggunaan HD Creative, layanan analitik iklan dan data prospek untuk organisasi pemasaran properti.",
    en: "Terms for using HD Creative, an advertising and prospect-data analytics service for property marketing organizations.",
  },
  sections: [
    {
      heading: { id: "1. Tentang layanan", en: "1. About the service" },
      paragraphs: [{ id: "HD Creative disediakan oleh Haspro Digital Creative. Layanan membantu organisasi menghubungkan akun Meta Ads secara baca saja, meninjau performa iklan, dan mengelola data prospek yang dimasukkan atau diunggah pengguna organisasi.", en: "HD Creative is provided by Haspro Digital Creative. The service helps organizations connect Meta Ads accounts in read-only mode, review advertising performance, and manage prospect data entered or uploaded by organization users." }],
    },
    {
      heading: { id: "2. Akun dan kewenangan", en: "2. Accounts and authority" },
      paragraphs: [{ id: "Anda harus memberikan informasi akun yang benar, menjaga keamanan kredensial masuk, dan hanya menggunakan layanan atas nama organisasi yang mengizinkan Anda. Pemilik dan administrator organisasi mengelola anggota, integrasi, dan akses data organisasi. Anda bertanggung jawab mengamankan perangkat dan sesi Anda.", en: "You must provide accurate account information, protect your sign-in credentials, and use the service only on behalf of an organization that authorizes you. Organization owners and administrators manage members, integrations, and access to organization data. You are responsible for securing your devices and sessions." }],
    },
    {
      heading: { id: "3. Koneksi pihak ketiga dan data klien", en: "3. Third-party connections and client data" },
      paragraphs: [
        { id: "Anda hanya boleh menghubungkan akun Meta yang berhak Anda akses dan memberikan izin yang diperlukan. HD Creative membaca data iklan yang diotorisasi dan tidak mengubah kampanye, iklan, anggaran, bidding, atau pengaturan akun Meta.", en: "You may connect only Meta accounts you are authorized to access and grant the required permissions. HD Creative reads authorized advertising data and does not change campaigns, ads, budgets, bidding, or Meta account settings." },
        { id: "Anda bertanggung jawab atas data CRM yang dimasukkan atau diunggah, termasuk keakuratan, izin pemrosesan, dan kepatuhan terhadap hukum yang berlaku. Jangan mengunggah data yang tidak berhak Anda berikan kepada layanan.", en: "You are responsible for CRM data you enter or upload, including its accuracy, processing permissions, and compliance with applicable law. Do not upload data you are not authorized to provide to the service." },
      ],
    },
    {
      heading: { id: "4. Analitik dan ketersediaan data", en: "4. Analytics and data availability" },
      paragraphs: [{ id: "Laporan bergantung pada akses, izin, respons API Meta, rentang tanggal, dan data yang Anda berikan. Metrik dapat kosong atau terlambat jika sumber tidak menyediakan data, izin berubah, sinkronisasi gagal, atau periode yang dipilih tidak memiliki aktivitas. Analitik dan rekomendasi adalah alat bantu informasi, bukan jaminan hasil iklan, penjualan, atau nasihat profesional.", en: "Reports depend on access, permissions, Meta API responses, date ranges, and data you provide. Metrics may be empty or delayed if a source does not provide data, permissions change, synchronization fails, or the selected period has no activity. Analytics and recommendations are informational tools, not guarantees of advertising or sales outcomes or professional advice." }],
    },
    {
      heading: { id: "5. Penggunaan yang dilarang", en: "5. Prohibited use" },
      lists: [{ items: [
        { id: "Mengakses data organisasi lain atau melewati kontrol akses.", en: "Access another organization's data or bypass access controls." },
        { id: "Menggunakan layanan untuk melanggar hukum, hak privasi, hak kekayaan intelektual, atau ketentuan platform pihak ketiga.", en: "Use the service to violate law, privacy rights, intellectual-property rights, or third-party platform terms." },
        { id: "Mengganggu atau merusak keamanan dan ketersediaan layanan tanpa izin.", en: "Disrupt or compromise the service's security or availability without authorization." },
        { id: "Menggunakan layanan untuk mengirim perubahan iklan atau aktivitas Meta yang tidak disediakan oleh fitur baca saja HD Creative.", en: "Use the service to send ad changes or Meta actions that are not provided by HD Creative's read-only features." },
      ] }],
    },
    {
      heading: { id: "6. Penangguhan, penghentian, dan penghapusan", en: "6. Suspension, termination, and deletion" },
      paragraphs: [{ id: "Anda dapat memutuskan integrasi Meta dari pengaturan organisasi. Pemutusan menghapus kredensial Meta tersimpan untuk organisasi tersebut, tetapi tidak mengubah aset Meta atau otomatis menghapus seluruh data historis di HD Creative. Permintaan penghapusan dijelaskan pada halaman Penghapusan Data. Kami dapat membatasi akses jika diperlukan untuk keamanan, mencegah penyalahgunaan, atau mematuhi hukum.", en: "You can disconnect the Meta integration in organization settings. Disconnecting removes stored Meta credentials for that organization, but does not change Meta assets or automatically delete all historical data in HD Creative. Deletion requests are described on the Data Deletion page. We may restrict access when needed for security, abuse prevention, or legal compliance." }],
    },
    {
      heading: { id: "7. Perubahan ketentuan", en: "7. Changes to these terms" },
      paragraphs: [{ id: "Ketentuan ini dapat diperbarui saat layanan berubah. Ketentuan terbaru dipublikasikan pada URL ini. Jika Anda tidak setuju, hentikan penggunaan layanan dan minta administrator organisasi memutuskan koneksi.", en: "These terms may be updated as the service changes. The current terms are published at this URL. If you disagree, stop using the service and ask your organization administrator to disconnect the integration." }],
    },
    {
      heading: { id: "8. Kontak", en: "8. Contact" },
      paragraphs: [{ id: "Untuk pertanyaan mengenai layanan atau ketentuan ini, hubungi Haspro Digital Creative melalui kanal dukungan yang disampaikan saat onboarding atau dalam perjanjian layanan organisasi Anda.", en: "For questions about the service or these terms, contact Haspro Digital Creative through the support channel provided during onboarding or in your organization's service agreement." }],
    },
  ],
};

export const dataDeletion: LegalDocument = {
  title: { id: "Penghapusan Data Pengguna", en: "User Data Deletion" },
  description: {
    id: "Cara memutuskan akses Meta dan meminta penghapusan data yang terkait dengan akun atau organisasi HD Creative Anda.",
    en: "How to disconnect Meta access and request deletion of data associated with your HD Creative account or organization.",
  },
  sections: [
    {
      heading: { id: "Putuskan koneksi Meta", en: "Disconnect Meta" },
      lists: [{ ordered: true, items: [
        { id: "Masuk ke HD Creative dan buka Settings → Integrations → Meta Ads.", en: "Sign in to HD Creative and open Settings → Integrations → Meta Ads." },
        { id: "Pilih Putuskan Koneksi lalu konfirmasi. Kredensial Meta tersimpan untuk organisasi akan dihapus dan akun iklan ditandai tidak terhubung.", en: "Choose Disconnect and confirm. Stored Meta credentials for the organization will be deleted and its ad accounts marked disconnected." },
        { id: "Untuk mencabut izin aplikasi pada sisi Meta, buka pengaturan Business Integrations di Facebook dan hapus HD Creative dari daftar aplikasi yang terhubung.", en: "To revoke the app's permission on Meta, open Facebook Business Integrations settings and remove HD Creative from connected apps." },
      ] }],
      paragraphs: [{ id: "Langkah tersebut hanya memutus akses integrasi. Langkah itu tidak menghapus akun iklan atau aset Anda dari Meta dan tidak otomatis menghapus data lain yang telah tersimpan di HD Creative.", en: "These steps only disconnect the integration. They do not delete your ad account or assets from Meta, and do not automatically delete other data already stored in HD Creative." }],
    },
    {
      heading: { id: "Minta penghapusan data HD Creative", en: "Request deletion of HD Creative data" },
      lists: [{ ordered: true, items: [
        { id: "Hubungi pemilik atau administrator organisasi Anda untuk mengidentifikasi akun dan organisasi yang datanya diminta untuk dihapus.", en: "Contact your organization owner or administrator to identify the account and organization whose data should be deleted." },
        { id: "Pemilik/admin organisasi harus mengajukan permintaan kepada Haspro Digital Creative melalui kanal dukungan yang digunakan saat onboarding atau tercantum dalam perjanjian layanan.", en: "The organization owner/admin should submit the request to Haspro Digital Creative through the support channel used during onboarding or listed in the service agreement." },
        { id: "Sertakan alamat email akun HD Creative, nama organisasi, serta apakah permintaan mencakup data koneksi Meta, laporan iklan tersimpan, data CRM yang diunggah, atau seluruh data akun.", en: "Include the HD Creative account email, organization name, and whether the request covers Meta connection data, stored advertising reports, uploaded CRM data, or all account data." },
        { id: "Kami akan memverifikasi identitas dan kewenangan pemohon, lalu menghapus atau menganonimkan data yang dapat dihapus dan mengonfirmasi penyelesaian melalui kanal dukungan tersebut.", en: "We will verify the requester and their authority, then delete or anonymize eligible data and confirm completion through that support channel." },
      ] }],
      paragraphs: [{ id: "Permintaan diproses sesuai hukum yang berlaku dan kewajiban penyimpanan yang sah. Data yang harus dipertahankan untuk keamanan, audit, atau kewajiban hukum akan dibatasi dan dihapus ketika alasan penyimpanannya berakhir.", en: "Requests are handled under applicable law and legitimate retention obligations. Data that must be retained for security, audit, or legal obligations will be restricted and deleted when the retention reason ends." }],
    },
    {
      heading: { id: "Data yang dapat tercakup", en: "Data that may be covered" },
      paragraphs: [{ id: "Permintaan dapat mencakup kredensial koneksi Meta, daftar akun iklan yang dipilih, data kampanye dan Insights yang tersinkron, profil anggota organisasi, serta data prospek CRM yang dimasukkan atau diunggah. Menghapus koneksi Meta tidak menghapus data tersebut secara otomatis.", en: "A request may cover Meta connection credentials, selected ad account lists, synchronized campaign and Insights data, organization member profiles, and prospect data entered or uploaded to the CRM. Disconnecting Meta does not automatically delete this data." }],
    },
    {
      heading: { id: "Penghapusan melalui Meta", en: "Deletion through Meta" },
      paragraphs: [{ id: "Anda juga dapat mencabut akses HD Creative melalui pengaturan aplikasi dan integrasi Facebook. Tindakan di Meta mencabut izin aplikasi, tetapi tidak otomatis menghapus salinan data yang sebelumnya tersimpan di HD Creative. Gunakan langkah permintaan penghapusan di atas untuk meminta penghapusan dari layanan kami.", en: "You can also revoke HD Creative's access in Facebook app and integration settings. This revokes the app permission on Meta, but does not automatically delete copies of data previously stored in HD Creative. Use the deletion request steps above to request deletion from our service." }],
    },
  ],
};
