"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { CreativeCanvas } from "@/components/creative-studio/CreativeCanvas";
import { downloadStudioImage } from "@/components/creative-studio/export-utils";
import type { StudioAspectRatio } from "@/lib/ai/creative-studio/muse-provider";
import type { ModelRun } from "@/lib/ai/creative-studio/muse-creative/critic";
import type { CampaignConcept } from "@/lib/ai/creative-studio/muse-creative/art-direction";
import { composeStudioAdPrompt, type StudioAdCheck } from "@/lib/ai/creative-studio/studio-ad-prompt";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface StudioMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  images?: string[];
  aspectRatio?: StudioAspectRatio;
  imageUrl?: string;
  responseId?: string;
  reasoning?: string;
  modelLog?: ModelRun[];
  artDirections?: CampaignConcept[];
  adChecks?: StudioAdCheck[];
  timestamp: number;
}

export interface PropertyAdArchetypeItem {
  id: "emerald_minimalist" | "luxury_architecture" | "royal_navy_metro" | "golden_aurora_wave" | "kaba_direct_offer";
  name: string;
  icon: string;
  subtitle: string;
  tag: string;
  paletteColors: [string, string, string];
  promptTemplate: string;
}

export const PROPERTY_AD_ARCHETYPES: PropertyAdArchetypeItem[] = [
  {
    id: "emerald_minimalist",
    name: "Emerald Minimalist",
    icon: "🌿",
    subtitle: "Century Style • Fresh Modern",
    tag: "High Trust • Modern Cluster",
    paletteColors: ["#064E3B", "#10B981", "#F59E0B"],
    promptTemplate: "Poster iklan properti gaya Emerald Minimalist (Century Style) untuk hunian asri modern 2 lantai, harga mulai Rp 650 Juta, promo DP 0% & Free BPHTB, 3 Kamar Tidur, 2 Kamar Mandi, Hubungi WhatsApp Marketing.",
  },
  {
    id: "luxury_architecture",
    name: "Luxury Architecture",
    icon: "🏛️",
    subtitle: "Garis Bumi • Grand Luxury",
    tag: "Ultra Luxury • Custom Build",
    paletteColors: ["#1C1917", "#D4AF37", "#EAB308"],
    promptTemplate: "Poster iklan properti gaya Luxury Architectural Showcase (Garis Bumi) bernuansa espresso dan emas mewah, fasad arsitektur megah, tombol WhatsApp emas menyala, spesifikasi premium.",
  },
  {
    id: "royal_navy_metro",
    name: "Royal Navy Metro",
    icon: "🌃",
    subtitle: "Metro Regency • Elite City",
    tag: "Elite Residence • Premium City",
    paletteColors: ["#0F172A", "#38BDF8", "#F59E0B"],
    promptTemplate: "Poster iklan properti gaya Royal Navy Metro Elite untuk cluster residensial premium di pusat kota, harga Rp 1.2 Miliar, akses tol dekat, fasilitas one gate system, konsultasi WhatsApp.",
  },
  {
    id: "golden_aurora_wave",
    name: "Golden Hour Sunset",
    icon: "🌅",
    subtitle: "Warm Family • Golden Sunset",
    tag: "Warm Sunset • High Aesthetic",
    paletteColors: ["#78350F", "#D4AF37", "#F59E0B"],
    promptTemplate: "Poster iklan properti gaya Golden Aurora Exclusive dengan pencahayaan warm sunset alami, harga mulai Rp 450 Juta, lingkungan asri ramah keluarga, cicilan KPR terjangkau.",
  },
  {
    id: "kaba_direct_offer",
    name: "Flash Promo DP 0%",
    icon: "⚡",
    subtitle: "Kaba Style • High Conversion",
    tag: "High Conversion • Fast Closing",
    paletteColors: ["#14532D", "#EAB308", "#FACC15"],
    promptTemplate: "Poster iklan properti High-Impact Direct Offer gaya Kaba Residence, penawaran raksasa DP Cuman 3 Juta, 100% Free Semua Biaya KPR & Notaris, booking unit segera via WhatsApp.",
  },
];

const RATIO_OPTIONS: Array<{ value: StudioAspectRatio; label: string; metaPlacement: string }> = [
  { value: "4:5", label: "Feed 4:5", metaPlacement: "1440×1800 · Feed Instagram dan Facebook" },
  { value: "9:16", label: "Story 9:16", metaPlacement: "1440×2560 · Story, Reels, dan Status" },
  { value: "1:1", label: "Kotak 1:1", metaPlacement: "1080×1080 · Feed, carousel, dan Marketplace" },
];

const SUGGESTED_PROMPTS_ID = [
  "Poster iklan minimalis modern: Cluster 2 lantai di BSD, harga mulai Rp 650 Juta, DP 0% & Free BPHTB, 3 KT, WhatsApp Marketing.",
  "Suasana sore keemasan (Golden Hour): Villa mewah tropis Ubud Bali dengan kolam renang infinity, private villa exclusive.",
  "Flash Promo DP 0%: Kaba Residence, DP Cuman 3 Juta, Bebas Semua Biaya KPR & Notaris, booking unit segera.",
];

const SUGGESTED_PROMPTS_EN = [
  "Modern minimalist ad poster: 2-story modern cluster, starting from Rp 650 Million, 0% DP & Free Legal Fees, WhatsApp CTA.",
  "Golden Hour Sunset: Luxury tropical villa in Ubud Bali with private infinity pool, exclusive architectural showcase.",
  "High-Impact Flash Promo: DP only Rp 3 Million, Free Mortgage & Notary Fees, instant WhatsApp booking.",
];

const AGENTIC_REASONING_STEPS = [
  "Menganalisis komposisi fasad & arsitektur bangunan...",
  "Menyelaraskan palet warna arketipe & pencahayaan visual...",
  "Menyusun hierarki headline, promo DP, dan spesifikasi unit...",
  "Merender poster iklan properti siap tayang via AI Engine...",
];

export default function AIPropertyCreativeStudioPage() {
  const { locale } = useI18n();
  const isEn = locale === "en";

  // Messages and Generation State
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [activeReferenceUrl, setActiveReferenceUrl] = useState<string | null>(null);
  const [activeRatio, setActiveRatio] = useState<StudioAspectRatio>("4:5");
  const [activeResponseId, setActiveResponseId] = useState<string | null>(null);
  const [activeArchetype, setActiveArchetype] = useState<string | null>(null);

  // Inputs
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [reasoningStepIndex, setReasoningStepIndex] = useState(0);
  const [expandedReasonings, setExpandedReasonings] = useState<Record<string, boolean>>({});
  const [mobilePane, setMobilePane] = useState<"chat" | "canvas">("chat");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cycle loading step messages during generation
  useEffect(() => {
    if (!isGenerating) {
      setReasoningStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setReasoningStepIndex((prev) => (prev + 1) % AGENTIC_REASONING_STEPS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Auto-scroll message list on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Handle image files to base64 Data URLs
  const handleFiles = useCallback((files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );
    if (validFiles.length === 0) return;

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setAttachedImages((prev) => [...prev, result]);
          setActiveReferenceUrl((prev) => prev || result);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Handle clipboard paste of images
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files);
    }
  };

  const msgCounterRef = useRef(0);

  // Send conversational prompt
  const handleSendPrompt = async (customText?: string) => {
    const textToSend = (customText || inputPrompt).trim();
    if ((!textToSend && attachedImages.length === 0) || isGenerating) return;

    msgCounterRef.current += 1;
    const seq = msgCounterRef.current;
    const userMessageId = `user_${seq}`;
    const userImages = [...attachedImages];
    const userRatio = activeRatio;
    const currentPrevId = activeResponseId;

    const userMsg: StudioMessage = {
      id: userMessageId,
      role: "user",
      text: textToSend,
      images: userImages.length > 0 ? userImages : undefined,
      aspectRatio: userRatio,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setAttachedImages([]);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/creative-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend,
          images: userImages,
          aspectRatio: userRatio,
          previousResponseId: currentPrevId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || (isEn ? "Failed to process property ad image" : "Gagal merender poster iklan properti")
        );
      }

      msgCounterRef.current += 1;
      const assistantMessageId = `assistant_${msgCounterRef.current}`;

      const finalUrl = data.imageUrl || data.composedImageUrl || null;

      if (finalUrl) {
        setActiveImageUrl(finalUrl);
      }
      if (data.responseId) {
        setActiveResponseId(data.responseId);
      }
      if (data.aspectRatio) {
        setActiveRatio(data.aspectRatio as StudioAspectRatio);
      }

      const assistantMsg: StudioMessage = {
        id: assistantMessageId,
        role: "assistant",
        text: data.reasoning || (isEn ? "Property ad creative generated successfully." : "Materi iklan properti berhasil dibuat."),
        imageUrl: finalUrl || undefined,
        responseId: data.responseId,
        reasoning: data.reasoning,
        modelLog: Array.isArray(data.modelLog) ? data.modelLog : undefined,
        artDirections: Array.isArray(data.artDirections) ? data.artDirections : undefined,
        aspectRatio: (data.aspectRatio as StudioAspectRatio) || userRatio,
        adChecks: data.adFacts?.checks,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      // On mobile, auto-switch to canvas view after generation
      if (window.innerWidth < 1024 && finalUrl) {
        setMobilePane("canvas");
      }
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : String(err);
      msgCounterRef.current += 1;
      const errorMsg: StudioMessage = {
        id: `assistant_err_${msgCounterRef.current}`,
        role: "assistant",
        text: errorText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Select an Archetype Formula
  const handleSelectArchetype = (arch: PropertyAdArchetypeItem) => {
    setActiveArchetype(arch.id);
    setInputPrompt(arch.promptTemplate);
    textareaRef.current?.focus();
  };

  // Reset Session
  const handleResetSession = () => {
    setMessages([]);
    setActiveImageUrl(null);
    setActiveReferenceUrl(null);
    setActiveResponseId(null);
    setActiveArchetype(null);
    setInputPrompt("");
    setAttachedImages([]);
    textareaRef.current?.focus();
  };

  // Toggle Reasoning Details
  const toggleReasoning = (msgId: string) => {
    setExpandedReasonings((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // History of generated items in this session
  const generatedHistory = messages.filter(
    (m) => m.role === "assistant" && Boolean(m.imageUrl)
  );

  const suggestedPrompts = isEn ? SUGGESTED_PROMPTS_EN : SUGGESTED_PROMPTS_ID;

  const readiness = useMemo(
    () =>
      composeStudioAdPrompt({
        userPrompt: inputPrompt,
        aspectRatio: activeRatio,
        hasReference: attachedImages.length > 0,
        isRevision: Boolean(activeResponseId),
      }),
    [inputPrompt, activeRatio, attachedImages.length, activeResponseId]
  );
  const checkLabel: Record<StudioAdCheck["id"], string> = {
    photo: isEn ? "Facade" : "Foto",
    price: isEn ? "Price" : "Harga",
    promo: isEn ? "Offer" : "Promo",
    specs: isEn ? "Specs" : "Spek",
    location: isEn ? "Location" : "Lokasi",
    whatsapp: "WhatsApp",
  };
  return (
    <div className="flex h-full w-full min-h-0 min-w-0 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans select-none overflow-hidden transition-colors">
      {/* =========================================================================
          LEFT COLUMN: Property Ad Creative Control, Archetypes & Message Thread
         ========================================================================= */}
      <div
        className={`${
          mobilePane === "chat" ? "flex" : "hidden"
        } h-full min-h-0 w-full flex-col border-r border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-950 lg:flex lg:w-[460px] xl:w-[500px] shrink-0 transition-colors`}
      >
        {/* 1. Header Toolbar */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90 z-10">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20 font-bold text-xs">
              AI
            </div>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {isEn ? "AI Property Ad Studio" : "Studio Iklan Properti AI"}
              </span>
              <span className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                {isEn ? "Muse Image 1.0 · Ad-ready brochure" : "Muse Image 1.0 · Brosur siap iklan"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Mobile Pane Switcher */}
            <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800 lg:hidden">
              <button
                type="button"
                onClick={() => setMobilePane("chat")}
                className={`px-2 py-1 text-[11px] font-medium rounded-md cursor-pointer transition ${
                  mobilePane === "chat"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-semibold"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Kontrol
              </button>
              <button
                type="button"
                onClick={() => setMobilePane("canvas")}
                className={`px-2 py-1 text-[11px] font-medium rounded-md cursor-pointer transition ${
                  mobilePane === "canvas"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-semibold"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Kanvas {generatedHistory.length > 0 && `(${generatedHistory.length})`}
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetSession}
              title={isEn ? "Reset and start new session" : "Mulai sesi kreatif baru"}
              className="shrink-0 cursor-pointer rounded-lg border border-zinc-200/90 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-850 dark:hover:text-white transition"
            >
              {isEn ? "New Session" : "Sesi Baru"}
            </button>
          </div>
        </div>

        {/* 2. Aspect Ratio Selector Bar */}
        <div className="shrink-0 border-b border-zinc-200/80 bg-zinc-50/70 px-4 py-2 dark:border-zinc-800/80 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 shrink-0">
              {isEn ? "Aspect Ratio:" : "Format Rasio:"}
            </span>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
              {RATIO_OPTIONS.map((opt) => {
                const isActive = activeRatio === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setActiveRatio(opt.value)}
                    title={opt.metaPlacement}
                    className={`rounded-lg px-2.5 py-1 text-xs font-mono transition cursor-pointer shrink-0 ${
                      isActive
                        ? "bg-amber-500/15 text-amber-700 border border-amber-500/50 dark:bg-amber-500/25 dark:text-amber-300 dark:border-amber-500/60 font-bold shadow-2xs"
                        : "bg-white border border-zinc-200/80 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Message Stream & Property Archetypes */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            if (e.dataTransfer.files) {
              handleFiles(e.dataTransfer.files);
            }
          }}
          className="relative min-h-0 flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800"
        >
          {/* Drag Overlay */}
          {isDraggingOver && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-amber-500/10 backdrop-blur-xs border-2 border-dashed border-amber-500 m-3 rounded-2xl">
              <div className="text-center space-y-2 p-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Lepaskan Foto Fasad Rumah</h4>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300">AI akan mempertahankan arsitektur fasad bangunan 100%.</p>
              </div>
            </div>
          )}

          {/* Empty State / Property Archetypes Showcase */}
          {messages.length === 0 ? (
            <div className="space-y-4 py-1">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {isEn ? "Proven Property Ad Formulas" : "Formula Arketipe Iklan Properti Teruji"}
                </span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isEn
                    ? "Select an agency-tested archetype below or type custom property details:"
                    : "Pilih formula arketipe standar agensi di bawah atau tulis detail unit Anda:"}
                </p>
              </div>

              {/* Archetypes Grid */}
              <div className="grid grid-cols-1 gap-2.5">
                {PROPERTY_AD_ARCHETYPES.map((arch) => {
                  const isArchActive = activeArchetype === arch.id;
                  return (
                    <div
                      key={arch.id}
                      onClick={() => handleSelectArchetype(arch)}
                      className={`group relative flex flex-col justify-between rounded-xl border p-3 shadow-2xs transition-all hover:border-amber-500/60 hover:shadow-sm cursor-pointer ${
                        isArchActive
                          ? "border-amber-500 bg-amber-50/30 dark:border-amber-500/60 dark:bg-amber-950/20"
                          : "border-zinc-200/90 bg-white dark:border-zinc-800/90 dark:bg-zinc-900/60 dark:hover:border-amber-500/40 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{arch.icon}</span>
                            <div>
                              <h4 className="text-xs font-bold text-zinc-900 group-hover:text-amber-600 transition dark:text-zinc-100 dark:group-hover:text-amber-400">
                                {arch.name}
                              </h4>
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                {arch.subtitle}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 shrink-0">
                            {arch.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                          {arch.promptTemplate}
                        </p>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                        <div className="flex items-center gap-1.5">
                          {arch.paletteColors.map((color, i) => (
                            <span
                              key={i}
                              className="h-2.5 w-2.5 rounded-full border border-black/10 shadow-2xs"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] font-semibold text-amber-600 group-hover:underline dark:text-amber-400">
                          {isEn ? "Use Formula →" : "Gunakan Formula →"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Prompts */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {isEn ? "Quick Prompts:" : "Inspirasi Prompt Cepat:"}
                </span>
                <div className="space-y-1.5">
                  {suggestedPrompts.map((promptText, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendPrompt(promptText)}
                      className="w-full text-left p-2.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:bg-amber-50/30 dark:hover:bg-zinc-850 hover:border-amber-500/40 text-xs text-zinc-800 dark:text-zinc-200 transition-all cursor-pointer shadow-2xs"
                    >
                      {promptText}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                {/* User Message */}
                {msg.role === "user" ? (
                  <div className="bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 rounded-2xl p-3.5 space-y-2 border border-zinc-200/70 dark:border-zinc-800 select-text">
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 pb-1">
                        {msg.images.map((imgSrc, i) => (
                          <img
                            key={i}
                            src={imgSrc}
                            alt="Attachment"
                            className="w-14 h-14 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-2xs"
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold">{isEn ? "Property Brief" : "Instruksi Iklan"}</span>
                      {msg.aspectRatio && (
                        <span className="font-mono uppercase font-semibold text-amber-600 dark:text-amber-400">
                          {msg.aspectRatio}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap font-normal">
                      {msg.text}
                    </p>
                  </div>
                ) : (
                  /* Assistant Message */
                  <div className="border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 rounded-2xl p-3.5 space-y-3 shadow-2xs">
                    {msg.imageUrl ? (
                      <div className="space-y-3">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setActiveImageUrl(msg.imageUrl || null);
                            if (msg.aspectRatio) setActiveRatio(msg.aspectRatio);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              setActiveImageUrl(msg.imageUrl || null);
                              if (msg.aspectRatio) setActiveRatio(msg.aspectRatio);
                            }
                          }}
                          className="relative group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-750 bg-zinc-100 dark:bg-zinc-950 aspect-[4/3] flex items-center justify-center cursor-pointer shadow-xs"
                        >
                          <img
                            src={msg.imageUrl}
                            alt="Property Ad Preview"
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-102"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-xs">
                              {isEn ? "Open in Canvas Stage" : "Tampilkan di Kanvas Stage"}
                            </span>
                          </div>
                          {msg.aspectRatio && (
                            <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 font-mono text-[10px] font-bold text-white shadow-2xs">
                              {msg.aspectRatio}
                            </span>
                          )}
                        </div>

                        {msg.artDirections && msg.artDirections.length > 0 && (
                          <ol className="space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                            {msg.artDirections.map((concept) => (
                              <li key={concept.title} className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                                <span className="font-medium text-zinc-800 dark:text-zinc-100">{concept.title}</span>
                                {" · "}
                                {concept.grid}
                                {" · "}
                                {concept.typeScale}
                                {" · "}
                                {concept.hierarchy}
                              </li>
                            ))}
                          </ol>
                        )}
                        {msg.modelLog && msg.modelLog.length > 0 && (
                          <ol className="space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                            {msg.modelLog.map((run, index) => (
                              <li key={`${run.model}-${run.task}-${index}`} className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                                <span className="font-medium text-zinc-800 dark:text-zinc-100">{run.model}</span>
                                {" · "}
                                {run.task}
                                {" · "}
                                {run.status === "completed" ? "selesai" : run.status === "failed" ? "gagal" : "dilewati"}
                                {" · "}
                                {Math.round(run.durationMs / 100) / 10}
                                {" dtk"}
                                {run.output ? ` · ${run.output}` : ""}
                                {run.error ? ` · ${run.error}` : ""}
                              </li>
                            ))}
                          </ol>
                        )}
                        {msg.reasoning && (
                          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
                            <button
                              type="button"
                              onClick={() => toggleReasoning(msg.id)}
                              className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center justify-between w-full cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <span className="text-amber-500">💡</span>
                                <span>{isEn ? "AI Art Director Analysis" : "Analisis AI Creative Director"}</span>
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                {expandedReasonings[msg.id]
                                  ? isEn
                                    ? "Hide ▲"
                                    : "Tutup ▲"
                                  : isEn
                                  ? "View ▼"
                                  : "Lihat ▼"}
                              </span>
                            </button>
                            {expandedReasonings[msg.id] && (
                              <>
                            {msg.adChecks && msg.adChecks.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {msg.adChecks.map((check) => (
                                  <span
                                    key={check.id}
                                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                      check.ok
                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                        : "border-zinc-200 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
                                    }`}
                                  >
                                    {checkLabel[check.id]}
                                  </span>
                                ))}
                              </div>
                            )}
                              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 leading-relaxed whitespace-pre-wrap border border-zinc-200/60 dark:border-zinc-800 select-text">
                                {msg.reasoning}
                              </p>
                              </>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2 text-[11px] dark:border-zinc-800">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveImageUrl(msg.imageUrl || null);
                                if (msg.aspectRatio) setActiveRatio(msg.aspectRatio);
                              }}
                              className="font-medium px-2 py-1 rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer transition"
                            >
                              {isEn ? "View on Canvas" : "Tampilkan"}
                            </button>

                            {msg.responseId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveResponseId(msg.responseId || null);
                                  setActiveImageUrl(msg.imageUrl || null);
                                  textareaRef.current?.focus();
                                }}
                                className={`font-medium px-2 py-1 rounded-md border transition cursor-pointer ${
                                  activeResponseId === msg.responseId
                                    ? "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300 font-bold"
                                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-amber-500/40 hover:text-amber-600 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300 dark:hover:text-amber-400"
                                }`}
                              >
                                {activeResponseId === msg.responseId
                                  ? isEn
                                    ? "✓ Active Base"
                                    : "✓ Acuan Aktif"
                                  : isEn
                                  ? "Use as Revision Base"
                                  : "Jadikan Acuan Revisi"}
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              downloadStudioImage(
                                msg.imageUrl!,
                                "png",
                                msg.aspectRatio || "4:5"
                              )
                            }
                            className="font-semibold px-2 py-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 cursor-pointer transition"
                          >
                            {isEn ? "Download PNG" : "Unduh PNG"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {msg.text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Generating Indicator */}
          {isGenerating && (
            <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="h-4 w-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin shrink-0" />
                <span className="text-xs font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
                  {AGENTIC_REASONING_STEPS[reasoningStepIndex]}
                </span>
              </div>
              <div className="h-28 w-full rounded-xl border border-zinc-200/80 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/40 animate-pulse flex items-center justify-center">
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                  Synthesizing Meta Ad Visual...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 4. Bottom Omnibar Composer */}
        <div className="shrink-0 border-t border-zinc-200/80 bg-white/95 backdrop-blur-xl p-3 sm:p-4 dark:border-zinc-800/80 dark:bg-zinc-950/95 space-y-2">
          {/* Active Revision Base Banner */}
          {activeResponseId && (
            <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
              <span className="truncate">
                {isEn ? "Iterating from previous design..." : "Revisi dari desain acuan aktif..."}
              </span>
              <button
                type="button"
                onClick={() => setActiveResponseId(null)}
                className="font-bold text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-white cursor-pointer ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Attached Images Tray */}
          {(inputPrompt.trim() || attachedImages.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {isEn ? "Ad lock" : "Kunci iklan"}
              </span>
              {readiness.checks.map((check) => (
                <span
                  key={check.id}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    check.ok
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
                  }`}
                >
                  {checkLabel[check.id]}
                </span>
              ))}
            </div>
          )}

          {attachedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 p-1">
              {attachedImages.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={img}
                    alt="Attached Facade"
                    className="h-14 w-14 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAttachedImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-bold shadow-sm hover:bg-rose-500 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Composer Box */}
          <div className="flex flex-col rounded-2xl border border-zinc-200/90 bg-white shadow-sm focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20 dark:border-zinc-800 dark:bg-zinc-900/90 dark:focus-within:border-amber-500/60 dark:focus-within:ring-amber-500/20 transition">
            <textarea
              ref={textareaRef}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendPrompt();
                }
              }}
              onPaste={handlePaste}
              rows={2}
              placeholder={
                isEn
                  ? "Describe property unit (project name, price, promo DP, bedrooms, WhatsApp)..."
                  : "Tulis rincian properti (nama proyek, harga mulai, promo DP, spesifikasi, nomor WhatsApp)..."
              }
              disabled={isGenerating}
              className="w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder-zinc-500 leading-relaxed"
            />

            {/* Toolbar row inside composer */}
            <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2 dark:border-zinc-800/60">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files) handleFiles(e.target.files);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title={isEn ? "Attach property facade photo" : "Lampirkan foto fasad properti"}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition cursor-pointer shadow-2xs"
                >
                  <svg className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="hidden sm:inline">{isEn ? "Attach Facade" : "Foto Fasad"}</span>
                </button>
              </div>

              <button
                type="button"
                disabled={(!inputPrompt.trim() && attachedImages.length === 0) || isGenerating}
                onClick={() => handleSendPrompt()}
                className="btn-solar flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <div className="h-3 w-3 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin" />
                    <span>{isEn ? "Rendering..." : "Merender..."}</span>
                  </>
                ) : (
                  <>
                    <span>{isEn ? "Generate Ad" : "Buat Iklan Properti"}</span>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RIGHT COLUMN: Stage Canvas & History Strip
         ========================================================================= */}
      <div
        className={`${
          mobilePane === "canvas" ? "flex" : "hidden"
        } h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-zinc-100/70 dark:bg-zinc-950 lg:flex transition-colors`}
      >
        {/* Main Stage Canvas */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <CreativeCanvas
            imageUrl={activeImageUrl}
            referenceImageUrl={activeReferenceUrl}
            aspectRatio={activeRatio}
            isGenerating={isGenerating}
            onDownload={(fmt) => {
              if (activeImageUrl) {
                downloadStudioImage(activeImageUrl, fmt, activeRatio);
              }
            }}
          />
        </div>

        {/* Bottom History Strip (Shows when > 1 ad poster generated) */}
        {generatedHistory.length > 1 && (
          <div className="h-16 shrink-0 border-t border-zinc-200/80 bg-white/95 px-4 flex items-center gap-2.5 overflow-x-auto dark:border-zinc-800/80 dark:bg-zinc-900/90 backdrop-blur-md">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-1 shrink-0">
              {isEn ? "Ad Iterations:" : "Riwayat Versi:"}
            </span>
            {generatedHistory.map((item, idx) => {
              const isActive = activeImageUrl === item.imageUrl;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveImageUrl(item.imageUrl || null);
                    if (item.responseId) setActiveResponseId(item.responseId);
                    if (item.aspectRatio) setActiveRatio(item.aspectRatio);
                  }}
                  className={`relative h-11 w-11 rounded-lg overflow-hidden border shrink-0 transition-all cursor-pointer shadow-2xs ${
                    isActive
                      ? "border-amber-500 ring-2 ring-amber-500/40 scale-105"
                      : "border-zinc-200 dark:border-zinc-700 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={item.imageUrl}
                    alt={`Versi ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[9px] font-mono font-bold text-white">
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
