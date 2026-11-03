"use client";

import React, { useState, useEffect, useTransition } from "react";
import { NaturalLanguageBriefParser } from "@/lib/ai/creative-studio/brief-parser";
import { processLogoImage } from "@/lib/ai/creative-studio/logo-processor";
import type {
  CreativeBriefInput,
  UploadedAssetItem,
  AspectRatio,
  StylePreset,
} from "@/lib/ai/creative-studio/types";
import { Step1PhotoSection } from "./composer/Step1PhotoSection";
import { Step2InfoSection } from "./composer/Step2InfoSection";
import { Step3DesignSection } from "./composer/Step3DesignSection";

export interface ConversationalComposerProps {
  initialText?: string;
  brief: CreativeBriefInput;
  onChangeBrief: (brief: CreativeBriefInput) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  isDirtyRequiringRegenerate?: boolean;
}

const GENERATION_STAGES = [
  "Memproses foto & format rasio...",
  "Menyusun formula desain & tipografi...",
  "Mensintesis visual iklan siap tayang...",
];

export function ConversationalComposer({
  initialText = "",
  brief,
  onChangeBrief,
  onGenerate,
  isGenerating,
  isDirtyRequiringRegenerate = false,
}: ConversationalComposerProps) {
  const [, startTransition] = useTransition();

  // Active Guided Step: 1 = Foto, 2 = Informasi, 3 = Gaya Desain
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Upload and UI States
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [autoRemoveWhiteBg, setAutoRemoveWhiteBg] = useState(true);

  // Cycling Generation Loading Step
  const [loadingStageIdx, setLoadingStageIdx] = useState(0);

  // Deterministic Precedence: Tracks fields explicitly typed/edited by user
  const [verifiedFields, setVerifiedFields] = useState<Set<string>>(() => new Set());

  // Smart Brief Narrative Text
  const [narrativeText, setNarrativeText] = useState(
    initialText ||
      brief.description ||
      "Rumah modern 2 lantai di BSD City, Tangerang Selatan. Harga mulai Rp850 juta. DP 0% dan Bebas PPN 100%. 3 Kamar Tidur, 2 Kamar Mandi, LB 85m², LT 72m². Dekat akses tol dan stasiun. Hubungi sales 0812-8899-5500. Target keluarga muda."
  );

  const [hasParsedInitial, setHasParsedInitial] = useState(false);

  // Cycle loading messages when isGenerating is true
  useEffect(() => {
    if (!isGenerating) {
      setLoadingStageIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStageIdx((prev) => (prev + 1) % GENERATION_STAGES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Synchronize narrative text changes to structured brief with Deterministic Precedence
  const syncNarrative = (
    text: string,
    currentRatio = brief.aspectRatio,
    currentAssets = brief.assets,
    currentPreset = brief.stylePreset
  ) => {
    setNarrativeText(text);
    startTransition(() => {
      const parsed = NaturalLanguageBriefParser.parse(text, {
        aspectRatio: currentRatio,
        assets: currentAssets,
        stylePreset: currentPreset,
        logoDataUrl: brief.logoDataUrl,
        logoPlacement: brief.logoPlacement,
        whatsappNumber: verifiedFields.has("whatsappNumber") ? brief.whatsappNumber : undefined,
        specsText: verifiedFields.has("specsText") ? brief.specsText : undefined,
      });

      // Preserve manually verified fields strictly
      const nextBrief: CreativeBriefInput = {
        ...parsed,
        projectName: verifiedFields.has("projectName")
          ? brief.projectName
          : parsed.projectName || brief.projectName || "",
        propertyLocation: verifiedFields.has("propertyLocation")
          ? brief.propertyLocation
          : parsed.propertyLocation || brief.propertyLocation || "",
        startingPrice: verifiedFields.has("startingPrice")
          ? brief.startingPrice
          : parsed.startingPrice || brief.startingPrice || "",
        specsText: verifiedFields.has("specsText")
          ? brief.specsText
          : parsed.specsText || brief.specsText || "",
        bedrooms: verifiedFields.has("bedrooms")
          ? brief.bedrooms
          : parsed.bedrooms || brief.bedrooms,
        bathrooms: verifiedFields.has("bathrooms")
          ? brief.bathrooms
          : parsed.bathrooms || brief.bathrooms,
        landArea: verifiedFields.has("landArea")
          ? brief.landArea
          : parsed.landArea || brief.landArea,
        buildingArea: verifiedFields.has("buildingArea")
          ? brief.buildingArea
          : parsed.buildingArea || brief.buildingArea,
        whatsappNumber: verifiedFields.has("whatsappNumber")
          ? brief.whatsappNumber
          : parsed.whatsappNumber ?? brief.whatsappNumber ?? null,
        headline: verifiedFields.has("headline")
          ? brief.headline
          : parsed.headline || brief.headline,
        ctaText: verifiedFields.has("ctaText")
          ? brief.ctaText
          : parsed.ctaText || brief.ctaText,
        promoHeadline: verifiedFields.has("promoHeadline")
          ? brief.promoHeadline
          : parsed.promoHeadline || brief.promoHeadline,
        aspectRatio: currentRatio,
        stylePreset: currentPreset || "auto_director",
        fidelityMode:
          brief.fidelityMode ||
          (currentAssets.length > 0 ? "preserve_original" : "ai_atmosphere"),
        assets: currentAssets,
        logoDataUrl: brief.logoDataUrl ?? parsed.logoDataUrl ?? null,
        logoPlacement: brief.logoPlacement || "auto",
        hasFreePpn:
          verifiedFields.has("hasFreePpn") ? brief.hasFreePpn : parsed.hasFreePpn,
      };

      onChangeBrief(nextBrief);
    });
  };

  // Run initial parse once on mount
  useEffect(() => {
    if (!hasParsedInitial && narrativeText) {
      syncNarrative(narrativeText, brief.aspectRatio, brief.assets, brief.stylePreset);
      setHasParsedInitial(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasParsedInitial]);

  // Keep narrative textarea in sync when brief is reset externally
  useEffect(() => {
    if (brief.description !== undefined && brief.description !== narrativeText) {
      setNarrativeText(brief.description);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.description]);

  // Update a single field manually and mark it as verified
  const handleUpdateField = <K extends keyof CreativeBriefInput>(
    field: K,
    value: CreativeBriefInput[K]
  ) => {
    setVerifiedFields((prev) => new Set(prev).add(field as string));
    onChangeBrief({
      ...brief,
      [field]: value,
    });
  };

  // Handle manual Promo field changes
  const handlePromoFieldChange = (text: string) => {
    setVerifiedFields((prev) => new Set(prev).add("promoHeadline"));
    const splitPromos = text
      .split("•")
      .map((p) => p.trim())
      .filter(Boolean);

    onChangeBrief({
      ...brief,
      promos: splitPromos,
      promoHeadline: text,
      dpAmount: splitPromos.find((p) => /dp/i.test(p)) || brief.dpAmount,
    });
  };

  // Handle manual Specs field changes
  const handleSpecsFieldChange = (text: string) => {
    setVerifiedFields((prev) =>
      new Set(prev)
        .add("specsText")
        .add("bedrooms")
        .add("bathrooms")
        .add("landArea")
        .add("buildingArea")
    );

    const ktMatch = text.match(/(\d+)\s*KT/i);
    const kmMatch = text.match(/(\d+)\s*KM/i);
    const ltMatch = text.match(/LT\s*[:=]?\s*(\d+)/i);
    const lbMatch = text.match(/LB\s*[:=]?\s*(\d+)/i);

    onChangeBrief({
      ...brief,
      specsText: text,
      bedrooms: ktMatch ? ktMatch[1] : brief.bedrooms,
      bathrooms: kmMatch ? kmMatch[1] : brief.bathrooms,
      landArea: ltMatch ? ltMatch[1] : brief.landArea,
      buildingArea: lbMatch ? lbMatch[1] : brief.buildingArea,
    });
  };

  // Photo Upload Handler
  const handlePhotoUpload = async (file: File) => {
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "facade");

      const res = await fetch("/api/creative-studio/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      const uploadedUrl = res.ok && json.success ? json.data.url : URL.createObjectURL(file);

      const newAsset: UploadedAssetItem = {
        id: `asset-${Date.now()}`,
        previewUrl: uploadedUrl,
        category: "facade",
        isPrimary: true,
        fileName: file.name,
      };

      onChangeBrief({
        ...brief,
        assets: [newAsset],
        fidelityMode: "preserve_original",
      });
    } catch {
      // Local URL Fallback
      const localUrl = URL.createObjectURL(file);
      const newAsset: UploadedAssetItem = {
        id: `asset-${Date.now()}`,
        previewUrl: localUrl,
        category: "facade",
        isPrimary: true,
        fileName: file.name,
      };
      onChangeBrief({
        ...brief,
        assets: [newAsset],
        fidelityMode: "preserve_original",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    onChangeBrief({
      ...brief,
      assets: [],
      fidelityMode: "ai_atmosphere",
    });
  };

  // Logo Upload Handler with Auto-Remove White Background
  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) return;

      if (autoRemoveWhiteBg) {
        try {
          const processed = await processLogoImage(rawDataUrl, { autoRemoveBg: true });
          onChangeBrief({
            ...brief,
            logoDataUrl: processed.dataUrl,
          });
          return;
        } catch {
          // fallback to raw
        }
      }

      onChangeBrief({
        ...brief,
        logoDataUrl: rawDataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  const primaryAsset = brief.assets.find((a) => a.isPrimary) || brief.assets[0];

  // Validation status per step
  const step1Complete = Boolean(primaryAsset || brief.description);
  const step2Complete = Boolean(brief.propertyLocation || brief.startingPrice);
  const step3Complete = Boolean(brief.stylePreset);

  const canGenerate = Boolean(
    (brief.projectName?.trim() || brief.propertyLocation?.trim()) && !isGenerating
  );

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full">
      {/* 1. COMPOSER TOP HEADER: App Title & 3-Step Guided Nav */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 shrink-0 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600 dark:text-sky-400 block">
              Creative Co-Pilot
            </span>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50 truncate">
              Smart Ad Composer
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
              Format: <strong className="text-zinc-900 dark:text-zinc-100">{brief.aspectRatio}</strong>
            </span>
          </div>
        </div>

        {/* 3-Step Guided Workflow Segmented Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-zinc-200/70 dark:bg-zinc-800/80 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate ${
              activeStep === 1
                ? "bg-white dark:bg-zinc-900 text-sky-600 dark:text-sky-400 shadow-2xs font-extrabold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 shrink-0">
              {step1Complete ? "✓" : "1"}
            </span>
            <span className="truncate">1. Foto</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(2)}
            className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate ${
              activeStep === 2
                ? "bg-white dark:bg-zinc-900 text-sky-600 dark:text-sky-400 shadow-2xs font-extrabold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 shrink-0">
              {step2Complete ? "✓" : "2"}
            </span>
            <span className="truncate">2. Info</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate ${
              activeStep === 3
                ? "bg-white dark:bg-zinc-900 text-sky-600 dark:text-sky-400 shadow-2xs font-extrabold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 shrink-0">
              {step3Complete ? "✓" : "3"}
            </span>
            <span className="truncate">3. Desain</span>
          </button>
        </div>
      </div>

      {/* 2. COMPOSER MAIN SCROLLABLE BODY */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {activeStep === 1 && (
          <Step1PhotoSection
            aspectRatio={brief.aspectRatio}
            onChangeAspectRatio={(ratio) => handleUpdateField("aspectRatio", ratio)}
            primaryAsset={primaryAsset}
            isUploadingPhoto={isUploadingPhoto}
            onUploadPhoto={handlePhotoUpload}
            onRemovePhoto={handleRemovePhoto}
            fidelityMode={brief.fidelityMode || "preserve_original"}
            onChangeFidelityMode={(mode) => handleUpdateField("fidelityMode", mode)}
            logoDataUrl={brief.logoDataUrl}
            logoPlacement={brief.logoPlacement}
            onChangeLogoPlacement={(placement) => handleUpdateField("logoPlacement", placement)}
            onUploadLogo={handleLogoUpload}
            onRemoveLogo={() => handleUpdateField("logoDataUrl", null)}
            autoRemoveWhiteBg={autoRemoveWhiteBg}
            onChangeAutoRemoveWhiteBg={setAutoRemoveWhiteBg}
          />
        )}

        {activeStep === 2 && (
          <Step2InfoSection
            narrativeText={narrativeText}
            onNarrativeChange={syncNarrative}
            brief={brief}
            verifiedFields={verifiedFields}
            onUpdateField={handleUpdateField}
            onPromoFieldChange={handlePromoFieldChange}
            onSpecsFieldChange={handleSpecsFieldChange}
          />
        )}

        {activeStep === 3 && (
          <Step3DesignSection
            selectedPreset={brief.stylePreset || "auto_director"}
            onSelectPreset={(preset) => handleUpdateField("stylePreset", preset)}
            logoPlacement={brief.logoPlacement}
            onChangeLogoPlacement={(placement) => handleUpdateField("logoPlacement", placement)}
            customHeadline={brief.headline}
            onChangeCustomHeadline={(headline) => handleUpdateField("headline", headline)}
            photographyStyle={brief.photographyStyle || "clean_daylight"}
            onChangePhotographyStyle={(style) => handleUpdateField("photographyStyle", style)}
          />
        )}

        {/* Guided Step Navigation Buttons (Prev / Next) */}
        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          {activeStep > 1 ? (
            <button
              type="button"
              onClick={() => setActiveStep((prev) => (prev - 1) as 1 | 2)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              ← Kembali
            </button>
          ) : (
            <div />
          )}

          {activeStep < 3 ? (
            <button
              type="button"
              onClick={() => setActiveStep((prev) => (prev + 1) as 2 | 3)}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer shadow-xs ml-auto"
            >
              Lanjut ke Langkah {activeStep + 1} →
            </button>
          ) : null}
        </div>
      </div>

      {/* 3. COMPOSER FOOTER BAR: Buat Gambar Iklan CTA */}
      <div className="p-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 shrink-0">
        {isDirtyRequiringRegenerate && (
          <div className="mb-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <span className="text-base shrink-0">⚠️</span>
            <span className="font-semibold leading-snug">
              Rasio atau Template diubah. Klik tombol di bawah untuk membuat ulang iklan sesuai format baru.
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className={`w-full py-3.5 px-4 rounded-xl font-black text-sm text-white shadow-md disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer ${
            isDirtyRequiringRegenerate
              ? "bg-linear-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/25"
              : "bg-linear-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 shadow-emerald-500/20"
          }`}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>{GENERATION_STAGES[loadingStageIdx]}</span>
            </>
          ) : isDirtyRequiringRegenerate ? (
            <>
              <span className="text-base">🔄</span>
              <span>Generate Ulang Iklan (Sesuaikan Format)</span>
            </>
          ) : (
            <>
              <span className="text-amber-300 text-base">⚡</span>
              <span>Buat Gambar Iklan</span>
            </>
          )}
        </button>

        <p className="text-[10px] text-zinc-400 text-center mt-1.5">
          Muse Image 1.0 • Format {brief.aspectRatio} • Siap Tayang Meta Ads (Feed &amp; Reels)
        </p>
      </div>
    </div>
  );
}
