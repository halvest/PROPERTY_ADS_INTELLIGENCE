export type AngleCluster =
  | "emotional"
  | "financial"
  | "location"
  | "architectural"
  | "conversion";

export interface MarketingAngleTemplate {
  id: string;
  cluster: AngleCluster;
  name: string;
  tagline: string;
  targetAudience: string;
  buyerMotivation: string;
  recommendedHeadlineHook: string;
  visualCompositionStrategy: string;
  recommendedColorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    backgroundOverlay: string;
    textColor: string;
  };
  typographyDirection: {
    fontFamily: string;
    headlineWeight: string;
    letterSpacing: string;
  };
  ctaRecommendation: string;
  suggestedPills: string[];
}

export const ANGLE_CLUSTERS: Array<{ id: AngleCluster; label: string; icon: string }> = [
  { id: "conversion", label: "Direct Conversion", icon: "⚡" },
  { id: "emotional", label: "Emotional & Lifestyle", icon: "❤️" },
  { id: "financial", label: "Financial & Promo", icon: "💰" },
  { id: "location", label: "Location & Transit", icon: "📍" },
  { id: "architectural", label: "Architecture & Design", icon: "🏛️" },
];

export const MARKETING_ANGLES: MarketingAngleTemplate[] = [
  // ----------------------------------------------------
  // CLUSTER 1: CONVERSION MARKETING (Meta Ads Direct Response)
  // ----------------------------------------------------
  {
    id: "whatsapp_direct",
    cluster: "conversion",
    name: "WhatsApp Lead Generator",
    tagline: "Dioptimasi untuk respons langsung & klik chat WhatsApp",
    targetAudience: "Pencari rumah aktif yang siap survei lokasi",
    buyerMotivation: "Kemudahan bertanya langsung tanpa birokrasi rumit",
    recommendedHeadlineHook: "Klaim Promo Spesial Launching via WhatsApp Hari Ini!",
    visualCompositionStrategy: "Fasad jernih dengan tombol aksi WhatsApp hijau kontras tinggi di sudut kanan bawah",
    recommendedColorPalette: {
      primary: "#064E3B",
      secondary: "#022C22",
      accent: "#25D366", // WhatsApp Green
      backgroundOverlay: "linear-gradient(180deg, rgba(6,78,59,0.1) 0%, rgba(2,44,34,0.95) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "900",
      letterSpacing: "-0.03em",
    },
    ctaRecommendation: "Chat WhatsApp Sekarang",
    suggestedPills: ["Respon Cepat 24 Jam", "Katalog PDF Gratis", "Jadwal Survei"],
  },
  {
    id: "special_launching",
    cluster: "conversion",
    name: "Special Launching Phase 1",
    tagline: "Menciptakan momentum harga perdana awal rilis",
    targetAudience: "Investor & pembeli pintar yang mengejar harga terendah",
    buyerMotivation: "Mendapatkan harga modal sebelum kenaikan harga tahap berikutnya",
    recommendedHeadlineHook: "Harga Perdana Tahap 1 — Unit Terbatas Sebelum Kenaikan!",
    visualCompositionStrategy: "Badge 'Harga Perdana' merah berani dengan kontras dinamis",
    recommendedColorPalette: {
      primary: "#18181B",
      secondary: "#27272A",
      accent: "#F43F5E", // Rose Red
      backgroundOverlay: "linear-gradient(180deg, rgba(24,24,27,0.15) 0%, rgba(9,9,11,0.96) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Klaim Harga Perdana",
    suggestedPills: ["Harga Perdana", "Tahap 1", "Unit Terbatas"],
  },
  {
    id: "limited_units",
    cluster: "conversion",
    name: "Limited Available Units",
    tagline: "Pemicu urgensi kelangkaan unit siap huni",
    targetAudience: "Pembeli yang sedang membandingkan opsi dan ragu-ragu",
    buyerMotivation: "Takut kehabisan unit terbaik (FOMO)",
    recommendedHeadlineHook: "Sisa 3 Unit Terakhir Blok Sudut! Siap Huni Tahun Ini",
    visualCompositionStrategy: "Fokus framing pada posisi unit istimewa dengan count badge",
    recommendedColorPalette: {
      primary: "#450A0A",
      secondary: "#7F1D1D",
      accent: "#EF4444", // Urgent Crimson
      backgroundOverlay: "linear-gradient(180deg, rgba(69,10,10,0.2) 0%, rgba(20,20,20,0.95) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "900",
      letterSpacing: "-0.03em",
    },
    ctaRecommendation: "Kunci Unit Pilihan",
    suggestedPills: ["Sisa 3 Unit", "Siap Huni", "Blok Sudut"],
  },
  {
    id: "early_bird",
    cluster: "conversion",
    name: "Early Bird Privilege",
    tagline: "Hak istimewa pemilihan unit & bonus furnitur",
    targetAudience: "Early adopters kawasan hunian baru",
    buyerMotivation: "Bonus eksklusif yang tidak didapatkan pembeli umum",
    recommendedHeadlineHook: "Privilege Early Bird: NUP Prioritas & Free Smart Home Kit",
    visualCompositionStrategy: "Tipografi modern elegan dengan kartu privilege gold",
    recommendedColorPalette: {
      primary: "#1E1B4B",
      secondary: "#312E81",
      accent: "#38BDF8", // Cyan / Gold
      backgroundOverlay: "linear-gradient(180deg, rgba(30,27,75,0.2) 0%, rgba(9,9,11,0.95) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Ambil NUP Sekarang",
    suggestedPills: ["Free Smart Home", "NUP Prioritas", "Pilih Unit Duluan"],
  },

  // ----------------------------------------------------
  // CLUSTER 2: EMOTIONAL MARKETING
  // ----------------------------------------------------
  {
    id: "dream_home",
    cluster: "emotional",
    name: "Dream Home & First Nest",
    tagline: "Membangkitkan kebanggaan memiliki rumah impian pertama",
    targetAudience: "Pasangan baru menikah, first-time home buyers",
    buyerMotivation: "Pencapaian hidup mandiri dan memiliki aset keluarga",
    recommendedHeadlineHook: "Wujudkan Rumah Impian Pertama untuk Awal Cerita Bahagia",
    visualCompositionStrategy: "Pencahayaan warm daylight natural, taman asri yang menyambut",
    recommendedColorPalette: {
      primary: "#1C1917",
      secondary: "#292524",
      accent: "#D97706", // Warm Amber
      backgroundOverlay: "linear-gradient(180deg, rgba(28,25,23,0.15) 0%, rgba(12,10,9,0.94) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "'Playfair Display', serif",
      headlineWeight: "700",
      letterSpacing: "-0.01em",
    },
    ctaRecommendation: "Mulai Wujudkan Rumah",
    suggestedPills: ["Cocok Pasangan Baru", "Lingkungan Asri", "Lingkungan Aman"],
  },
  {
    id: "family_lifestyle",
    cluster: "emotional",
    name: "Family Lifestyle & Growth",
    tagline: "Ruang tumbuh terbaik untuk kebahagiaan anak",
    targetAudience: "Keluarga mapan dengan 1-3 anak",
    buyerMotivation: "Memberikan lingkungan bertumbuh yang sehat dan ramah anak",
    recommendedHeadlineHook: "Hunian Nyaman dengan Ruang Tumbuh Sempurna untuk Buah Hati",
    visualCompositionStrategy: "Perspektif fasad 2 lantai lapang dengan latar langit sore cerah",
    recommendedColorPalette: {
      primary: "#064E3B",
      secondary: "#065F46",
      accent: "#10B981", // Emerald Sage
      backgroundOverlay: "linear-gradient(180deg, rgba(6,78,59,0.15) 0%, rgba(6,78,59,0.92) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Jadwalkan Kunjungan",
    suggestedPills: ["Playground Luas", "Clubhouse", "2 Lantai Lapang"],
  },
  {
    id: "modern_living",
    cluster: "emotional",
    name: "Modern Urban Living",
    tagline: "Gaya hidup modern dinamis dengan teknologi pintar",
    targetAudience: "Profesional muda perkotaan, tech-savvy workers",
    buyerMotivation: "Efisiensi, kepraktisan, dan estetika rumah modern",
    recommendedHeadlineHook: "Desain Kontemporer dengan Smart Home System Terintegrasi",
    visualCompositionStrategy: "Garis geometris arsitektur yang tegas dan pencahayaan aksen",
    recommendedColorPalette: {
      primary: "#0F172A",
      secondary: "#1E293B",
      accent: "#38BDF8", // Electric Blue
      backgroundOverlay: "linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.92) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "800",
      letterSpacing: "-0.03em",
    },
    ctaRecommendation: "Lihat Fitur Smart Home",
    suggestedPills: ["Smart Door Lock", "Solar Panel Ready", "Fiber Optic"],
  },
  {
    id: "comfort_security",
    cluster: "emotional",
    name: "Comfort & Security Haven",
    tagline: "Privasi dan ketenangan pikiran maksimal 24 jam",
    targetAudience: "Pembeli yang mengutamakan keamanan dan ketenangan keluarga",
    buyerMotivation: "Rasa tenang meninggalkan rumah saat bekerja atau bepergian",
    recommendedHeadlineHook: "Ketenangan Hidup Maksimal dalam One-Gate System Eksklusif",
    visualCompositionStrategy: "Komposisi simetris elegan dengan nuansa prestise gerbang kawasan",
    recommendedColorPalette: {
      primary: "#18181B",
      secondary: "#27272A",
      accent: "#A1A1AA", // Platinum Slate
      backgroundOverlay: "linear-gradient(180deg, rgba(24,24,27,0.2) 0%, rgba(9,9,11,0.95) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "700",
      letterSpacing: "-0.01em",
    },
    ctaRecommendation: "Pelajari Kawasan",
    suggestedPills: ["One Gate 24/7", "CCTV Lingkungan", "Bebas Banjir"],
  },

  // ----------------------------------------------------
  // CLUSTER 3: FINANCIAL MARKETING
  // ----------------------------------------------------
  {
    id: "affordable_opportunity",
    cluster: "financial",
    name: "Affordable Opportunity (Cicilan Ringan)",
    tagline: "Kemudahan kepemilikan rumah lebih murah dari sewa",
    targetAudience: "Keluarga muda berpenghasilan 10-25 juta/bulan",
    buyerMotivation: "Mengalihkan uang sewa kontrakan menjadi aset milik sendiri",
    recommendedHeadlineHook: "Punya Rumah Sendiri Sekarang Lebih Mudah dari Bayar Sewa!",
    visualCompositionStrategy: "Penonjolan badge nominal cicilan bulanan yang terjangkau",
    recommendedColorPalette: {
      primary: "#064E3B",
      secondary: "#047857",
      accent: "#34D399", // Fresh Mint
      backgroundOverlay: "linear-gradient(180deg, rgba(6,78,59,0.15) 0%, rgba(6,78,59,0.92) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "900",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Hitung Simulasi KPR",
    suggestedPills: ["DP 0%", "Cicilan Mulai 4 Jt", "Bebas PPN DTP"],
  },
  {
    id: "investment_potential",
    cluster: "financial",
    name: "Capital Gain & Investment",
    tagline: "Peluang pertumbuhan aset tinggi di koridor emas",
    targetAudience: "Investor properti retail dan pebisnis",
    buyerMotivation: "Kenaikan nilai tanah (*capital appreciation*) yang agresif",
    recommendedHeadlineHook: "Capital Gain Tinggi di Koridor Emas yang Terus Berkembang",
    visualCompositionStrategy: "Warna mewah gold & hitam dengan infografik proyeksi",
    recommendedColorPalette: {
      primary: "#18181B",
      secondary: "#27272A",
      accent: "#D4AF37", // Warm Gold
      backgroundOverlay: "linear-gradient(180deg, rgba(9,9,11,0.2) 0%, rgba(9,9,11,0.95) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "'Playfair Display', serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Dapatkan Analisa ROI",
    suggestedPills: ["Capital Gain 15%/thn", "Kawasan Berkembang", "Legalitas SHM"],
  },
  {
    id: "rental_income",
    cluster: "financial",
    name: "Rental Yield Maximizer",
    tagline: "Passive income stabil dari sewa ekspatriat atau mahasiswa",
    targetAudience: "Pencari instrumen penghasil arus kas pasif",
    buyerMotivation: "Cicilan KPR terbayar otomatis oleh uang sewa penyewa",
    recommendedHeadlineHook: "Passive Income Menjanjikan: Potensi Sewa hingga 12% per Tahun",
    visualCompositionStrategy: "Penekanan pada fasilitas penyewa dan daya tarik interior",
    recommendedColorPalette: {
      primary: "#1E1B4B",
      secondary: "#312E81",
      accent: "#818CF8", // Indigo Accent
      backgroundOverlay: "linear-gradient(180deg, rgba(30,27,75,0.2) 0%, rgba(9,9,11,0.94) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Cek Potensi Sewa",
    suggestedPills: ["Siap Disewakan", "Dekat Kampus/CBD", "Full Furnished Option"],
  },
  {
    id: "limited_promo",
    cluster: "financial",
    name: "Subsidi DP & Free Biaya-Biaya",
    tagline: "Paket promo finansial hemat puluhan hingga ratusan juta",
    targetAudience: "Pembeli yang terhambat biaya awal akad KPR",
    buyerMotivation: "Menghemat pengeluaran uang muka dan biaya notaris/pajak",
    recommendedHeadlineHook: "Beli Rumah Tanpa Beban: Free DP, Free PPN & Free Semua Biaya!",
    visualCompositionStrategy: "Badge diskon menonjol di sudut kiri atas dan bawah",
    recommendedColorPalette: {
      primary: "#7F1D1D",
      secondary: "#991B1B",
      accent: "#FBBF24", // Yellow Gold on Red
      backgroundOverlay: "linear-gradient(180deg, rgba(127,29,29,0.2) 0%, rgba(9,9,11,0.95) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "900",
      letterSpacing: "-0.03em",
    },
    ctaRecommendation: "Klaim Paket Promo",
    suggestedPills: ["Subsidi Biaya KPR", "Free BPHTB", "Free AJB & Balik Nama"],
  },

  // ----------------------------------------------------
  // CLUSTER 4: LOCATION MARKETING
  // ----------------------------------------------------
  {
    id: "strategic_transit",
    cluster: "location",
    name: "Transit-Oriented Connectivity",
    tagline: "Selangkah ke stasiun kereta, LRT, dan akses gerbang tol",
    targetAudience: "Komuter perkotaan yang bekerja di pusat kota",
    buyerMotivation: "Hemat waktu di jalan, bebas macet, dan kualitas hidup meningkat",
    recommendedHeadlineHook: "Hanya 5 Menit ke Gerbang Tol & Stasiun Kereta Cepat",
    visualCompositionStrategy: "Penyematan ikon pin lokasi dengan highlight aksesibilitas",
    recommendedColorPalette: {
      primary: "#0F172A",
      secondary: "#1E293B",
      accent: "#0284C7", // Transit Sky Blue
      backgroundOverlay: "linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.92) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Cek Peta Lokasi",
    suggestedPills: ["5 Mnt Tol", "3 Mnt Stasiun", "Akses 24 Jam"],
  },
  {
    id: "near_cbd",
    cluster: "location",
    name: "Near Business District",
    tagline: "Dekat kawasan perkantoran dan sentra bisnis utama",
    targetAudience: "Eksekutif, manajer, dan pemilik bisnis",
    buyerMotivation: "Mengurangi stres perjalanan dan dekat dengan relasi bisnis",
    recommendedHeadlineHook: "Lebih Dekat ke Kantor, Lebih Banyak Waktu Berkualitas di Rumah",
    visualCompositionStrategy: "Komposisi urban kontemporer yang elegan",
    recommendedColorPalette: {
      primary: "#111827",
      secondary: "#1F2937",
      accent: "#60A5FA", // Corporate Blue
      backgroundOverlay: "linear-gradient(180deg, rgba(17,24,39,0.15) 0%, rgba(17,24,39,0.94) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Lihat Rute Perjalanan",
    suggestedPills: ["10 Mnt CBD", "Bebas Ganjil Genap", "Zona Prime"],
  },
  {
    id: "accessibility_advantage",
    cluster: "location",
    name: "Lifestyle & Retail Hub",
    tagline: "Dikelilingi mall terkemuka, rumah sakit, dan sekolah internasional",
    targetAudience: "Keluarga modern yang mengutamakan fasilitas hidup lengkap",
    buyerMotivation: "Semua kebutuhan harian dan rekreasi keluarga dalam radius 10 menit",
    recommendedHeadlineHook: "Dikelilingi 3 Mall Megah, RS Internasional, & Sekolah Unggulan",
    visualCompositionStrategy: "Highlight fasilitas pendukung di sekitar properti",
    recommendedColorPalette: {
      primary: "#18181B",
      secondary: "#27272A",
      accent: "#F59E0B", // Vibrant Amber
      backgroundOverlay: "linear-gradient(180deg, rgba(24,24,27,0.15) 0%, rgba(9,9,11,0.95) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Eksplor Fasilitas Sekitar",
    suggestedPills: ["Dekat Mall Ternama", "Sekolah Internasional", "RS Unggulan"],
  },
  {
    id: "urban_connectivity",
    cluster: "location",
    name: "Smart Corridor Growth",
    tagline: "Kawasan sunrise dengan rencana infrastruktur masa depan",
    targetAudience: "Visionary buyers yang melihat perkembangan kota",
    buyerMotivation: "Membeli di awal sebelum proyek jalan tol baru selesai dibangun",
    recommendedHeadlineHook: "Investasi Terdepan di Koridor Tol Baru yang Sedang Dibangun",
    visualCompositionStrategy: "Framing dinamis dengan penekanan masa depan kawasan",
    recommendedColorPalette: {
      primary: "#0F172A",
      secondary: "#1E293B",
      accent: "#38BDF8",
      backgroundOverlay: "linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.92) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Cek Masterplan",
    suggestedPills: ["Sunrise Area", "Next Tol Interchange", "Nilai Terus Naik"],
  },

  // ----------------------------------------------------
  // CLUSTER 5: ARCHITECTURAL MARKETING
  // ----------------------------------------------------
  {
    id: "modern_architecture",
    cluster: "architectural",
    name: "Modern Tropical Facade",
    tagline: "Desain arsitektur tropis dengan bukaan kaca lebar",
    targetAudience: "Pecinta estetika arsitektur bersih dan kontemporer",
    buyerMotivation: "Kebanggaan memiliki rumah dengan fasad estetik dan sirkulasi alami",
    recommendedHeadlineHook: "Arsitektur Tropis Modern dengan Pencahayaan Alami Maksimal",
    visualCompositionStrategy: "Fokus penuh pada fasad rumah asli, tekstur kayu, dan batu alam",
    recommendedColorPalette: {
      primary: "#1C1917",
      secondary: "#292524",
      accent: "#D4AF37", // Travertine Warm
      backgroundOverlay: "linear-gradient(180deg, rgba(28,25,23,0.15) 0%, rgba(12,10,9,0.95) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Lihat Detail Desain",
    suggestedPills: ["High Ceiling", "Bukaan Kaca Lebar", "Fasad Travertine"],
  },
  {
    id: "luxury_exterior",
    cluster: "architectural",
    name: "Luxury Estate Showcase",
    tagline: "Mahakarya fasad megah untuk standar hidup tertinggi",
    targetAudience: "High Net Worth Individuals (HNWI), pembeli kelas atas",
    buyerMotivation: "Simbol kemewahan, status sosial, dan kenyamanan tanpa kompromi",
    recommendedHeadlineHook: "Kemewahan Megah dalam Mahakarya Arsitektur Kelas Dunia",
    visualCompositionStrategy: "Komposisi sinematik dusk/golden hour dengan ambient lighting",
    recommendedColorPalette: {
      primary: "#09090B",
      secondary: "#18181B",
      accent: "#EAB308", // Pure Gold
      backgroundOverlay: "linear-gradient(180deg, rgba(9,9,11,0.2) 0%, rgba(9,9,11,0.96) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "'Playfair Display', serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Hubungi Private Advisor",
    suggestedPills: ["Private Pool", "Marmer Import", "Elevator Ready"],
  },
  {
    id: "space_optimization",
    cluster: "architectural",
    name: "Space Optimization & Layout",
    tagline: "Tata ruang efisien tanpa ruang terbuang",
    targetAudience: "Pembeli praktis yang membutuhkan banyak fungsi ruang",
    buyerMotivation: "Setiap meter persegi bernilai dan nyaman untuk seluruh anggota keluarga",
    recommendedHeadlineHook: "Denah Cerdas: Maksimalisasi Ruang untuk Segala Kebutuhan Keluarga",
    visualCompositionStrategy: "Highlight keserasian tata ruang dan fleksibilitas fungsi",
    recommendedColorPalette: {
      primary: "#18181B",
      secondary: "#27272A",
      accent: "#38BDF8", // Clean Azure
      backgroundOverlay: "linear-gradient(180deg, rgba(24,24,27,0.15) 0%, rgba(9,9,11,0.93) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Unduh Denah Lengkap",
    suggestedPills: ["Multifunction Room", "Cross Ventilation", "Kitchen Island"],
  },
  {
    id: "tropical_biophilic",
    cluster: "architectural",
    name: "Biophilic Green Sanctuary",
    tagline: "Menyatu dengan alam: taman dalam rumah dan udara segar",
    targetAudience: "Pencari ketenangan yang penat dengan hiruk-pikuk kota",
    buyerMotivation: "Rumah sebagai tempat *healing* dan relaksasi alami",
    recommendedHeadlineHook: "Hunian Bernapas: Menyatu dengan Alam dan Kesegaran Hijau",
    visualCompositionStrategy: "Dominasi elemen hijau subur dan sirkulasi cahaya matahari",
    recommendedColorPalette: {
      primary: "#064E3B",
      secondary: "#065F46",
      accent: "#34D399", // Fresh Leaf
      backgroundOverlay: "linear-gradient(180deg, rgba(6,78,59,0.15) 0%, rgba(2,44,34,0.95) 100%)",
      textColor: "#FFFFFF",
    },
    typographyDirection: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      headlineWeight: "800",
      letterSpacing: "-0.02em",
    },
    ctaRecommendation: "Jadwalkan Survei Alam",
    suggestedPills: ["Inner Courtyard", "Udara Segar", "Pencahayaan Alami"],
  },
];

export function getAngleById(id: string): MarketingAngleTemplate {
  const found = MARKETING_ANGLES.find((a) => a.id === id);
  return found || MARKETING_ANGLES[0]; // Default to WhatsApp Lead Generator
}

