-- ==============================================================================
-- MIGRATION: CREATIVE AD REFERENCE TEMPLATES (GROUND TRUTH CORPUS)
-- HD Creative — AI Property Ad Creative Studio Visual RAG Knowledge Base
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.creative_ad_reference_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL for system-wide presets
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN (
    'modern_minimalist',
    'luxury_architecture',
    'royal_navy_metro',
    'golden_aurora_wave',
    'direct_offer_dp',
    'architect_story',
    'classic_european',
    'theme_geographic',
    'isometric_cutout_3d',
    'islamic_cluster'
  )),
  target_audience TEXT,
  headline_hook TEXT NOT NULL,
  subheadline_template TEXT,
  promotional_badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  color_palette JSONB NOT NULL DEFAULT '{}'::jsonb,
  typography_recipe JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_image_url TEXT NOT NULL,
  visual_prompt_guide TEXT NOT NULL,
  layout_framing TEXT NOT NULL DEFAULT 'split_dock',
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system_preset BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lightning fast AI semantic matching
CREATE INDEX IF NOT EXISTS idx_ad_ref_templates_category ON public.creative_ad_reference_templates(category);
CREATE INDEX IF NOT EXISTS idx_ad_ref_templates_org ON public.creative_ad_reference_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_ad_ref_templates_tags ON public.creative_ad_reference_templates USING GIN(tags);

-- Row Level Security (RLS)
ALTER TABLE public.creative_ad_reference_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for system and org ad reference templates"
  ON public.creative_ad_reference_templates
  FOR SELECT
  USING (
    is_system_preset = true
    OR organization_id IS NULL
    OR (
      organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Organization members can manage their custom templates"
  ON public.creative_ad_reference_templates
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ==============================================================================
-- SEED DATA: 10 REAL-WORLD INDONESIAN PROPERTY AD REFERENCED TEMPLATES
-- ==============================================================================

INSERT INTO public.creative_ad_reference_templates (
  slug, name, category, target_audience, headline_hook, subheadline_template,
  promotional_badges, color_palette, typography_recipe, preview_image_url,
  visual_prompt_guide, layout_framing, tags, is_system_preset
) VALUES
  (
    'century21-emerald-minimalist',
    'Emerald Modern Minimalist (Century 21 Style)',
    'modern_minimalist',
    'Keluarga Muda, Investor Pemula, Pasangan Baru',
    'Rumah MINIMALIS',
    'Desain Modern | Lokasi Strategis | Investasi Terbaik',
    '["HUNIAN MODERN & NYAMAN", "Hunian Ideal untuk Keluarga Masa Kini", "Yuk Survey Sekarang!"]'::jsonb,
    '{"primary": "#064E3B", "secondary": "#022C22", "accent": "#10B981", "accentGold": "#F59E0B", "text": "#FFFFFF"}'::jsonb,
    '{"headlineFont": "Montserrat", "scriptFont": "Playfair Display", "styleCase": "mixed"}'::jsonb,
    '/references/ad-creatives/ref1-emerald-minimalist.jpg',
    'Commercial property ad flyer in emerald green with top-left golden ribbon banner, scripted title, right vertical spec icons column, and bottom textured survey dock.',
    'split_dock',
    ARRAY['minimalis', 'emerald', 'century21', 'survey', 'modern', 'keluarga_muda'],
    true
  ),
  (
    'garis-bumi-luxury-architecture',
    'Luxury Architectural Showcase (Garis Bumi Style)',
    'luxury_architecture',
    'High Net-Worth Individuals, Custom Build Seekers, Eksekutif Mapan',
    'HUBUNGI KAMI',
    'KONSULTASI DESAIN & PEMBANGUNAN RUMAH BERSAMA TIM ARSITEK',
    '["PROFESIONAL & TERPERCAYA", "RAB & PERENCANAAN BIAYA", "CONTACT US DIRECT"]'::jsonb,
    '{"primary": "#1C1917", "secondary": "#292524", "accent": "#D4AF37", "accentGold": "#EAB308", "text": "#FFFFFF"}'::jsonb,
    '{"headlineFont": "Montserrat", "scriptFont": "Cinzel", "styleCase": "uppercase"}'::jsonb,
    '/references/ad-creatives/ref2-luxury-architecture.jpg',
    'Ultra-luxury architectural ad poster in dark espresso and metallic gold, geometric studio logo, giant typography headline, blueprint polaroid insets, and glowing WhatsApp button.',
    'split_dock',
    ARRAY['luxury', 'arsitek', 'kontraktor', 'custom_home', 'espresso_gold', 'premium'],
    true
  ),
  (
    'metro-regency-royal-navy',
    'Royal Navy Metro Elite (Metro Regency Style)',
    'royal_navy_metro',
    'Keluarga Mapan, Urban Executives, Pencari Rumah Pusat Kota',
    'METRO REGENCY',
    'Perumahan Elite di Tengah Kota — Wujudkan Rumah Impian Anda!',
    '["Hunian modern", "Lokasi strategis", "Desain elegan", "Konsultasi & Survey Sekarang >"]'::jsonb,
    '{"primary": "#0F172A", "secondary": "#0A0F1D", "accent": "#38BDF8", "accentGold": "#F59E0B", "text": "#FFFFFF"}'::jsonb,
    '{"headlineFont": "Cinzel", "scriptFont": "Brush Script MT", "styleCase": "uppercase"}'::jsonb,
    '/references/ad-creatives/ref3-royal-navy-metro.jpg',
    'Prestigious real estate ad poster in royal navy blue and lustrous gold frames, dual logo plaque, palm leaf framing accents, yellow survey capsule, and clean contact dock.',
    'split_dock',
    ARRAY['royal_navy', 'elite', 'kota', 'prestisius', 'regency', 'daun_tropis'],
    true
  ),
  (
    'golden-aurora-exclusive-wave',
    'Golden Aurora Exclusive (Gold Wave Style)',
    'golden_aurora_wave',
    'First Home Buyers, Keluarga Baru, Pembeli Rumah Mulai 300 Jt-an',
    'Golden Aurora',
    'CLUSTER EKSKLUSIF — Hunian Nyaman dan Asri',
    '["Harga Mulai 340 JUTA*", "One Gate System", "Keamanan 24 Jam", "Playground"]'::jsonb,
    '{"primary": "#D4AF37", "secondary": "#78350F", "accent": "#F59E0B", "accentGold": "#FBBF24", "text": "#1E293B"}'::jsonb,
    '{"headlineFont": "Playfair Display", "scriptFont": "Great Vibes", "styleCase": "capitalize"}'::jsonb,
    '/references/ad-creatives/ref4-golden-aurora-wave.jpg',
    'Warm sunset real estate flyer with flowing organic golden wave header, sun logo emblem, floating 3D circular price badge (Harga Mulai), and 2-column gold checkmarked specs.',
    'golden_wave',
    ARRAY['golden_wave', 'aurora', 'harga_mulai', 'badge_bulat', 'affordable', 'sunset'],
    true
  ),
  (
    'kaba-residence-direct-offer',
    'High-Impact Direct Offer (Kaba Residence Style)',
    'direct_offer_dp',
    'Pembeli Rumah Subsidi / Komersial Terjangkau, Pekerja Muda',
    'DP Cuman 3 juta',
    'Hunian Type 37,5/91 Berdampingan Langsung dengan Kampus & Fasilitas',
    '["DP Cuman 3 juta", "Lokasi Strategis Kampus", "Fasilitas & Spesifikasi Lengkap"]'::jsonb,
    '{"primary": "#14532D", "secondary": "#052E16", "accent": "#EAB308", "accentGold": "#FACC15", "text": "#FFFFFF"}'::jsonb,
    '{"headlineFont": "Montserrat", "scriptFont": "Inter", "styleCase": "mixed"}'::jsonb,
    '/references/ad-creatives/ref5-kaba-direct-offer.jpg',
    'High-conversion property ad with deep forest green backdrop, huge rounded offer card displaying DP Cuman, green location map pin, and full width WhatsApp contact strip.',
    'split_dock',
    ARRAY['dp_promo', 'direct_offer', 'kaba', 'forest_green', 'murah', 'fast_closing'],
    true
  ),
  (
    'silpha-architectural-diary',
    'Architectural Storytelling (Silpha Karya Diary)',
    'architect_story',
    'Pemilik Tanah yang Mau Bangun Rumah, Pecinta Estetika Arsitektur',
    'Banyak rumah terlihat rapi dari depan.',
    'Tapi ruang dalamnya sering belum siap untuk kebutuhan harian.',
    '["Project Diary", "RAB & Desain Siap Bangun", "Konsultasi Layout Gratis"]'::jsonb,
    '{"primary": "#78350F", "secondary": "#FDFBF7", "accent": "#D97706", "accentGold": "#B45309", "text": "#1C1917"}'::jsonb,
    '{"headlineFont": "Playfair Display", "scriptFont": "Brush Script MT", "styleCase": "mixed"}'::jsonb,
    '/references/ad-creatives/ref6-silpha-architect-diary.jpg',
    'Editorial architectural storytelling flyer with soft cream paper texture, sticky note project diary, blueprint schematic in top-right, and clean modern house facade.',
    'architect_diary',
    ARRAY['storytelling', 'diary', 'blueprint', 'arsitek', 'renovasi', 'cream_aesthetic'],
    true
  ),
  (
    'sariwangi-sultan-classic',
    'Classic European Luxury (Sariwangi Gan Properti)',
    'classic_european',
    'Pecinta Gaya Klasik Eropa, Pengusaha Muda, Keluarga Mapan Bandung',
    'AUTO JADI SULTAN',
    'SEMAKIN KLASIK SEMAKIN ASIK — Akses Dekat Tol Pasteur & PVJ',
    '["UANG MUKA MULAI 70 JUTA SUDAH ALL IN", "GRATIS SMART DOOR LOCK", "GRATIS KITCHEN SET"]'::jsonb,
    '{"primary": "#0A0A0A", "secondary": "#1E293B", "accent": "#D4AF37", "accentGold": "#F59E0B", "text": "#FFFFFF"}'::jsonb,
    '{"headlineFont": "Montserrat", "scriptFont": "Cinzel", "styleCase": "uppercase"}'::jsonb,
    '/references/ad-creatives/ref7-sariwangi-sultan-classic.jpg',
    'Classic European townhouse ad flyer with bold sultan headline, vintage automobile in driveway, circular dark promo badges (Smart Door Lock, Kitchen Set), and dark access bar.',
    'classic_dark_bar',
    ARRAY['sultan', 'klasik_eropa', 'gan_properti', 'smart_door_lock', 'kitchen_set', 'bandung'],
    true
  ),
  (
    'gland-ciwastra-amsterdam',
    'Theme Geographic Hook (G-Land Ciwastra Amsterdam)',
    'theme_geographic',
    'Keluarga Muda Bandung, Karyawan BUMN / Kereta Cepat, Komuter',
    'AMSTERDAM DI BANDUNG TIMUR',
    'Blok Cendana VIII | LB: 36 m2 LT: 91 m2 — Dekat Stasiun Kereta Cepat & Masjid Al-Jabbar',
    '["MODEL TERBARU", "AMANKAN UNIT HANYA DENGAN 5 JUTA SAJA", "Exit Tol Gedebage", "Akses LRT"]'::jsonb,
    '{"primary": "#044E54", "secondary": "#083344", "accent": "#FACC15", "accentGold": "#EAB308", "text": "#FFFFFF"}'::jsonb,
    '{"headlineFont": "Montserrat", "scriptFont": "Inter", "styleCase": "uppercase"}'::jsonb,
    '/references/ad-creatives/ref8-gland-ciwastra-amsterdam.jpg',
    'Amsterdam themed townhouse ad with clean pitched roof facade, yellow circular Model Terbaru badge, bold capsule unit offer 5 Juta, and transit accessibility bullets.',
    'split_dock',
    ARRAY['amsterdam', 'bandung_timur', 'kereta_cepat', 'al_jabbar', '5_juta', 'gan_properti'],
    true
  ),
  (
    'gland-pajajaran-murah-elegant',
    'Isometric 3D Cutout & Direct Booking (G-Land Pajajaran)',
    'isometric_cutout_3d',
    'Pencari Rumah Angsuran Terjangkau, Pasangan Milenial Bandung',
    'MURAH ELEGANT',
    'G-LAND PAJAJARAN VILLAGE — Booking Sekarang, Angsuran Promo Hanya 1,9 Juta-an',
    '["GRATIS PPN!*", "ANGSURAN PROMO HANYA 1,9 JUTA-AN", "DP PROMO HANYA 5 JUTA", "BOOKING SEKARANG"]'::jsonb,
    '{"primary": "#0F2C59", "secondary": "#0A192F", "accent": "#38BDF8", "accentGold": "#F59E0B", "text": "#FFFFFF"}'::jsonb,
    '{"headlineFont": "Montserrat", "scriptFont": "Inter", "styleCase": "uppercase"}'::jsonb,
    '/references/ad-creatives/ref9-gland-pajajaran-murah-elegant.jpg',
    '3D perspective isometric cutout townhouse ad on vivid blue gradient, floating Gratis PPN badge, booking card with 1.9 Juta angsuran and 5 Juta DP, tabular spec grid.',
    'floating_cutout_3d',
    ARRAY['murah_elegant', 'gratis_ppn', 'angsuran_1_9jt', 'dp_5jt', 'cutout_3d', 'gan_properti'],
    true
  ),
  (
    'bimulia-islamic-ratusan-juta',
    'Islamic Developer & Mega Promo Banner (Bimulia Land)',
    'islamic_cluster',
    'Pencari Properti Syariah, Keluarga Muslim, Investor Ruko & Hunian',
    'EXTRA PROMO S/D RATUSAN JUTA* Rp',
    'BIMULIA LAND ISLAMIC DEVELOPER — Type Suite, Premium & Ruko',
    '["NEW LAUNCHING TYPE SUITE", "EXTRA PROMO S/D RATUSAN JUTA*", "Fasilitas Lingkungan Islami"]'::jsonb,
    '{"primary": "#047857", "secondary": "#064E3B", "accent": "#10B981", "accentGold": "#FACC15", "text": "#FFFFFF"}'::jsonb,
    '{"headlineFont": "Montserrat", "scriptFont": "Inter", "styleCase": "uppercase"}'::jsonb,
    '/references/ad-creatives/ref10-bimulia-islamic-ratusan-juta.jpg',
    'Islamic developer ad flyer in emerald green with giant curved Extra Promo Ratusan Juta banner, staggered modern townhouse row, and multi-channel social contact footer.',
    'split_dock',
    ARRAY['syariah', 'islamic_developer', 'ratusan_juta', 'bimulia', 'extra_promo', 'ruko'],
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  target_audience = EXCLUDED.target_audience,
  headline_hook = EXCLUDED.headline_hook,
  subheadline_template = EXCLUDED.subheadline_template,
  promotional_badges = EXCLUDED.promotional_badges,
  color_palette = EXCLUDED.color_palette,
  typography_recipe = EXCLUDED.typography_recipe,
  preview_image_url = EXCLUDED.preview_image_url,
  visual_prompt_guide = EXCLUDED.visual_prompt_guide,
  layout_framing = EXCLUDED.layout_framing,
  tags = EXCLUDED.tags,
  updated_at = now();

