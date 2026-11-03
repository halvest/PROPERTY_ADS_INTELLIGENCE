import type { AspectRatio } from "./types";
import { getArchetype, type AdArchetypeId } from "./ad-archetypes";

export interface AdPosterSynthesizerParams {
  archetypeId: AdArchetypeId;
  aspectRatio: AspectRatio;
  projectName: string;
  propertyType?: string;
  propertyLocation?: string;
  startingPrice?: string;
  promoHeadline?: string;
  headline?: string;
  subheadline?: string;
  bedrooms?: string;
  bathrooms?: string;
  buildingArea?: string;
  landArea?: string;
  contactNumber?: string;
  photoUrl: string; // Base64 data URL or public URL
  logoDataUrl?: string | null;
  specsText?: string;
}

/**
 * Pure Graphic Poster Synthesizer for Property Ads
 * Generates an end-to-end vector/raster advertisement poster as a self-contained image data URI.
 * Implements the 5 Indonesian Property Ad Archetypes with ratio-adaptive safe zones (1:1, 4:5, 9:16).
 */
export class AdPosterSynthesizer {
  static synthesize(params: AdPosterSynthesizerParams): string {
    getArchetype(params.archetypeId);
    const dimensions = {
      "1:1": { width: 1080, height: 1080 },
      "4:5": { width: 1080, height: 1350 },
      "9:16": { width: 1080, height: 1920 },
    }[params.aspectRatio];

    const { width, height } = dimensions;

    // Format clean text values
    const title = this.escapeXml((params.headline || params.projectName || "HUNIAN MODERN").toUpperCase());
    const sub = this.escapeXml(
      params.subheadline || `${params.propertyType || "Rumah Modern"} • ${params.propertyLocation || "Lokasi Strategis"}`
    );
    const price = this.escapeXml(
      params.startingPrice
        ? params.startingPrice.startsWith("Rp")
          ? params.startingPrice
          : `Rp ${params.startingPrice}`
        : "Harga Spesial"
    );
    const promo = this.escapeXml(params.promoHeadline || "Penawaran Eksklusif");
    const contact = this.escapeXml(params.contactNumber || "Hubungi Kami");

    const specs: string[] = [];
    if (params.specsText && params.specsText.trim().length > 0) {
      params.specsText
        .split("•")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => specs.push(this.escapeXml(s)));
    } else {
      if (params.bedrooms) specs.push(`${this.escapeXml(params.bedrooms)} Kamar Tidur`);
      if (params.bathrooms) specs.push(`${this.escapeXml(params.bathrooms)} Kamar Mandi`);
      if (params.buildingArea) specs.push(`LB ${this.escapeXml(params.buildingArea)} m²`);
      if (params.landArea) specs.push(`LT ${this.escapeXml(params.landArea)} m²`);
    }
    if (specs.length === 0) {
      specs.push("3 Kamar Tidur", "2 Kamar Mandi", "Carport 2 Mobil", "Keamanan 24 Jam");
    }

    let svgContent = "";

    switch (params.archetypeId) {
      case "golden_aurora_wave":
        svgContent = this.renderGoldenAuroraWave(width, height, params, title, sub, price, promo, contact, specs);
        break;
      case "luxury_architecture":
        svgContent = this.renderLuxuryArchitecture(width, height, params, title, sub, price, promo, contact, specs);
        break;
      case "royal_navy_metro":
        svgContent = this.renderRoyalNavyMetro(width, height, params, title, sub, price, promo, contact, specs);
        break;
      case "kaba_direct_offer":
        svgContent = this.renderKabaDirectOffer(width, height, params, title, sub, price, promo, contact, specs);
        break;
      case "emerald_minimalist":
      default:
        svgContent = this.renderEmeraldMinimalist(width, height, params, title, sub, price, promo, contact, specs);
        break;
    }

    const base64Svg =
      typeof Buffer !== "undefined"
        ? Buffer.from(svgContent, "utf-8").toString("base64")
        : btoa(unescape(encodeURIComponent(svgContent)));
    return `data:image/svg+xml;base64,${base64Svg}`;
  }

  private static escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Computes ratio-adaptive vertical zones so 1:1, 4:5, and 9:16 never clip or leave awkward gaps.
   * For 9:16, enforces 15% top safe zone (y >= 288) and 20% bottom safe zone (y <= 1536).
   */
  private static getVerticalZones(aspectRatio: AspectRatio, h: number) {
    if (aspectRatio === "9:16") {
      return {
        topSafeY: 280,
        photoH: 1180,
        dockY: 1150,
        dockContentY: 1200,
        bottomSafeLimitY: 1530,
      };
    }
    if (aspectRatio === "1:1") {
      return {
        topSafeY: 44,
        photoH: 690,
        dockY: 690,
        dockContentY: 736,
        bottomSafeLimitY: h - 44,
      };
    }
    // Default 4:5 (1080 x 1350)
    return {
      topSafeY: 54,
      photoH: 870,
      dockY: 870,
      dockContentY: 924,
      bottomSafeLimitY: h - 54,
    };
  }

  // ---------------------------------------------------------------------------
  // ARCHETYPE 1: EMERALD MINIMALIST (Century 21 Style)
  // ---------------------------------------------------------------------------
  private static renderEmeraldMinimalist(
    w: number,
    h: number,
    p: AdPosterSynthesizerParams,
    title: string,
    sub: string,
    price: string,
    promo: string,
    contact: string,
    specs: string[]
  ): string {
    const z = this.getVerticalZones(p.aspectRatio, h);
    const dockH = h - z.dockY;

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="emGoldGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="emDockGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#022C22"/>
      <stop offset="100%" stop-color="#064E3B"/>
    </linearGradient>
    <filter id="emShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background Photo -->
  <rect width="${w}" height="${h}" fill="#022C22"/>
  <image href="${p.photoUrl}" x="0" y="0" width="${w}" height="${z.photoH + 60}" preserveAspectRatio="xMidYMid slice"/>

  <!-- Top Header Banner Plaque (Leaves Top-Right free for Developer Logo) -->
  <g transform="translate(56, ${z.topSafeY})" filter="url(#emShadow)">
    <rect x="0" y="0" width="660" height="132" rx="18" fill="rgba(255, 255, 255, 0.95)"/>
    <rect x="0" y="0" width="12" height="132" rx="6" fill="#064E3B"/>
    <text x="32" y="42" font-family="'Playfair Display', Georgia, serif" font-style="italic" font-weight="700" font-size="24" fill="#064E3B">Hunian Modern &amp; Nyaman</text>
    <text x="32" y="84" font-family="'Montserrat', sans-serif" font-weight="900" font-size="34" fill="#022C22" letter-spacing="1.5">${title.slice(0, 22)}</text>
    <text x="32" y="112" font-family="'Inter', sans-serif" font-weight="600" font-size="15" fill="#475569">${sub.slice(0, 48)}</text>
  </g>

  <!-- Right Side Vertical Specification Pills -->
  <g transform="translate(${w - 250}, ${z.topSafeY + 160})">
    ${specs.slice(0, 4).map((spec, i) => `
      <g transform="translate(0, ${i * 64})" filter="url(#emShadow)">
        <rect x="0" y="0" width="194" height="50" rx="25" fill="rgba(2, 44, 34, 0.90)" stroke="#10B981" stroke-width="2"/>
        <circle cx="26" cy="25" r="16" fill="#064E3B"/>
        <text x="26" y="31" text-anchor="middle" font-family="'Inter', sans-serif" font-weight="900" font-size="14" fill="#FBBF24">✓</text>
        <text x="52" y="30" font-family="'Inter', sans-serif" font-weight="700" font-size="14" fill="#FFFFFF">${spec.slice(0, 16)}</text>
      </g>
    `).join("")}
  </g>

  <!-- Bottom Elegant Solid Information Dock -->
  <rect x="0" y="${z.dockY}" width="${w}" height="${dockH}" fill="url(#emDockGrad)" filter="url(#emShadow)"/>
  <line x1="0" y1="${z.dockY}" x2="${w}" y2="${z.dockY}" stroke="#10B981" stroke-width="4"/>

  <!-- Dock Left: Value Proposition & Starting Price -->
  <g transform="translate(56, ${z.dockContentY})">
    <text x="0" y="0" font-family="'Playfair Display', serif" font-style="italic" font-weight="700" font-size="26" fill="#FBBF24">Investasi Cerdas Keluarga</text>
    <text x="0" y="38" font-family="'Inter', sans-serif" font-weight="700" font-size="14" fill="#A7F3D0" letter-spacing="1">HARGA MULAI DARI</text>
    <text x="0" y="88" font-family="'Montserrat', sans-serif" font-weight="900" font-size="44" fill="#FFFFFF">${price.slice(0, 18)}</text>
    <rect x="0" y="108" width="480" height="40" rx="10" fill="rgba(16, 185, 129, 0.18)" stroke="#10B981" stroke-width="1.5"/>
    <text x="16" y="134" font-family="'Inter', sans-serif" font-weight="700" font-size="16" fill="#6EE7B7">★ ${promo.slice(0, 36)}</text>
  </g>

  <!-- Dock Right: Golden Survey CTA Button & WhatsApp -->
  <g transform="translate(${w - 416}, ${z.dockContentY - 6})">
    <rect x="0" y="0" width="360" height="84" rx="18" fill="url(#emGoldGrad)" filter="url(#emShadow)"/>
    <text x="180" y="38" text-anchor="middle" font-family="'Playfair Display', serif" font-style="italic" font-weight="900" font-size="24" fill="#022C22">Jadwalkan Survei</text>
    <text x="180" y="68" text-anchor="middle" font-family="'Montserrat', sans-serif" font-weight="900" font-size="22" fill="#022C22" letter-spacing="1">SEKARANG!</text>

    <g transform="translate(0, 102)">
      <rect x="0" y="0" width="360" height="58" rx="29" fill="#022C22" stroke="#10B981" stroke-width="2"/>
      <circle cx="34" cy="29" r="18" fill="#10B981"/>
      <text x="34" y="35" text-anchor="middle" font-family="'Inter', sans-serif" font-weight="900" font-size="15" fill="#022C22">WA</text>
      <text x="66" y="36" font-family="'Montserrat', sans-serif" font-weight="800" font-size="19" fill="#FFFFFF">${contact.slice(0, 20)}</text>
    </g>
  </g>
</svg>
`;
  }

  // ---------------------------------------------------------------------------
  // ARCHETYPE 2: LUXURY ARCHITECTURAL SHOWCASE (Garis Bumi Style)
  // ---------------------------------------------------------------------------
  private static renderLuxuryArchitecture(
    w: number,
    h: number,
    p: AdPosterSynthesizerParams,
    title: string,
    sub: string,
    price: string,
    promo: string,
    contact: string,
    specs: string[]
  ): string {
    const z = this.getVerticalZones(p.aspectRatio, h);
    const dockH = h - z.dockY;

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="luxGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FDE047"/>
      <stop offset="50%" stop-color="#D4AF37"/>
      <stop offset="100%" stop-color="#CA8A04"/>
    </linearGradient>
    <linearGradient id="luxDarkCard" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#292524"/>
      <stop offset="100%" stop-color="#1C1917"/>
    </linearGradient>
    <filter id="luxGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Background Photo -->
  <rect width="${w}" height="${h}" fill="#1C1917"/>
  <image href="${p.photoUrl}" x="0" y="0" width="${w}" height="${z.photoH + 60}" preserveAspectRatio="xMidYMid slice"/>

  <!-- Top Luxury Headline Card -->
  <g transform="translate(56, ${z.topSafeY})" filter="url(#luxGlow)">
    <rect x="0" y="0" width="640" height="136" rx="16" fill="rgba(28, 25, 23, 0.92)" stroke="#D4AF37" stroke-width="1.5"/>
    <text x="28" y="38" font-family="'Montserrat', sans-serif" font-weight="800" font-size="14" fill="url(#luxGold)" letter-spacing="3">EXCLUSIVE ARCHITECTURAL SERIES</text>
    <text x="28" y="82" font-family="'Montserrat', sans-serif" font-weight="900" font-size="34" fill="#FFFFFF" letter-spacing="1">${title.slice(0, 22)}</text>
    <text x="28" y="114" font-family="'Inter', sans-serif" font-weight="600" font-size="15" fill="#D6D3D1">${sub.slice(0, 48)}</text>
  </g>

  <!-- Bottom Dark Espresso Information Dock -->
  <rect x="0" y="${z.dockY}" width="${w}" height="${dockH}" fill="url(#luxDarkCard)" filter="url(#luxGlow)"/>
  <line x1="0" y1="${z.dockY}" x2="${w}" y2="${z.dockY}" stroke="#D4AF37" stroke-width="4"/>

  <!-- Left: Feature Checklist -->
  <g transform="translate(56, ${z.dockContentY})">
    <text x="0" y="0" font-family="'Montserrat', sans-serif" font-weight="800" font-size="16" fill="#D4AF37" letter-spacing="2">SPESIFIKASI &amp; KEUNGGULAN</text>
    <g transform="translate(0, 24)">
      ${specs.slice(0, 4).map((spec, i) => `
        <g transform="translate(0, ${i * 36})">
          <circle cx="12" cy="12" r="10" fill="#D4AF37"/>
          <text x="12" y="16" text-anchor="middle" font-family="'Inter', sans-serif" font-weight="900" font-size="12" fill="#1C1917">✓</text>
          <text x="34" y="17" font-family="'Inter', sans-serif" font-weight="700" font-size="16" fill="#F5F5F4">${spec.slice(0, 28)}</text>
        </g>
      `).join("")}
    </g>
    <text x="0" y="184" font-family="'Inter', sans-serif" font-weight="700" font-size="15" fill="#FDE047">★ ${promo.slice(0, 40)}</text>
  </g>

  <!-- Right: Price & WhatsApp Metallic Gold Button -->
  <g transform="translate(${w - 426}, ${z.dockContentY - 10})">
    <rect x="0" y="0" width="370" height="78" rx="16" fill="rgba(255,255,255,0.06)" stroke="rgba(212,175,55,0.45)" stroke-width="1.5"/>
    <text x="24" y="28" font-family="'Inter', sans-serif" font-weight="700" font-size="13" fill="#A8A29E" letter-spacing="1">PENAWARAN MULAI</text>
    <text x="24" y="62" font-family="'Montserrat', sans-serif" font-weight="900" font-size="30" fill="#FFFFFF">${price.slice(0, 18)}</text>

    <g transform="translate(0, 96)">
      <rect x="0" y="0" width="370" height="84" rx="42" fill="url(#luxGold)" filter="url(#luxGlow)"/>
      <circle cx="48" cy="42" r="28" fill="#1C1917"/>
      <text x="48" y="49" text-anchor="middle" font-family="'Montserrat', sans-serif" font-weight="900" font-size="18" fill="#D4AF37">WA</text>
      <text x="92" y="34" font-family="'Montserrat', sans-serif" font-weight="800" font-size="13" fill="#1C1917" letter-spacing="1">HUBUNGI MARKETING</text>
      <text x="92" y="62" font-family="'Montserrat', sans-serif" font-weight="900" font-size="22" fill="#1C1917">${contact.slice(0, 20)}</text>
    </g>
  </g>
</svg>
`;
  }

  // ---------------------------------------------------------------------------
  // ARCHETYPE 3: ROYAL NAVY METRO ELITE (Metro Regency Style)
  // ---------------------------------------------------------------------------
  private static renderRoyalNavyMetro(
    w: number,
    h: number,
    p: AdPosterSynthesizerParams,
    title: string,
    sub: string,
    price: string,
    promo: string,
    contact: string,
    specs: string[]
  ): string {
    const z = this.getVerticalZones(p.aspectRatio, h);
    const dockH = h - z.dockY;

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="rnGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="rnNavy" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <filter id="rnShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Background Photo -->
  <rect width="${w}" height="${h}" fill="#0F172A"/>
  <image href="${p.photoUrl}" x="0" y="0" width="${w}" height="${z.photoH + 60}" preserveAspectRatio="xMidYMid slice"/>

  <!-- Top Header Plaque -->
  <g transform="translate(56, ${z.topSafeY})" filter="url(#rnShadow)">
    <rect x="0" y="0" width="640" height="136" rx="20" fill="rgba(15, 23, 42, 0.94)" stroke="url(#rnGold)" stroke-width="2"/>
    <text x="32" y="48" font-family="'Cinzel', 'Playfair Display', serif" font-weight="900" font-size="32" fill="url(#rnGold)" letter-spacing="2">${title.slice(0, 20)}</text>
    <rect x="32" y="64" width="460" height="30" rx="15" fill="#1E293B"/>
    <text x="48" y="84" font-family="'Inter', sans-serif" font-weight="700" font-size="14" fill="#38BDF8">${sub.slice(0, 42)}</text>
    <text x="32" y="118" font-family="'Playfair Display', serif" font-style="italic" font-weight="700" font-size="17" fill="#FDE68A">★ ${promo.slice(0, 42)}</text>
  </g>

  <!-- Bottom Royal Navy Dock -->
  <rect x="0" y="${z.dockY}" width="${w}" height="${dockH}" fill="url(#rnNavy)" filter="url(#rnShadow)"/>
  <line x1="0" y1="${z.dockY}" x2="${w}" y2="${z.dockY}" stroke="url(#rnGold)" stroke-width="4"/>

  <!-- Dock Left: Price & Specs Grid -->
  <g transform="translate(56, ${z.dockContentY})">
    <text x="0" y="0" font-family="'Inter', sans-serif" font-weight="700" font-size="14" fill="#94A3B8" letter-spacing="1">HARGA MULAI</text>
    <text x="0" y="44" font-family="'Montserrat', sans-serif" font-weight="900" font-size="40" fill="#FFFFFF">${price.slice(0, 18)}</text>
    <g transform="translate(0, 68)">
      ${specs.slice(0, 4).map((spec, i) => `
        <g transform="translate(${i % 2 === 0 ? 0 : 250}, ${Math.floor(i / 2) * 38})">
          <circle cx="10" cy="10" r="7" fill="#F59E0B"/>
          <text x="26" y="15" font-family="'Inter', sans-serif" font-weight="700" font-size="15" fill="#E2E8F0">${spec.slice(0, 18)}</text>
        </g>
      `).join("")}
    </g>
  </g>

  <!-- Dock Right: Yellow Survey Pill CTA & WhatsApp -->
  <g transform="translate(${w - 416}, ${z.dockContentY - 4})">
    <rect x="0" y="0" width="360" height="64" rx="32" fill="url(#rnGold)" filter="url(#rnShadow)"/>
    <text x="180" y="40" text-anchor="middle" font-family="'Montserrat', sans-serif" font-weight="900" font-size="19" fill="#0F172A">Konsultasi &amp; Survey Sekarang &gt;</text>

    <g transform="translate(0, 84)">
      <rect x="0" y="0" width="360" height="58" rx="29" fill="#1E293B" stroke="#334155" stroke-width="1.5"/>
      <circle cx="34" cy="29" r="18" fill="#F59E0B"/>
      <text x="34" y="35" text-anchor="middle" font-family="'Inter', sans-serif" font-weight="900" font-size="14" fill="#0F172A">WA</text>
      <text x="66" y="36" font-family="'Montserrat', sans-serif" font-weight="900" font-size="19" fill="#FFFFFF">${contact.slice(0, 20)}</text>
    </g>
  </g>
</svg>
`;
  }

  // ---------------------------------------------------------------------------
  // ARCHETYPE 4: GOLDEN AURORA WAVE (Golden Aurora Style)
  // ---------------------------------------------------------------------------
  private static renderGoldenAuroraWave(
    w: number,
    h: number,
    p: AdPosterSynthesizerParams,
    title: string,
    sub: string,
    price: string,
    promo: string,
    contact: string,
    specs: string[]
  ): string {
    const z = this.getVerticalZones(p.aspectRatio, h);
    const dockH = h - z.dockY;

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="gaGoldWave" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="50%" stop-color="#D4AF37"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <linearGradient id="gaCreamCard" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFDF7"/>
      <stop offset="100%" stop-color="#FDF8E8"/>
    </linearGradient>
    <filter id="gaShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Background Photo -->
  <rect width="${w}" height="${h}" fill="#FDF8E8"/>
  <image href="${p.photoUrl}" x="0" y="0" width="${w}" height="${z.photoH + 60}" preserveAspectRatio="xMidYMid slice"/>

  <!-- Top Golden Header Plaque -->
  <g transform="translate(56, ${z.topSafeY})" filter="url(#gaShadow)">
    <rect x="0" y="0" width="640" height="128" rx="20" fill="url(#gaGoldWave)"/>
    <text x="32" y="48" font-family="'Playfair Display', serif" font-weight="900" font-size="32" fill="#451A03" letter-spacing="1.5">${title.slice(0, 22)}</text>
    <text x="32" y="80" font-family="'Inter', sans-serif" font-weight="700" font-size="16" fill="#78350F">${sub.slice(0, 44)}</text>
    <text x="32" y="108" font-family="'Montserrat', sans-serif" font-weight="800" font-size="14" fill="#451A03">★ ${promo.slice(0, 40)}</text>
  </g>

  <!-- Bottom Warm Ivory Information Dock -->
  <rect x="0" y="${z.dockY}" width="${w}" height="${dockH}" fill="url(#gaCreamCard)" filter="url(#gaShadow)"/>
  <line x1="0" y1="${z.dockY}" x2="${w}" y2="${z.dockY}" stroke="#D4AF37" stroke-width="5"/>

  <!-- Dock Left: Feature Checklist -->
  <g transform="translate(56, ${z.dockContentY})">
    <text x="0" y="0" font-family="'Playfair Display', serif" font-weight="900" font-size="26" fill="#78350F">Fasilitas &amp; Spesifikasi Unit</text>
    <g transform="translate(0, 28)">
      ${specs.slice(0, 4).map((spec, i) => `
        <g transform="translate(${i % 2 === 0 ? 0 : 250}, ${Math.floor(i / 2) * 42})">
          <circle cx="12" cy="12" r="10" fill="#F59E0B"/>
          <text x="12" y="16" text-anchor="middle" font-family="'Inter', sans-serif" font-weight="900" font-size="11" fill="#FFFFFF">✓</text>
          <text x="32" y="17" font-family="'Inter', sans-serif" font-weight="700" font-size="15" fill="#451A03">${spec.slice(0, 18)}</text>
        </g>
      `).join("")}
    </g>
  </g>

  <!-- Dock Right: Price & Contact Strip -->
  <g transform="translate(${w - 416}, ${z.dockContentY - 8})">
    <rect x="0" y="0" width="360" height="76" rx="16" fill="#FEF3C7" stroke="#F59E0B" stroke-width="2"/>
    <text x="24" y="28" font-family="'Inter', sans-serif" font-weight="700" font-size="13" fill="#B45309">HARGA MULAI</text>
    <text x="24" y="60" font-family="'Montserrat', sans-serif" font-weight="900" font-size="30" fill="#78350F">${price.slice(0, 18)}</text>

    <g transform="translate(0, 92)">
      <rect x="0" y="0" width="360" height="58" rx="29" fill="#14532D" filter="url(#gaShadow)"/>
      <circle cx="34" cy="29" r="18" fill="#F59E0B"/>
      <text x="34" y="35" text-anchor="middle" font-family="'Inter', sans-serif" font-weight="900" font-size="14" fill="#14532D">WA</text>
      <text x="66" y="36" font-family="'Montserrat', sans-serif" font-weight="900" font-size="18" fill="#FFFFFF">${contact.slice(0, 20)}</text>
    </g>
  </g>
</svg>
`;
  }

  // ---------------------------------------------------------------------------
  // ARCHETYPE 5: KABA DIRECT OFFER (Kaba Residence Style)
  // ---------------------------------------------------------------------------
  private static renderKabaDirectOffer(
    w: number,
    h: number,
    p: AdPosterSynthesizerParams,
    title: string,
    sub: string,
    price: string,
    promo: string,
    contact: string,
    specs: string[]
  ): string {
    const z = this.getVerticalZones(p.aspectRatio, h);
    const dockH = h - z.dockY;
    const offerText = promo.length > 3 ? promo : price;

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="kbGreen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#14532D"/>
      <stop offset="100%" stop-color="#052E16"/>
    </linearGradient>
    <filter id="kbShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Background Photo -->
  <rect width="${w}" height="${h}" fill="#052E16"/>
  <image href="${p.photoUrl}" x="0" y="0" width="${w}" height="${z.photoH + 60}" preserveAspectRatio="xMidYMid slice"/>

  <!-- Top Direct Offer Card -->
  <g transform="translate(56, ${z.topSafeY})" filter="url(#kbShadow)">
    <rect x="0" y="0" width="640" height="140" rx="22" fill="url(#kbGreen)" stroke="#EAB308" stroke-width="3"/>
    <rect x="28" y="18" width="240" height="28" rx="14" fill="#EAB308"/>
    <text x="148" y="37" text-anchor="middle" font-family="'Inter', sans-serif" font-weight="800" font-size="13" fill="#052E16">${title.slice(0, 22)}</text>
    <text x="28" y="88" font-family="'Montserrat', sans-serif" font-weight="900" font-size="36" fill="#FFFFFF">${offerText.slice(0, 24)}</text>
    <text x="28" y="120" font-family="'Inter', sans-serif" font-weight="600" font-size="15" fill="#A7F3D0">📍 ${sub.slice(0, 46)}</text>
  </g>

  <!-- Bottom Forest Green Dock -->
  <rect x="0" y="${z.dockY}" width="${w}" height="${dockH}" fill="url(#kbGreen)" filter="url(#kbShadow)"/>
  <line x1="0" y1="${z.dockY}" x2="${w}" y2="${z.dockY}" stroke="#EAB308" stroke-width="4"/>

  <!-- Dock Left: Price & Specifications Row -->
  <g transform="translate(56, ${z.dockContentY})">
    <text x="0" y="0" font-family="'Montserrat', sans-serif" font-weight="800" font-size="14" fill="#FACC15" letter-spacing="1">HARGA PENAWARAN</text>
    <text x="0" y="42" font-family="'Montserrat', sans-serif" font-weight="900" font-size="38" fill="#FFFFFF">${price.slice(0, 18)}</text>
    <g transform="translate(0, 66)">
      ${specs.slice(0, 4).map((spec, i) => `
        <g transform="translate(${i % 2 === 0 ? 0 : 250}, ${Math.floor(i / 2) * 38})">
          <circle cx="10" cy="10" r="7" fill="#FACC15"/>
          <text x="26" y="15" font-family="'Inter', sans-serif" font-weight="700" font-size="15" fill="#FFFFFF">${spec.slice(0, 18)}</text>
        </g>
      `).join("")}
    </g>
  </g>

  <!-- Dock Right: Contact Card -->
  <g transform="translate(${w - 416}, ${z.dockContentY})">
    <rect x="0" y="0" width="360" height="110" rx="22" fill="#052E16" stroke="#EAB308" stroke-width="2" filter="url(#kbShadow)"/>
    <circle cx="48" cy="55" r="26" fill="#22C55E"/>
    <text x="48" y="62" text-anchor="middle" font-family="'Inter', sans-serif" font-weight="900" font-size="18" fill="#052E16">WA</text>
    <text x="90" y="44" font-family="'Inter', sans-serif" font-weight="800" font-size="13" fill="#FACC15" letter-spacing="1">HUBUNGI WHATSAPP</text>
    <text x="90" y="76" font-family="'Montserrat', sans-serif" font-weight="900" font-size="22" fill="#FFFFFF">${contact.slice(0, 18)}</text>
  </g>
</svg>
`;
  }
}
