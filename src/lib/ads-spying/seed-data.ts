import type { ScrapedCompetitorAd } from "./types";

export const INITIAL_COMPETITOR_ADS: Omit<ScrapedCompetitorAd, "id" | "scraped_at" | "updated_at">[] = [
  {
    ad_archive_id: "meta_arch_8921049102",
    search_keyword: "rumah bsd",
    page_id: "page_bsd_city_official",
    page_name: "BSD City Official by Sinar Mas Land",
    page_profile_uri: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=120&auto=format&fit=crop&q=80",
    is_active: true,
    start_date: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000).toISOString(), // 38 days ago
    end_date: null,
    active_days_count: 38,
    longevity_phase: "EVERGREEN",
    collation_id: "col_bsd_enchante_scale",
    collation_count: 5, // Aggressive Scaling
    media_format: "IMAGE",
    cos_media_urls: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1080&auto=format&fit=crop&q=85",
        width: 1080,
        height: 1350,
      },
    ],
    original_body_text: `Hunian Mewah 2 Lantai di Jantung BSD City! 🌿
Promo Eksklusif Awal Bulan:
✅ DP 0% Langsung Akad
✅ Cicilan Mulai 7 Jutaan/Bulan
✅ Free Biaya KPR & BPHTB
✅ Smart Home System & Canopy Terpasang

Hanya 5 Menit ke AEON Mall BSD & Pintu Tol Serpong-Balaraja. Unit Sangat Terbatas! Klik Hubungi Kami untuk booking survey private via WhatsApp.`,
    headline_title: "Cluster Terdepan BSD City • Promo DP 0% & Free KPR",
    link_description: "Dapatkan E-Brochure & Simulasi Cicilan KPR Resmi",
    cta_type: "WHATSAPP_MESSAGE",
    cta_text: "Kirim Pesan WhatsApp",
    destination_url: "https://wa.me/6281288992211?text=Halo%20Admin%20BSD%20City,%20saya%20tertarik%20dengan%20promo%20DP%200%25%20dan%20cicilan%207%20Jutaan.%20Bisa%20kirim%20e-brochure%20resmi?",
    funnel_type: "CTWA",
    decoded_wa_number: "6281288992211",
    decoded_wa_text: "Halo Admin BSD City, saya tertarik dengan promo DP 0% dan cicilan 7 Jutaan. Bisa kirim e-brochure resmi?",
    destination_domain: "wa.me",
    publisher_platforms: ["facebook", "instagram", "audience_network", "messenger"],
    ai_analysis: {
      hook_angle: "Low Barrier Financial Offer (DP 0% / Biaya Ringan)",
      offer_breakdown: {
        starting_price: null,
        dp_promo: "DP 0% Langsung Akad",
        installment: "Cicilan Mulai 7 Jutaan/Bulan",
        bonus_incentives: ["Free Biaya KPR & BPHTB", "Smart Home System & Canopy Terpasang"],
      },
      target_audience: "Pencari hunian mewah kelas menengah-atas dan eksekutif muda Jabodetabek",
      copywriting_framework: "Direct Offer & Benefit Led",
      evidence_quotes: [
        "DP 0% Langsung Akad",
        "Cicilan Mulai 7 Jutaan/Bulan",
        "Free Biaya KPR & BPHTB",
        "Hanya 5 Menit ke AEON Mall BSD & Pintu Tol Serpong-Balaraja",
      ],
      actionable_takeaway: "Iklan ini berstatus EVERGREEN (38 hari aktif) dengan 5 variasi identik (Aggressive Scaling). Format CTWA dengan pre-filled text yang jelas menghilangkan friksi konversi lead.",
      analyzed_at: new Date().toISOString(),
    },
    ai_analyzed_at: new Date().toISOString(),
  },
  {
    ad_archive_id: "meta_arch_7129038192",
    search_keyword: "rumah bintaro",
    page_id: "page_summarecon_serpong",
    page_name: "Summarecon Serpong Living",
    page_profile_uri: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=120&auto=format&fit=crop&q=80",
    is_active: true,
    start_date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(), // 21 days ago
    end_date: null,
    active_days_count: 21,
    longevity_phase: "EVERGREEN",
    collation_id: "col_summarecon_olympia",
    collation_count: 3,
    media_format: "IMAGE",
    cos_media_urls: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1080&auto=format&fit=crop&q=85",
        width: 1080,
        height: 1350,
      },
    ],
    original_body_text: `Punya Rumah Impian Dekat Stasiun KRL & Tol Bintaro Bukan Lagi Khayalan! 🚆🏡

Harga mulai Rp 850 Juta.
Angsuran ringan 5 Jutaan/bulan flat 2 tahun pertama.
Fasilitas Clubhouse bintang 5, swimming pool, dan sistem keamanan 24 jam.

Pesan unit sekarang dan nikmati Subsidi DP hingga 50 Juta + Free AC di setiap kamar tidur.`,
    headline_title: "Rumah 2 Lantai Dekat Stasiun Bintaro • Harga Mulai Rp 850 Juta",
    link_description: "Daftar NUP Online & Jadwalkan Survey Lokasi",
    cta_type: "WHATSAPP_MESSAGE",
    cta_text: "Kirim Pesan WhatsApp",
    destination_url: "https://api.whatsapp.com/send?phone=6282110203040&text=Halo%20Summarecon%20Living,%20mau%20tanya%20info%20unit%20850%20Juta%20di%20dekat%20stasiun%20Bintaro.",
    funnel_type: "CTWA",
    decoded_wa_number: "6282110203040",
    decoded_wa_text: "Halo Summarecon Living, mau tanya info unit 850 Juta di dekat stasiun Bintaro.",
    destination_domain: "wa.me",
    publisher_platforms: ["facebook", "instagram"],
    ai_analysis: {
      hook_angle: "Direct Price Anchor (Keterjangkauan Harga)",
      offer_breakdown: {
        starting_price: "Rp 850 Juta",
        dp_promo: "Subsidi DP hingga 50 Juta",
        installment: "5 Jutaan/bulan",
        bonus_incentives: ["Free AC di setiap kamar tidur", "Clubhouse bintang 5"],
      },
      target_audience: "Komuter Jakarta - Tangerang Selatan yang membutuhkan akses KRL",
      copywriting_framework: "AIDA (Attention - Interest - Desire - Action)",
      evidence_quotes: [
        "Harga mulai Rp 850 Juta",
        "Angsuran ringan 5 Jutaan/bulan flat 2 tahun pertama",
        "Subsidi DP hingga 50 Juta + Free AC di setiap kamar tidur",
      ],
      actionable_takeaway: "Penempatan angka harga Rp 850 Juta langsung di headline menyaring lead berkualitas (tidak membuang waktu lead yang out-of-budget).",
      analyzed_at: new Date().toISOString(),
    },
    ai_analyzed_at: new Date().toISOString(),
  },
  {
    ad_archive_id: "meta_arch_4810294819",
    search_keyword: "rumah bandung",
    page_id: "page_podomoro_park",
    page_name: "Podomoro Park Bandung Official",
    page_profile_uri: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=120&auto=format&fit=crop&q=80",
    is_active: true,
    start_date: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(), // 11 days ago
    end_date: null,
    active_days_count: 11,
    longevity_phase: "VALIDATING",
    collation_id: "col_podomoro_resort",
    collation_count: 2,
    media_format: "IMAGE",
    cos_media_urls: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1080&auto=format&fit=crop&q=85",
        width: 1080,
        height: 1080,
      },
    ],
    original_body_text: `Resort Living Pertama di Bandung Selatan dengan View Danau Alami 🌊⛰️
Nikmati udara sejuk pegunungan setiap hari bersama keluarga tercinta.
Tipe Rumah Modern Tropical:
- 3 Kamar Tidur, 2 Kamar Mandi
- Danau Buatan 1 Km
- Shuttle Bus ke Stasiun Kereta Cepat Whoosh Tegalluar

Kunjungi Marketing Gallery akhir pekan ini dan dapatkan Promo Spesial Cashback Booking Fee.`,
    headline_title: "Hunian Nuansa Resort di Bandung • Dekat Whoosh Tegalluar",
    link_description: "Unduh Denah & Brosur Spesifikasi Lengkap",
    cta_type: "LEARN_MORE",
    cta_text: "Pelajari Selengkapnya",
    destination_url: "https://podomoropark.com/promo-whoosh-resort?utm_source=meta_ads&utm_campaign=lake_view",
    funnel_type: "LANDING_PAGE",
    decoded_wa_number: null,
    decoded_wa_text: null,
    destination_domain: "podomoropark.com",
    publisher_platforms: ["facebook", "instagram"],
    ai_analysis: {
      hook_angle: "Location & Accessibility Advantage",
      offer_breakdown: {
        starting_price: null,
        dp_promo: null,
        installment: null,
        bonus_incentives: ["Promo Spesial Cashback Booking Fee", "Shuttle Bus ke Stasiun Kereta Cepat Whoosh"],
      },
      target_audience: "Keluarga mapan dan pembeli rumah kedua (holiday home) Bandung & Jakarta",
      copywriting_framework: "Storytelling & Atmosphere Focused",
      evidence_quotes: [
        "Resort Living Pertama di Bandung Selatan dengan View Danau Alami",
        "Shuttle Bus ke Stasiun Kereta Cepat Whoosh Tegalluar",
      ],
      actionable_takeaway: "Fokus pada diferensiasi gaya hidup resort dan kedekatan dengan infrastruktur modern (Whoosh) daripada perang diskon harga.",
      analyzed_at: new Date().toISOString(),
    },
    ai_analyzed_at: new Date().toISOString(),
  },
  {
    ad_archive_id: "meta_arch_3910294812",
    search_keyword: "rumah surabaya",
    page_id: "page_citraland_surabaya",
    page_name: "CitraLand The Singapore of Surabaya",
    page_profile_uri: "https://images.unsplash.com/photo-1577495508048-b635879837f1?w=120&auto=format&fit=crop&q=80",
    is_active: true,
    start_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    end_date: null,
    active_days_count: 3,
    longevity_phase: "TESTING",
    collation_id: "col_citraland_nw",
    collation_count: 1,
    media_format: "IMAGE",
    cos_media_urls: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=1080&auto=format&fit=crop&q=85",
        width: 1080,
        height: 1350,
      },
    ],
    original_body_text: `Segera Hadir: Cluster Terbaru di CitraLand Surabaya Barat!
Early Bird Privilege:
• Harga Perdana Mulai 1,1 Miliar
• Free PPN 100% Ditanggung Pemerintah
• Free AJB, BBN, & Biaya Pengalihan 1x

Jangan sampai kehabisan nomor urut pemilihan unit. Isi form untuk mendapatkan NUP prioritas.`,
    headline_title: "Cluster Baru CitraLand Surabaya Barat • Free PPN 100%",
    link_description: "Registrasi NUP Prioritas Sekarang",
    cta_type: "SIGN_UP",
    cta_text: "Daftar",
    destination_url: "https://facebook.com/lead_gen/citraland_surabaya_nup_v2",
    funnel_type: "LEAD_FORM",
    decoded_wa_number: null,
    decoded_wa_text: null,
    destination_domain: "facebook.com (Instant Form)",
    publisher_platforms: ["facebook", "instagram"],
    ai_analysis: {
      hook_angle: "Direct Price Anchor (Keterjangkauan Harga)",
      offer_breakdown: {
        starting_price: "1,1 Miliar",
        dp_promo: "Free PPN 100% Ditanggung Pemerintah",
        installment: null,
        bonus_incentives: ["Free AJB, BBN, & Biaya Pengalihan 1x"],
      },
      target_audience: "Investor properti dan keluarga Surabaya Barat",
      copywriting_framework: "Early Bird Launch Scarcity",
      evidence_quotes: [
        "Harga Perdana Mulai 1,1 Miliar",
        "Free PPN 100% Ditanggung Pemerintah",
      ],
      actionable_takeaway: "Peluncuran kluster baru sangat cocok menggunakan On-Ad Instant Lead Form untuk mengumpulkan NUP secepat mungkin.",
      analyzed_at: new Date().toISOString(),
    },
    ai_analyzed_at: new Date().toISOString(),
  },
  {
    ad_archive_id: "meta_arch_2910481920",
    search_keyword: "rumah bsd",
    page_id: "page_paramount_gading_serpong",
    page_name: "Paramount Land Gading Serpong",
    page_profile_uri: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=120&auto=format&fit=crop&q=80",
    is_active: true,
    start_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
    end_date: null,
    active_days_count: 45,
    longevity_phase: "EVERGREEN",
    collation_id: "col_paramount_materaball",
    collation_count: 6, // Heavy Scaling Winner
    media_format: "IMAGE",
    cos_media_urls: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1080&auto=format&fit=crop&q=85",
        width: 1080,
        height: 1350,
      },
    ],
    original_body_text: `TERLARIS DI GADING SERPONG! Sudah Terjual Lebih dari 120 Unit dalam 2 Bulan. 🏆
Desain Modern Minimalis 2 Lantai dengan Attic Room Multifungsi.
- Harga Mulai Rp 1,4 Miliar
- DP Cuman 5% Bisa Dicicil 6x
- Subsidi Biaya KPR hingga 25 Juta
- Free Voucher Furnished IKEA senilai 20 Juta

Lokasi Strategis: 3 Menit ke Mall SMS, Dekat UMN & Pradita University. Hubungi konsultan properti kami via WhatsApp sekarang!`,
    headline_title: "Rumah 2 Lantai + Attic Room • DP 5% Dicicil 6x di Gading Serpong",
    link_description: "Konsultasi Simulasi KPR & Jadwal Show Unit",
    cta_type: "WHATSAPP_MESSAGE",
    cta_text: "Kirim Pesan WhatsApp",
    destination_url: "https://wa.me/6281319203948?text=Halo%20Paramount%20Land,%20saya%20tertarik%20dengan%20tipe%20rumah%20attic%20room%20DP%205%25.%20Bisa%20info%20jadwal%20survey%20show%20unit?",
    funnel_type: "CTWA",
    decoded_wa_number: "6281319203948",
    decoded_wa_text: "Halo Paramount Land, saya tertarik dengan tipe rumah attic room DP 5%. Bisa info jadwal survey show unit?",
    destination_domain: "wa.me",
    publisher_platforms: ["facebook", "instagram", "messenger"],
    ai_analysis: {
      hook_angle: "Low Barrier Financial Offer (DP 0% / Biaya Ringan)",
      offer_breakdown: {
        starting_price: "Rp 1,4 Miliar",
        dp_promo: "DP Cuman 5% Bisa Dicicil 6x",
        installment: null,
        bonus_incentives: ["Subsidi Biaya KPR hingga 25 Juta", "Free Voucher Furnished IKEA senilai 20 Juta"],
      },
      target_audience: "Keluarga modern mapan yang membutuhkan ruang kerja ekstra (attic room)",
      copywriting_framework: "Social Proof Led (Terjual 120 Unit)",
      evidence_quotes: [
        "Sudah Terjual Lebih dari 120 Unit dalam 2 Bulan",
        "Harga Mulai Rp 1,4 Miliar",
        "DP Cuman 5% Bisa Dicicil 6x",
      ],
      actionable_takeaway: "Iklan ini adalah TOP EVERGREEN (45 hari aktif, 6 variasi aktif). Penggunaan social proof 'Terjual 120 Unit' dan bonus furnitur IKEA terbukti sangat kuat meningkatkan CTR & konversi lead WhatsApp.",
      analyzed_at: new Date().toISOString(),
    },
    ai_analyzed_at: new Date().toISOString(),
  },
];
