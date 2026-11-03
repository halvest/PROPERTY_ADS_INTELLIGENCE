"use client";

import React, { useState, useRef, useEffect } from "react";
import { CreativeCanvas } from "@/components/creative-studio/CreativeCanvas";
import { downloadStudioImage } from "@/components/creative-studio/export-utils";
import type { StudioAspectRatio } from "@/lib/ai/creative-studio/muse-provider";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface StudioMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  images?: string[];
  aspectRatio?: StudioAspectRatio;
  imageUrl?: string;
  responseId?: string;
  reasoning?: string;
  timestamp: number;
}

const RATIO_OPTIONS: StudioAspectRatio[] = [
  "auto",
  "1:1",
  "4:5",
  "2:3",
  "9:16",
  "16:9",
];

const SUGGESTED_PROMPTS_ID = [
  "Poster iklan minimalis modern dengan harga dan spesifikasi",
  "Suasana sore keemasan dengan tipografi elegan",
  "Tingkatkan kualitas foto dan ganti langit cerah",
];

const SUGGESTED_PROMPTS_EN = [
  "Modern minimalist ad poster with price and property specs",
  "Warm golden-hour atmosphere with elegant typography",
  "Enhance photo quality and replace with a clear bright sky",
];

export default function AIPropertyCreativeStudioPage() {
  const { locale } = useI18n();
  const isEn = locale === "en";

  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [activeReferenceUrl, setActiveReferenceUrl] = useState<string | null>(null);
  const [activeRatio, setActiveRatio] = useState<StudioAspectRatio>("4:5");
  const [activeResponseId, setActiveResponseId] = useState<string | null>(null);

  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedReasonings, setExpandedReasonings] = useState<Record<string, boolean>>({});
  const [mobilePane, setMobilePane] = useState<"chat" | "canvas">("chat");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll message list on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Handle image files to base64 Data URLs
  const handleFiles = (files: FileList | File[]) => {
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
          if (!activeReferenceUrl) {
            setActiveReferenceUrl(result);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

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
    if (!textToSend || isGenerating) return;

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
      timestamp: seq,
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
          data.error || (isEn ? "Failed to process image" : "Gagal memproses gambar")
        );
      }

      msgCounterRef.current += 1;
      const assistantSeq = msgCounterRef.current;
      const assistantMsg: StudioMessage = {
        id: `assistant_${assistantSeq}`,
        role: "assistant",
        text: isEn
          ? "Property design generated successfully."
          : "Desain properti berhasil dibuat.",
        imageUrl: data.imageUrl,
        responseId: data.responseId,
        reasoning: data.reasoning,
        aspectRatio: (data.aspectRatio as StudioAspectRatio) || userRatio,
        timestamp: assistantSeq,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setActiveImageUrl(data.imageUrl);
      setActiveResponseId(data.responseId);
      setMobilePane("canvas");
      if (userImages[0] && !activeReferenceUrl) {
        setActiveReferenceUrl(userImages[0]);
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : isEn
          ? "An error occurred while processing the image"
          : "Terjadi kesalahan saat memproses gambar";
      msgCounterRef.current += 1;
      const errSeq = msgCounterRef.current;
      const errorMsg: StudioMessage = {
        id: `err_${errSeq}`,
        role: "assistant",
        text: `${isEn ? "Error" : "Kesalahan"}: ${errMsg}`,
        timestamp: errSeq,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  const handleResetSession = () => {
    setMessages([]);
    setActiveImageUrl(null);
    setActiveReferenceUrl(null);
    setActiveResponseId(null);
    setAttachedImages([]);
    setInputPrompt("");
  };

  const toggleReasoning = (msgId: string) => {
    setExpandedReasonings((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // Collect history generations from assistant messages
  const generatedHistory = messages.filter(
    (m) => m.role === "assistant" && Boolean(m.imageUrl)
  );

  const suggestedPrompts = isEn ? SUGGESTED_PROMPTS_EN : SUGGESTED_PROMPTS_ID;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white font-sans dark:bg-neutral-950 lg:flex-row">
      <div className="grid shrink-0 grid-cols-2 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePane("chat")}
          className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${mobilePane === "chat" ? "border-neutral-950 text-neutral-950 dark:border-white dark:text-white" : "border-transparent text-neutral-500"}`}
        >
          {isEn ? "Chat" : "Instruksi"}
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("canvas")}
          className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${mobilePane === "canvas" ? "border-neutral-950 text-neutral-950 dark:border-white dark:text-white" : "border-transparent text-neutral-500"}`}
        >
          {isEn ? "Canvas" : "Kanvas"}
        </button>
      </div>
      {/* =========================================================================
          LEFT COLUMN: Minimalist Chat Panel (420px)
         ========================================================================= */}
      <div className={`${mobilePane === "chat" ? "flex" : "hidden"} h-full min-h-0 w-full min-w-0 flex-col border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:flex lg:w-[min(420px,38vw)] lg:shrink-0 lg:border-r`}>
        {/* 1. Minimal Header */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-3 dark:border-neutral-800 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              {isEn ? "AI Creative Studio" : "Studio Kreatif AI"}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              muse-image-1.0
            </span>
          </div>

          <button
            type="button"
            onClick={handleResetSession}
            className="shrink-0 cursor-pointer rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-white"
          >
            {isEn ? "New Session" : "Sesi Baru"}
          </button>
        </div>

        {/* 2. Message List */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col justify-start gap-3 py-2">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 px-1">
                {isEn
                  ? "Select or type a design instruction:"
                  : "Pilih atau ketik instruksi desain:"}
              </span>
              <div className="space-y-2">
                {suggestedPrompts.map((promptText) => (
                  <button
                    key={promptText}
                    type="button"
                    onClick={() => handleSendPrompt(promptText)}
                    className="w-full text-left p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-xs text-neutral-800 dark:text-neutral-200 transition-all cursor-pointer"
                  >
                    {promptText}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                {msg.role === "user" ? (
                  <div className="bg-neutral-100 dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-100 rounded-xl p-3.5 space-y-2">
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.images.map((imgSrc, i) => (
                          <img
                            key={i}
                            src={imgSrc}
                            alt={isEn ? "Attachment" : "Lampiran"}
                            className="w-14 h-14 object-cover rounded-md border border-neutral-200 dark:border-neutral-700"
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span>{isEn ? "Design Instruction" : "Instruksi Desain"}</span>
                      {msg.aspectRatio && (
                        <span className="font-mono uppercase font-medium">
                          {msg.aspectRatio === "auto"
                            ? isEn
                              ? "AUTO"
                              : "OTOMATIS"
                            : msg.aspectRatio}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap font-normal">
                      {msg.text}
                    </p>
                  </div>
                ) : (
                  <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-xl p-3.5 space-y-3 shadow-xs">
                    {msg.imageUrl ? (
                      <div className="space-y-2.5">
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
                          className="relative group rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-950 flex items-center justify-center cursor-pointer aspect-video max-h-48"
                        >
                          <img
                            src={msg.imageUrl}
                            alt={isEn ? "AI Output" : "Hasil AI"}
                            className="max-h-full max-w-full object-contain"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[11px] font-medium text-white px-2.5 py-1 rounded bg-black/60 border border-white/20">
                              {isEn ? "Show on Canvas" : "Tampilkan di Kanvas"}
                            </span>
                          </div>
                        </div>

                        {/* Reasoning summary collapsible */}
                        {msg.reasoning && (
                          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-2">
                            <button
                              type="button"
                              onClick={() => toggleReasoning(msg.id)}
                              className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center justify-between w-full cursor-pointer"
                            >
                              <span>{isEn ? "AI Notes" : "Catatan AI"}</span>
                              <span className="text-[10px]">
                                {expandedReasonings[msg.id]
                                  ? isEn
                                    ? "Hide"
                                    : "Tutup"
                                  : isEn
                                  ? "View"
                                  : "Lihat"}
                              </span>
                            </button>
                            {expandedReasonings[msg.id] && (
                              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1.5 p-2 rounded bg-neutral-50 dark:bg-neutral-800/50 leading-relaxed whitespace-pre-wrap">
                                {msg.reasoning}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-1 text-[11px] dark:border-neutral-800">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveImageUrl(msg.imageUrl || null);
                                if (msg.aspectRatio) setActiveRatio(msg.aspectRatio);
                              }}
                              className="font-medium text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white cursor-pointer"
                            >
                              {isEn ? "View" : "Tampilkan"}
                            </button>
                            <span className="text-neutral-300 dark:text-neutral-700">|</span>
                            {msg.responseId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveResponseId(msg.responseId || null);
                                  setActiveImageUrl(msg.imageUrl || null);
                                }}
                                className={`font-medium cursor-pointer ${
                                  activeResponseId === msg.responseId
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white"
                                }`}
                              >
                                {activeResponseId === msg.responseId
                                  ? isEn
                                    ? "Active Reference"
                                    : "Acuan Aktif"
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
                            className="font-medium text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white cursor-pointer"
                          >
                            {isEn ? "Download" : "Unduh"}
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

          {isGenerating && (
            <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-neutral-800 dark:border-t-white rounded-full animate-spin" />
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  {isEn
                    ? "Processing design instruction..."
                    : "Memproses instruksi desain..."}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. Bottom Chat Input Bar */}
        <div className="shrink-0 space-y-2 border-t border-neutral-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-neutral-800 dark:bg-neutral-900">
          {/* Active Revision Indicator */}
          {activeResponseId && (
            <div className="flex items-center justify-between px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400">
              <span className="truncate">
                {isEn
                  ? "Continuing from previous result"
                  : "Melanjutkan dari hasil sebelumnya"}
              </span>
              <button
                type="button"
                onClick={() => setActiveResponseId(null)}
                className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-medium ml-2 cursor-pointer"
              >
                {isEn ? "Clear" : "Lepas"}
              </button>
            </div>
          )}

          {/* Attached Images Strip */}
          {attachedImages.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {attachedImages.map((imgData, idx) => (
                <div
                  key={idx}
                  className="relative w-12 h-12 rounded-md overflow-hidden border border-neutral-200 dark:border-neutral-700 shrink-0 group"
                >
                  <img
                    src={imgData}
                    alt={isEn ? "Upload Preview" : "Pratinjau Unggahan"}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAttachedImages((prev) =>
                        prev.filter((_, i) => i !== idx)
                      )
                    }
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 hover:bg-black text-white rounded-full flex items-center justify-center text-[10px] cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Ratio Selector Row */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {RATIO_OPTIONS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setActiveRatio(ratio)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium uppercase transition-colors cursor-pointer whitespace-nowrap ${
                  activeRatio === ratio
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                {ratio === "auto" ? (isEn ? "auto" : "otomatis") : ratio}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="flex items-end gap-1.5 rounded-xl border border-neutral-200 bg-white p-2 transition-colors focus-within:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:focus-within:border-neutral-500 sm:gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={isEn ? "Attach Image" : "Tambah Gambar"}
              className="p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.37l-9.88 9.88a1.5 1.5 0 01-2.122-2.122l8.82-8.82"
                />
              </svg>
            </button>

            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={2}
              placeholder={
                isEn
                  ? "Type a design instruction..."
                  : "Ketik instruksi desain..."
              }
              disabled={isGenerating}
              className="flex-1 bg-transparent border-0 resize-none text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-0 leading-relaxed py-1"
            />

            <button
              type="button"
              disabled={!inputPrompt.trim() || isGenerating}
              onClick={() => handleSendPrompt()}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-neutral-900 px-2.5 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 sm:px-3"
            >
              <span className="hidden min-[380px]:inline">
                {isEn ? "Generate" : "Buat Desain"}
              </span>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RIGHT COLUMN: Canvas Stage & History Strip
         ========================================================================= */}
      <div className={`${mobilePane === "canvas" ? "flex" : "hidden"} h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-neutral-950 lg:flex`}>
        {/* Main Stage */}
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

        {/* Bottom History Strip (Visible when > 1 image generated in session) */}
        {generatedHistory.length > 1 && (
          <div className="h-16 px-4 border-t border-neutral-800 bg-neutral-900/80 flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-[11px] font-mono text-neutral-400 uppercase mr-2">
              {isEn ? "History" : "Riwayat"}
            </span>
            {generatedHistory.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveImageUrl(item.imageUrl || null);
                  if (item.responseId) setActiveResponseId(item.responseId);
                  if (item.aspectRatio) setActiveRatio(item.aspectRatio);
                }}
                className={`relative w-11 h-11 rounded-md overflow-hidden border shrink-0 transition-all cursor-pointer ${
                  activeImageUrl === item.imageUrl
                    ? "border-white ring-1 ring-white"
                    : "border-neutral-700 opacity-60 hover:opacity-100"
                }`}
              >
                <img
                  src={item.imageUrl}
                  alt={`${isEn ? "Version" : "Versi"} ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0.5 right-0.5 text-[9px] font-mono px-1 rounded bg-black/80 text-white font-bold">
                  {idx + 1}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

