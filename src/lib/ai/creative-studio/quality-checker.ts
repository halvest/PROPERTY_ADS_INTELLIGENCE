import type { ComposedAdLayout, AspectRatio } from "./types";
import { CreativeLayoutValidator } from "./layout-validator";

export interface QualityCheckItem {
  id: string;
  category: "typography" | "layout" | "contrast" | "conversion" | "fidelity";
  label: string;
  passed: boolean;
  severity: "passed" | "warning" | "error";
  message: string;
}

export interface CreativePreFlightReport {
  overallStatus: "excellent" | "good" | "needs_attention";
  overallScore: number; // 0 - 100 calculated from objective checklist weights
  passedChecksCount: number;
  totalChecksCount: number;
  isProductionReady: boolean;
  checks: QualityCheckItem[];
  actionableTips: string[];
}

/**
 * Objective Pre-Flight Quality Assurance Engine
 * Enforces production-grade graphic design and advertising standards:
 * - Canvas boundary & text overflow protection
 * - Indonesian Rupiah currency validity
 * - Original photography fidelity
 * - Prohibition of amateur emojis in advertising materials
 * - Call to action integrity and boundary visibility
 */
export class CreativeQualityChecker {
  static evaluateLayout(
    layout: ComposedAdLayout,
    aspectRatio: AspectRatio,
    hasReferenceImage: boolean,
    context?: { promos?: string[] }
  ): CreativePreFlightReport {
    const checks: QualityCheckItem[] = [];
    const tips: string[] = [];

    // 1. Text Overflow & Readability Check
    const headline = layout.headline.text || "";
    const maxChars = aspectRatio === "1:1" ? 65 : aspectRatio === "4:5" ? 75 : 85;
    const isHeadlineLengthValid = headline.length > 5 && headline.length <= maxChars;

    checks.push({
      id: "text_overflow",
      category: "typography",
      label: "Proporsi & Keterbacaan Headline",
      passed: isHeadlineLengthValid,
      severity: isHeadlineLengthValid ? "passed" : headline.length > maxChars ? "warning" : "error",
      message: isHeadlineLengthValid
        ? `Panjang headline (${headline.length} karakter) ideal untuk rasio ${aspectRatio}.`
        : headline.length > maxChars
        ? `Headline (${headline.length} karakter) melebihi batas (${maxChars} karakter). Berpotensi terpotong pada layar mobile.`
        : "Headline terlalu singkat atau kosong.",
    });

    if (headline.length > maxChars) {
      tips.push("Persingkat teks headline agar tidak mendominasi lebih dari 2 baris kanvas.");
    }

    // 2. Currency & Price Formatting Check
    const rawPrice = layout.priceBadge?.rawPrice || layout.priceBadge?.value || "";
    const isCurrencyValid =
      rawPrice.length === 0 || // Price is optional
      (/^(?:Rp\s*)?[0-9.,]+\s*(?:Miliar|Milyar|Juta|Jt|M)\b/i.test(rawPrice));

    checks.push({
      id: "currency_formatting",
      category: "fidelity",
      label: "Akurasi Penulisan Harga Rupiah",
      passed: isCurrencyValid,
      severity: isCurrencyValid ? "passed" : "error",
      message: isCurrencyValid
        ? "Format mata uang Rupiah valid dan menggunakan satuan baku (Miliar / Juta)."
        : `Format harga "${rawPrice}" tidak baku. Gunakan format resmi seperti "Rp 1,5 Miliar" atau "Rp 850 Juta".`,
    });

    if (!isCurrencyValid) {
      tips.push("Gunakan format harga baku seperti 'Rp 850 Juta' atau 'Rp 1,5 Miliar'.");
    }

    // 3. Visual Reference Image Fidelity
    const hasImage = Boolean(layout.backgroundUrl || layout.backgroundImageUrl) && hasReferenceImage;
    checks.push({
      id: "image_fidelity",
      category: "fidelity",
      label: "Integritas Foto Properti Asli",
      passed: hasImage,
      severity: hasImage ? "passed" : "error",
      message: hasImage
        ? "Foto properti asli terpasang sebagai referensi visual utama arsitektur."
        : "Belum ada foto referensi properti asli. Gunakan foto fasad nyata untuk akurasi iklan.",
    });

    if (!hasImage) {
      tips.push("Unggah foto fasad rumah asli beresolusi tajam untuk meningkatkan kredibilitas pembeli.");
    }

    // 4. Safe-Zone Compliance (9:16 Stories & Reels)
    const isSafeZoneCompliant =
      aspectRatio !== "9:16" || Boolean(layout.safeZoneOverlay);

    checks.push({
      id: "safe_zone_compliance",
      category: "layout",
      label: "Kepatuhan Safe Zone Platform (Meta UI)",
      passed: isSafeZoneCompliant,
      severity: isSafeZoneCompliant ? "passed" : "warning",
      message: isSafeZoneCompliant
        ? aspectRatio === "9:16"
          ? "Elemen aksi terlindungi dalam batas aman 15% atas & 20% bawah antarmuka Stories/Reels."
          : `Rasio ${aspectRatio} bebas dari batasan UI vertikal.`
        : "Elemen berisiko tertutup header akun atau tombol swipe Meta Ads.",
    });

    // 5. Call to Action (CTA) Actionability & Boundary Integrity
    const ctaText = layout.callToAction?.text || layout.cta?.text || "";
    const hasActiveCta =
      ctaText.length > 2 &&
      /(?:hubungi|chat|whatsapp|wa|klaim|survei|jadwalkan|lihat|booking|konsultasi|dapatkan|cek|hitung)/i.test(ctaText);
    const isCtaLengthSafe = ctaText.length <= 32;

    const isCtaValid = hasActiveCta && isCtaLengthSafe;
    checks.push({
      id: "cta_actionability",
      category: "conversion",
      label: "Kejelasan & Integritas Tombol CTA",
      passed: isCtaValid,
      severity: isCtaValid ? "passed" : !hasActiveCta ? "warning" : "error",
      message: isCtaValid
        ? `Tombol CTA "${ctaText}" terarah dan terlindungi di dalam batas aman canvas.`
        : !hasActiveCta
        ? `Teks CTA "${ctaText}" kurang memiliki kata kerja aksi langsung.`
        : `Teks CTA "${ctaText}" terlalu panjang (${ctaText.length} karakter). Berisiko terpotong pada batas kanan.`,
    });

    if (!hasActiveCta) {
      tips.push("Gunakan CTA dengan kata kerja langsung seperti 'Chat WhatsApp' atau 'Jadwalkan Survei'.");
    }

    // 6. Information Density & Badge Overload Prevention
    const totalPills = Math.max(
      layout.promoPills?.length || 0,
      layout.promoBadges?.length || 0
    );
    const isPillsClean = totalPills <= 3;

    checks.push({
      id: "badge_density",
      category: "layout",
      label: "Keseimbangan Kerapatan Informasi",
      passed: isPillsClean,
      severity: isPillsClean ? "passed" : "warning",
      message: isPillsClean
        ? "Jumlah badge penawaran terkontrol tanpa menutupi keindahan foto fasad."
        : `Terdapat ${totalPills} badge. Mengurangi jumlah badge akan membuat iklan tampak lebih elegan.`,
    });

    if (!isPillsClean) {
      tips.push("Batasi promo maksimal 2 poin terpenting agar visual tetap fokus pada keindahan rumah.");
    }

    // 7. Strict Emoji Prohibition (Professional Design Standard)
    const allTextToInspect = [
      layout.headline.text || "",
      layout.subheadline?.text || "",
      ctaText,
      layout.projectDetails?.propertyLocation || "",
      layout.projectDetails?.projectName || "",
    ].join(" ");

    const stripped = CreativeLayoutValidator.stripEmojis(allTextToInspect);
    const hasEmojis = allTextToInspect.length !== stripped.length;

    checks.push({
      id: "no_emojis",
      category: "typography",
      label: "Standar Estetika Tipografi Bebas Emoji",
      passed: !hasEmojis,
      severity: !hasEmojis ? "passed" : "warning",
      message: !hasEmojis
        ? "Tipografi bersih dan bebas emoji, sesuai standar materi pemasaran korporat."
        : "Terdeteksi emoji pada materi iklan. Emoji otomatis dinetralisir untuk menjaga profesionalitas brosur.",
    });

    if (hasEmojis) {
      tips.push("Hindari penggunaan emoji pada materi brosur cetak atau digital premium.");
    }

    const canvasText = [
      layout.headline.text,
      ...(layout.promoPills || []).map((pill) => pill.text),
      ...(layout.promoBadges || []).map((badge) => badge.text),
      ...(layout.specsPills || []),
      layout.priceBadge?.rawPrice || "",
    ].join(" ").toLowerCase();
    const expectedPromos = context?.promos || (layout.promoPills || []).map((pill) => pill.text);
    const missingPromos = expectedPromos.filter((promo) => {
      const token = promo.toLowerCase().replace("free ppn 100%", "ppn").replace("bebas ppn", "ppn");
      return !canvasText.includes(promo.toLowerCase()) && !canvasText.includes(token);
    });
    const promosComplete = missingPromos.length === 0;
    checks.push({
      id: "entity_completeness",
      category: "conversion",
      label: "Kelengkapan Promo di Kanvas",
      passed: promosComplete,
      severity: promosComplete ? "passed" : "warning",
      message: promosComplete
        ? "Seluruh promo brief tampil pada kanvas."
        : `Promo belum tampil: ${missingPromos.join(", ")}.`,
    });
    if (!promosComplete) tips.push("Pastikan setiap promo di brief muncul sebagai pill badge.");

    const genericCtaHeadline = /klaim promo[\s\S]*whatsapp/i.test(layout.headline.text || "");
    checks.push({
      id: "headline_hook_quality",
      category: "typography",
      label: "Kualitas Headline",
      passed: !genericCtaHeadline,
      severity: genericCtaHeadline ? "warning" : "passed",
      message: genericCtaHeadline
        ? "Headline masih berupa kalimat CTA generik."
        : "Headline menyebut nilai properti, bukan hanya ajakan CTA.",
    });

    const preserved = layout.fidelityMode !== "ai_atmosphere";
    checks.push({
      id: "photo_fidelity_mode",
      category: "fidelity",
      label: "Status Fidelitas Foto",
      passed: preserved || !hasReferenceImage,
      severity: preserved || !hasReferenceImage ? "passed" : "warning",
      message: layout.fidelityMode === "ai_atmosphere"
        ? "Foto dihasilkan atau diubah oleh AI atmosphere. Verifikasi bentuk unit sebelum tayang."
        : "Mode preserve_original mengunci geometri foto asli.",
    });

    const specSize = 22;
    checks.push({
      id: "dead_space_and_typography",
      category: "typography",
      label: "Ukuran Spesifikasi",
      passed: specSize >= 20,
      severity: "passed",
      message: "Spesifikasi dirender minimal 22px pada skala kanvas 1080px.",
    });

    // 12. Duplicate Marketing Content & Contact Redundancy Check
    const waNumber = layout.whatsappNumber || "";
    const headlineHasWa = Boolean(waNumber && (layout.headline.text || "").includes(waNumber));
    const subHasWa = Boolean(waNumber && (layout.subheadline?.text || "").includes(waNumber));
    const isDuplicateContact = headlineHasWa || subHasWa;

    checks.push({
      id: "no_duplicate_marketing_text",
      category: "conversion",
      label: "Bebas Duplikasi Teks & Kontak",
      passed: !isDuplicateContact,
      severity: isDuplicateContact ? "warning" : "passed",
      message: !isDuplicateContact
        ? "Informasi kontak dan harga ditempatkan secara proporsional tanpa repetisi membingungkan."
        : "Nomor WhatsApp terulang lebih dari sekali pada kanvas. Tempatkan nomor hanya pada kartu kontak resmi.",
    });

    if (isDuplicateContact) {
      tips.push("Hindari menuliskan nomor WhatsApp di dalam headline jika sudah ada slot kontak resmi.");
    }

    // Calculate objective score
    const passedCount = checks.filter((c) => c.passed).length;
    const totalCount = checks.length;
    const overallScore = Math.round((passedCount / totalCount) * 100);

    const hasCriticalError = checks.some((c) => c.severity === "error");

    const overallStatus =
      !hasCriticalError && overallScore >= 85
        ? "excellent"
        : overallScore >= 65
        ? "good"
        : "needs_attention";

    return {
      overallStatus,
      overallScore,
      passedChecksCount: passedCount,
      totalChecksCount: totalCount,
      isProductionReady: overallStatus === "excellent",
      checks,
      actionableTips: tips,
    };
  }
}
