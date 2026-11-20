"use client";

import React, { useState, useMemo } from "react";
import type { StudioConversation } from "@/lib/ai/creative-studio/types";
import { BrandLogo } from "@/components/ui/BrandLogo";

export interface StudioSidebarProps {
  conversations: StudioConversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onOpenMemoryModal: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export function StudioSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onTogglePin,
  onOpenMemoryModal,
  isOpen,
  onCloseMobile,
}: StudioSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const pinnedConversations = useMemo(
    () => filtered.filter((c) => c.is_pinned),
    [filtered]
  );

  const recentConversations = useMemo(
    () => filtered.filter((c) => !c.is_pinned),
    [filtered]
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex w-72 flex-col border-r border-zinc-200/80 bg-zinc-50/95 text-zinc-900 transition-transform duration-300 dark:border-zinc-800/80 dark:bg-zinc-950/95 dark:text-zinc-100 lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/80 p-3.5 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="sm" priority />
            <div className="flex flex-col">
              <span className="text-xs font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
                Creative Studio
              </span>
              <span className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
                Generative AI Workspace
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 lg:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action Button: New Chat */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              onNewConversation();
              onCloseMobile();
            }}
            className="btn-solar flex w-full items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold shadow-xs active:scale-[0.99] cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Mulai Percakapan Baru</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-3 pb-2">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Cari percakapan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-200/90 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-amber-400 shadow-2xs"
            />
          </div>
        </div>

        {/* Conversation List Feed */}
        <div className="flex-1 space-y-4 overflow-y-auto px-3 py-2 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800">
          {/* Pinned Section */}
          {pinnedConversations.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <svg className="h-3 w-3 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 4v2h-1v4l2 3v2h-6v6l-1 1-1-1v-6H3v-2l2-3V6H4V4h12z" />
                </svg>
                <span>Disematkan</span>
              </div>
              <div className="space-y-1">
                {pinnedConversations.map((c) => (
                  <ConversationItem
                    key={c.id}
                    convo={c}
                    isActive={c.id === activeConversationId}
                    onSelect={() => {
                      onSelectConversation(c.id);
                      onCloseMobile();
                    }}
                    onTogglePin={() => onTogglePin(c.id, !c.is_pinned)}
                    onDelete={() => onDeleteConversation(c.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent Section */}
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <span>Riwayat Percakapan</span>
            </div>
            {recentConversations.length === 0 && pinnedConversations.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                {searchQuery ? "Tidak ada hasil pencarian" : "Belum ada percakapan"}
              </div>
            ) : (
              <div className="space-y-1">
                {recentConversations.map((c) => (
                  <ConversationItem
                    key={c.id}
                    convo={c}
                    isActive={c.id === activeConversationId}
                    onSelect={() => {
                      onSelectConversation(c.id);
                      onCloseMobile();
                    }}
                    onTogglePin={() => onTogglePin(c.id, !c.is_pinned)}
                    onDelete={() => onDeleteConversation(c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Utility Bar: Memory & Settings */}
        <div className="shrink-0 border-t border-zinc-200/80 p-3 space-y-1 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={onOpenMemoryModal}
            className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <span>Creative Memory</span>
            </div>
            <span className="rounded-md bg-zinc-200/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              Context
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

function ConversationItem({
  convo,
  isActive,
  onSelect,
  onTogglePin,
  onDelete,
}: {
  convo: StudioConversation;
  isActive: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition cursor-pointer ${
        isActive
          ? "bg-white text-zinc-950 font-semibold shadow-xs border border-zinc-200 dark:bg-zinc-900 dark:text-white dark:border-zinc-700/80"
          : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <svg
          className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-amber-500" : "text-zinc-400 dark:text-zinc-500"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span className="truncate">{convo.title || "Percakapan"}</span>
      </div>

      {/* Hover action buttons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          title={convo.is_pinned ? "Lepas sematan" : "Sematkan"}
          className="rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-amber-500"
        >
          <svg className="h-3 w-3" fill={convo.is_pinned ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4v2h-1v4l2 3v2h-6v6l-1 1-1-1v-6H3v-2l2-3V6H4V4h12z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Hapus percakapan ini?")) {
              onDelete();
            }
          }}
          title="Hapus percakapan"
          className="rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-rose-500"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
