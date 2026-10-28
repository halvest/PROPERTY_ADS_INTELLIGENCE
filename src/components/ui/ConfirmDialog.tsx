"use client";

import React from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  description?: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  description,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  variant,
  isDestructive = false,
  isLoading = false,
}: ConfirmDialogProps) {
  const { dict } = useI18n();

  const finalMessage = description || message || "";
  const finalConfirmText = confirmText || confirmLabel || dict.common.confirm;
  const finalCancelText = cancelText || cancelLabel || dict.common.cancel;
  const isDanger = variant === "danger" || isDestructive;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="space-y-4">
        {finalMessage && (
          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {finalMessage}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {finalCancelText}
          </Button>

          <Button
            type="button"
            variant={isDanger ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {finalConfirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
