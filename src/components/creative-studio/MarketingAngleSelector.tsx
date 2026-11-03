"use client";

import React, { useState } from "react";
import {
  MARKETING_ANGLES,
  ANGLE_CLUSTERS,
  type AngleCluster,
  type MarketingAngleTemplate,
} from "@/lib/ai/creative-studio/marketing-angles";

interface MarketingAngleSelectorProps {
  selectedAngleId: string;
  onSelectAngle: (angle: MarketingAngleTemplate) => void;
}

export function MarketingAngleSelector({
  selectedAngleId,
  onSelectAngle,
}: MarketingAngleSelectorProps) {
  const [activeCluster, setActiveCluster] = useState<AngleCluster>("conversion");
  const [isOpenModal, setIsOpenModal] = useState(false);

  const selectedTemplate =
    MARKETING_ANGLES.find((a) => a.id === selectedAngleId) || MARKETING_ANGLES[0];

  const clusterAngles = MARKETING_ANGLES.filter((a) => a.cluster === activeCluster);

  return (
    <div className="space-y-3">
      {/* Active Angle Summary Pill & Change Trigger */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40">
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
            style={{ backgroundColor: `${selectedTemplate.recommendedColorPalette.accent}20` }}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedTemplate.recommendedColorPalette.accent }}
            />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {selectedTemplate.name}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {ANGLE_CLUSTERS.find((c) => c.id === selectedTemplate.cluster)?.label}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
              {selectedTemplate.tagline}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpenModal(true)}
          className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-500 px-3 py-1.5 rounded-lg border border-sky-500/30 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-all shrink-0 cursor-pointer ml-2"
        >
          Ganti Sudut Pemasaran
        </button>
      </div>

      {/* Quick Horizontal Carousel of Popular Angles */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {MARKETING_ANGLES.slice(0, 5).map((angle) => {
          const isSelected = angle.id === selectedAngleId;
          return (
            <button
              key={angle.id}
              type="button"
              onClick={() => onSelectAngle(angle)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                isSelected
                  ? "bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400 shadow-2xs"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: angle.recommendedColorPalette.accent }}
              />
              <span>{angle.name}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setIsOpenModal(true)}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 whitespace-nowrap shrink-0"
        >
          +15 Lainnya...
        </button>
      </div>

      {/* Full 20 Templates Modal Selector */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in-50 duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600 dark:text-sky-400">
                  Marketing Angle Library
                </span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Pilih Sudut & Karakter Pemasaran Iklan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpenModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cluster Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-2 gap-1 overflow-x-auto">
              {ANGLE_CLUSTERS.map((cluster) => (
                <button
                  key={cluster.id}
                  type="button"
                  onClick={() => setActiveCluster(cluster.id)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCluster === cluster.id
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                  }`}
                >
                  <span>{cluster.icon}</span>
                  <span>{cluster.label}</span>
                </button>
              ))}
            </div>

            {/* Template Grid */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
              {clusterAngles.map((angle) => {
                const isSelected = angle.id === selectedAngleId;
                return (
                  <button
                    key={angle.id}
                    type="button"
                    onClick={() => {
                      onSelectAngle(angle);
                      setIsOpenModal(false);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? "border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/20 shadow-xs"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/40 dark:bg-zinc-950/30"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: angle.recommendedColorPalette.accent }}
                          />
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {angle.name}
                          </h4>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-md">
                            Dipilih
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                        {angle.tagline}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Target: {angle.targetAudience.slice(0, 28)}...</span>
                      <span className="font-bold text-zinc-600 dark:text-zinc-300">
                        CTA: {angle.ctaRecommendation}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

