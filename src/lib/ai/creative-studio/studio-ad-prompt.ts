import { buildMuseAdGenerationPrompt, getArchetype, inferArchetypeFromBrief, type AdArchetypeId } from "./ad-archetypes";
import { NaturalLanguageBriefParser } from "./brief-parser";
import { selectAdCopy, selectPosterCopy, type SelectedAdCopy } from "./ad-copy-selection";
import { placementInstruction, type FacadePlacement } from "./facade-placement";
import type { AspectRatio } from "./types";

type StudioRatio = "auto" | "1:1" | "4:5" | "2:3" | "9:16" | "16:9";

export interface StudioAdCheck {
  id: "photo" | "price" | "promo" | "specs" | "location" | "whatsapp";
  label: string;
  ok: boolean;
}

export interface StudioAdReadiness {
  prompt: string;
  archetypeId: AdArchetypeId;
  archetypeName: string;
  checks: StudioAdCheck[];
}

export function buildCampaignPosterPrompt(raw: string, ratio: string, placement?: FacadePlacement): string {
  const copy = selectPosterCopy(raw);
  const facts = copy.factRow.join("   ·   ");
  const frame = placement?.ratio || ratio;

  return [
    "Design a premium property campaign poster the way a senior advertising art director would, for a high-CTR Meta placement. This is a client-approval key visual, not a marketplace listing and not a repeated template.",
    "Break the usual housing-ad formula. No roof-shaped logo, no white rounded card, no row of icons, no checkmarks, no pill button.",
    "The attached photograph is the product. Preserve that exact building: roof geometry, floor count, every window and door, facade design, and the wall, glass, wood, and stone materials. Do not invent a different house. Do not replace it with a row of different houses.",
    placement ? placementInstruction(placement) : "Keep the photographed camera angle. Do not crop the roof or the front door.",
    "Compose it like a premium developer campaign. The top is a calm warm-paper field carrying the type, and it meets the real roofline of this photograph. The house stays in its original perspective under that field. One adult may stand in the foreground at a believable scale, feet on the ground, clear of the front door. Cars may be refined. Light and shadows stay consistent with the photo.",
    "Type, centered in the paper field with generous space: a small tracked project name, then the headline in a large dark serif, then the subhead in a gold italic on its own line, then the benefit in one small dark line. No second slogan.",
    facts ? `Under the house, one quiet fact line, no icons: ${facts}.` : "",
    copy.typeLabel ? `Set ${copy.typeLabel} once, small, near the architecture.` : "",
    "Locations and payment sit small along the bottom in one calm line or two short columns, with no bullets. The call to action is small type with a WhatsApp mark, not a big button. If the brief has no phone number, do not invent one.",
    safeZone(frame),
    `Frame ${frame}.`,
    "Print only the lines below, spelled exactly. Do not print any label such as project, place, near, payment, headline, or action. Do not add a price, a phone number, or any other sentence:",
    copy.eyebrow || "",
    copy.headline,
    copy.subhead,
    copy.benefit,
    copy.typeLabel,
    facts,
    copy.location,
    ...copy.proofs.map((place) => `Dekat ${place}`),
    copy.payment,
    copy.cta,
  ].filter(Boolean).join("\n");
}

function safeZone(ratio: string): string {
  if (ratio === "9:16") {
    return "META SAFE ZONE for a 9:16 Story or Reel: the top 14%, the bottom 35%, and 6% on each side are covered or cropped by the interface. No wordmark, text, icon, or button may enter those margins. The photograph may bleed there. The button must sit above the bottom 35%, with clear space around it.";
  }
  return "META CROP: this portrait will be cut down to a 4:5 feed and may also be cut to a square. The top 18% and the bottom 22% of the canvas are deleted by that crop, so they must be empty photograph or empty background, with no letters and no button. Keep every word, the wordmark, and the button at least 14% below the top edge, 20% above the bottom edge, and 8% in from each side. Leave a visible gap under the button.";
}

export function buildAtmospherePrompt(ratio: string): string {
  return [
    "Edit the attached property photograph into a professional real-estate campaign still.",
    "LOCK the building: exact structure, roof geometry, number of floors, window and door positions, facade design, and all wall, glass, wood, and stone materials. Do not redesign the house and do not replace materials.",
    "ALLOWED, and keep them in one visual line with the architecture: a cleaner professional sky, refined daylight, cars that may be replaced or added, and at most one quiet family activity in the foreground.",
    "Do not cover the roof, windows, or front door. Do not add a crowd, balloons, or a cartoon look.",
    "NO text, NO logo, NO price badge, NO poster frame, NO border. Photograph only.",
    `Keep the full facade inside a ${ratio} frame.`,
  ].join(" ");
}

function layoutRatio(ratio: StudioRatio): AspectRatio {
  if (ratio === "1:1" || ratio === "4:5" || ratio === "9:16") return ratio;
  return "4:5";
}

function resolveArchetype(prompt: string, brief: ReturnType<typeof NaturalLanguageBriefParser.parse>): AdArchetypeId {
  const text = prompt.toLowerCase();
  if (/kaba|cuman\s+\d|direct offer/.test(text)) return "kaba_direct_offer";
  if (/aurora|senja|sore|sunset|golden hour|keemasan/.test(text)) return "golden_aurora_wave";
  if (/luxury|mewah|villa|sultan|arsitektur|custom build/.test(text)) return "luxury_architecture";
  if (/navy|metro|regency|apartemen|residence|cluster elite/.test(text)) return "royal_navy_metro";
  if (/minimalis|hijau|century|emerald|asri/.test(text)) return "emerald_minimalist";
  const inferred = inferArchetypeFromBrief(brief).id;
  if (inferred === "kaba_direct_offer") return "emerald_minimalist";
  return inferred;
}

/**
 * Turns a chat instruction into a Muse Image 1.0 brochure prompt.
 * Listed facts are the only copy the image may print. A revision edits the
 * current brochure instead of inventing a new one.
 */
export function composeStudioAdPrompt(input: {
  userPrompt: string;
  aspectRatio?: StudioRatio;
  hasReference?: boolean;
  isRevision?: boolean;
}): StudioAdReadiness {
  const userPrompt = input.userPrompt.trim();
  const ratio = input.aspectRatio || "4:5";
  const hasReference = Boolean(input.hasReference);
  const brief = NaturalLanguageBriefParser.parse(userPrompt, {
    aspectRatio: layoutRatio(ratio),
  });
  const archetypeId = resolveArchetype(userPrompt, brief);
  const archetype = getArchetype(archetypeId);
  const specs = [brief.specsText, ...(brief.promos || [])].filter(Boolean);

  const checks: StudioAdCheck[] = [
    { id: "photo", label: "Foto fasad", ok: hasReference },
    { id: "price", label: "Harga", ok: Boolean(brief.startingPrice) },
    { id: "promo", label: "Promo", ok: Boolean(brief.promoHeadline || brief.dpAmount || brief.hasFreePpn) },
    { id: "specs", label: "Spesifikasi", ok: Boolean(brief.specsText) },
    { id: "location", label: "Lokasi", ok: Boolean(brief.propertyLocation && brief.propertyLocation !== "Lokasi Strategis") },
    { id: "whatsapp", label: "WhatsApp", ok: Boolean(brief.whatsappNumber) },
  ];

  const production = [
    "PRODUKSI SIAP IKLAN META:",
    "Susun seperti brosur properti Indonesia yang bisa langsung dipasang: pita lokasi di atas, foto fasad di tengah, panel bawah berisi harga paling besar, badge promo, satu baris spesifikasi, lalu tombol WhatsApp.",
    "Teks hanya fakta yang disebut di brief. Ejaan persis, Bahasa Indonesia, tanpa emoji, tanpa slogan baru, tanpa nama proyek fiktif.",
    "Jangan menutupi atap, jendela, atau pintu. Sisakan 8% atas dan 10% bawah sebagai zona aman Feed dan Story.",
    "Foto harus terlihat seperti foto properti sungguhan, bukan kartun atau sketsa.",
    `TEKS YANG BOLEH DICETAK HANYA INI: harga "${brief.startingPrice || "jangan tulis harga"}", promo "${brief.promoHeadline || brief.dpAmount || "jangan tulis promo"}", spesifikasi "${brief.specsText || "jangan tulis jumlah kamar atau luas"}", lokasi "${brief.propertyLocation && brief.propertyLocation !== "Lokasi Strategis" ? brief.propertyLocation : "jangan mengarang nama kota"}", WhatsApp "${brief.whatsappNumber || "jangan tulis nomor"}". Contoh kalimat di formula desain, termasuk "DP Cuman 3 juta", bukan teks iklan.`,
    ratio === "9:16"
      ? "Ukuran akhir 1080x1920 untuk Story dan Reels."
      : ratio === "1:1"
        ? "Ukuran akhir 1080x1080 untuk feed persegi."
        : ratio === "16:9"
          ? "Ukuran akhir 1920x1080 untuk banner landscape."
          : "Ukuran akhir 1080x1350 untuk feed 4:5.",
  ];

  if (input.isRevision) {
    const prompt = [
      "EDIT brosur properti yang sudah ada. Pertahankan bangunan, tata letak, dan setiap teks yang tidak disebut di instruksi ini.",
      `Instruksi revisi: ${userPrompt || "Rapikan hierarki harga, promo, dan tombol WhatsApp tanpa mengubah bangunan."}`,
      "Jangan mengubah struktur, material, atau desain fasad. Langit, pencahayaan, mobil, dan aktivitas keluarga boleh diperhalus agar setema.",
      "Jangan mengganti harga, promo, spesifikasi, lokasi, atau nomor WhatsApp yang tidak disebut di instruksi ini. Jangan mengarang nomor telepon.",
      hasReference ? "Foto terlampir adalah fasad yang wajib dipertahankan 100%." : "",
      ...production,
    ].filter(Boolean).join(" ");
    return { prompt, archetypeId, archetypeName: archetype.name, checks };
  }

  const selected = selectAdCopy(userPrompt);
  const brochure = buildMuseAdGenerationPrompt({
    archetype,
    aspectRatio: layoutRatio(ratio),
    projectName: selected.eyebrow || brief.projectName || "",
    propertyType: brief.propertyType,
    propertyLocation: selected.location !== "Lokasi strategis" ? selected.location : brief.propertyLocation,
    startingPrice: selected.offer || brief.startingPrice,
    promoText: selected.proof || brief.promoHeadline,
    specs: selected.specs.length ? selected.specs : brief.specsText ? [brief.specsText] : [],
    contactNumber: brief.whatsappNumber,
    ctaText: selected.cta || brief.ctaText,
    headline: selected.headline,
    targetAudience: brief.targetAudience,
    locationAdvantages: brief.locationAdvantages,
    hasReferenceImage: hasReference,
  });

  const prompt = [brochure, ...production, specs.length ? "" : "Spesifikasi unit tidak disebut, jadi jangan menulis jumlah kamar atau luas."].filter(Boolean).join(" ");
  return { prompt, archetypeId, archetypeName: archetype.name, checks };
}
