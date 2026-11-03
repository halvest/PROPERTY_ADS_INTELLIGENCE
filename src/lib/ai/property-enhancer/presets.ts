import type {
  EnhancementMode,
  PhotographyStyle,
  EnhancementIntensity,
  ArchitecturalStructureLock,
  OutputAspectRatio,
} from "./types";

export interface ModeDefinition {
  id: EnhancementMode;
  name: string;
  tagline: string;
  badge: string;
  desc: string;
  icon: string;
  accentColor: string;
  recommendedFor: string;
}

export const MODE_DEFINITIONS: Record<EnhancementMode, ModeDefinition> = {
  mode_photorealistic: {
    id: "mode_photorealistic",
    name: "Mode A: Photorealistic Enhancement",
    tagline: "Render 3D ke Foto Arsitektur Murni",
    badge: "Preservasi 100% Konservatif",
    desc: "Mengonversi render 3D (SketchUp, Lumion, Enscape, D5) menjadi foto arsitektur nyata dengan mengunci total geometri, atap, jendela, pintu, dan sudut kamera.",
    icon: "",
    accentColor: "border-emerald-500",
    recommendedFor: "Render SketchUp / Lumion yang bentuk fisiknya sudah final dan tidak boleh berubah sama sekali.",
  },
  mode_architectural_photo: {
    id: "mode_architectural_photo",
    name: "Mode B: Architectural Photography",
    tagline: "Pemotretan Kamera Full-Frame Profesional",
    badge: "Pencahayaan & Atmosfer Kurasi",
    desc: "Menghasilkan foto arsitektur setara jepretan kamera Hasselblad / Sony A7R IV dengan 6 pilihan atmosfer pencahayaan (Golden Hour, Clean Daylight, Blue Hour, dll).",
    icon: "",
    accentColor: "border-sky-500",
    recommendedFor: "Listing properti komersial yang membutuhkan suasana pencahayaan premium dan mood arsitektural spesifik.",
  },
  mode_premium_visualization: {
    id: "mode_premium_visualization",
    name: "Mode C: Premium Visualization",
    tagline: "Visualisasi Pemasaran Kelas Atas",
    badge: "Marketing High-Impact",
    desc: "Meningkatkan integrasi lingkungan alam, refleksi kaca realistis, lanskap taman asri, dan kedalaman atmosfer tanpa mengubah struktur bangunan.",
    icon: "",
    accentColor: "border-amber-500",
    recommendedFor: "Materi pemasaran billboard, brosur editorial, dan materi promosi eksklusif pengembang.",
  },
};

export interface StyleDefinition {
  id: PhotographyStyle;
  name: string;
  badge: string;
  desc: string;
  icon: string;
  paletteClass: string;
  lightingDetails: string;
}

export const STYLE_DEFINITIONS: Record<PhotographyStyle, StyleDefinition> = {
  style_golden_hour: {
    id: "style_golden_hour",
    name: "Luxury Golden Hour",
    badge: "Sore Keemasan Mewah",
    desc: "Cahaya matahari sore keemasan hangat, bayangan panjang realistis, pantulan hangat pada fasad, dan lampu interior menyala seimbang.",
    icon: "",
    paletteClass: "from-amber-600 via-orange-600 to-yellow-700",
    lightingDetails: "Warm natural sunlight at 15-degree low sun angle, golden reflections on travertine and wood slats, long soft architectural shadows, glowing interior amber light.",
  },
  style_clean_daylight: {
    id: "style_clean_daylight",
    name: "Clean Daylight",
    badge: "Siang Terang Alami",
    desc: "Pencahayaan siang terang alami dengan white balance netral, warna material akurat, bayangan lembut, dan langit biru cerah.",
    icon: "",
    paletteClass: "from-sky-500 via-blue-600 to-teal-600",
    lightingDetails: "Crisp bright natural daylight at 50-degree high sun angle, neutral 5500K daylight white balance, accurate physical material textures, soft ambient ground shadows.",
  },
  style_blue_hour: {
    id: "style_blue_hour",
    name: "Blue Hour Luxury",
    badge: "Senja Mewah Indigo",
    desc: "Langit senja biru royal indigo alami, lampu fasad dan sconce menyala hangat, refleksi kaca realistis, dan kontras visual sinematik.",
    icon: "",
    paletteClass: "from-indigo-950 via-blue-900 to-purple-950",
    lightingDetails: "Cinematic twilight blue hour, deep royal indigo evening sky, 3000K warm interior illumination through floor-to-ceiling glass, illuminated driveway and landscape uplights.",
  },
  style_tropical: {
    id: "style_tropical",
    name: "Tropical Architecture",
    badge: "Modern Tropis Indonesia",
    desc: "Lingkungan tropis Indonesia dengan vegetasi alami (monstera, palem, calathea), kelembapan atmosfer natural, dan aksen kayu jati.",
    icon: "",
    paletteClass: "from-emerald-700 via-teal-800 to-stone-800",
    lightingDetails: "Balanced diffused tropical daylight, rich natural green foliage, realistic wet-stone paving highlights, warm teak wood grain, serene tropical sanctuary atmosphere.",
  },
  style_overcast_editorial: {
    id: "style_overcast_editorial",
    name: "Overcast Editorial",
    badge: "Majalah Editorial Hening",
    desc: "Cahaya terdifusi awan lembut, bayangan halus merata, warna material netral tanpa pantulan silau, standar majalah Architectural Digest.",
    icon: "",
    paletteClass: "from-stone-600 via-zinc-700 to-slate-800",
    lightingDetails: "Soft diffused daylight through clean white cloud cover, shadowless uniform facade illumination, high textural contrast on concrete, plaster, and metal finishes.",
  },
  style_bright_morning: {
    id: "style_bright_morning",
    name: "Bright Morning",
    badge: "Pagi Segar Alami",
    desc: "Sinar matahari pagi yang segar dan jernih, bayangan lembut ke arah barat, udara bersih, dan suasana lingkungan hunian yang asri.",
    icon: "",
    paletteClass: "from-cyan-600 via-teal-600 to-sky-700",
    lightingDetails: "Crisp early morning sunlight at 30-degree angle, fresh clear atmosphere, high optical clarity on glass and painted surfaces, vibrant natural garden greens.",
  },
};

export const INTENSITY_DEFINITIONS: Record<
  EnhancementIntensity,
  { label: string; badge: string; desc: string }
> = {
  conservative: {
    label: "Konservatif (100% Strict)",
    badge: "Prioritas Akurasi",
    desc: "Deviasi minimal terhadap gambar asli. Fokus mengganti tekstur CGI menjadi foto asli tanpa mengubah lingkungan.",
  },
  balanced: {
    label: "Seimbang (Recommended)",
    badge: "Standar Profesional",
    desc: "Keseimbangan optimal antara keaslian arsitektur dan peningkatan kualitas fotografi, pencahayaan, dan vegetasi.",
  },
  advanced: {
    label: "Advanced (Maksimal)",
    badge: "Fotografi Tingkat Lanjut",
    desc: "Peningkatan kedalaman atmosfer dan realisme material maksimal dengan tetap mengunci 100% struktur bangunan.",
  },
};

export const ASPECT_RATIO_OPTIONS: { id: OutputAspectRatio; label: string; badge: string; resolution: string }[] = [
  { id: "original", label: "Original Ratio", badge: "Pertahankan Rasio Asli", resolution: "Mengikuti Foto Sumber" },
  { id: "1:1", label: "1:1 Square", badge: "Instagram / FB Feed", resolution: "1080 × 1080 px" },
  { id: "4:5", label: "4:5 Portrait", badge: "Meta Ads Rekomendasi", resolution: "1080 × 1350 px" },
  { id: "9:16", label: "9:16 Vertical", badge: "Instagram Story & Reels", resolution: "1080 × 1920 px" },
  { id: "16:9", label: "16:9 Landscape", badge: "Website & Billboard", resolution: "1920 × 1080 px" },
];

export const DEFAULT_STRUCTURE_LOCK: ArchitecturalStructureLock = {
  preserveArchitecture: true,
  preserveComposition: true,
  preserveAspect: true,
  enhanceMaterials: true,
  enhanceLandscaping: true,
  naturalLighting: true,
  glassReflections: true,
};
