"use client";

/**
 * CH-666 (11 Nov): a call's recording plays inside the portal, with back /
 * forward, a seek bar and speed - instead of opening the file in another
 * browser tab to move through it.
 *
 * 12 Nov: "put this box in the bottom right-hand corner, near the chat box" -
 * a small player docked bottom right, next to the support chat button. It
 * does not cover the page: the list stays usable, and play on another call
 * switches the player to that call.
 */
import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";

import { RecordingPlayer } from "@/components/reports/call-panel-parts";
import { useTranslation } from "@/hooks/use-translation";

export interface RecordingToPlay {
  url: string;
  /** e.g. "19709843996 → +18774894093". */
  subtitle?: string;
}

export function RecordingDialog({
  recording,
  onClose,
}: {
  recording: RecordingToPlay | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  // Esc closes it, as a pop-up would.
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording, onClose]);

  if (!recording) return null;
  return (
    <div
      role="dialog"
      aria-label={t("x666.title")}
      // Left of the support chat button (right-4 / sm:right-6, bottom-4 /
      // sm:bottom-6, 3rem wide); on a phone, above it.
      className="fixed inset-x-4 bottom-20 z-40 overflow-hidden rounded-xl border bg-card pb-4 text-card-foreground shadow-xl sm:inset-x-auto sm:bottom-6 sm:right-24 sm:w-[420px]"
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {t("x666.title")}
            <a
              href={recording.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("x666.newTab")}
              title={t("x666.newTab")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          {recording.subtitle && (
            <div className="truncate font-mono text-xs text-muted-foreground">{recording.subtitle}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("x666.close")}
          title={t("x666.close")}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* key: a new call starts its own player from 0:00. */}
      <RecordingPlayer key={recording.url} url={recording.url} autoPlay />
    </div>
  );
}
