"use client";

/**
 * CH-666 (11 Nov): a call's recording in a pop-up inside the portal, with
 * back / forward, a seek bar and speed - instead of opening the file in
 * another browser tab to move through it.
 */
import { ExternalLink } from "lucide-react";

import { RecordingPlayer } from "@/components/reports/call-panel-parts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/use-translation";

export interface RecordingToPlay {
  url: string;
  /** e.g. "+1 309-912-2359 → +1 844-313-0226". */
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
  return (
    <Dialog open={recording != null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="gap-0 px-0 pb-5 sm:max-w-xl">
        <DialogHeader className="px-5">
          <DialogTitle className="flex items-center gap-2">
            {t("x666.title")}
            {recording && (
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
            )}
          </DialogTitle>
          {recording?.subtitle && (
            <DialogDescription className="font-mono text-xs">{recording.subtitle}</DialogDescription>
          )}
        </DialogHeader>
        {/* key: a new call starts its own player from 0:00. */}
        {recording && <RecordingPlayer key={recording.url} url={recording.url} autoPlay />}
      </DialogContent>
    </Dialog>
  );
}
