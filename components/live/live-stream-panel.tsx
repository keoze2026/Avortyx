/**
 * LiveStreamPanel — bracket-wrapped container around the live call feed.
 * Keeps the existing LiveCallCard but presents the in-flight + history
 * stacks as two distinct numbered sections.
 */

"use client";

import { AnimatePresence } from "framer-motion";
import { Inbox } from "lucide-react";

import { LiveCallCard } from "@/components/live/live-call-card";
import { BracketCard } from "@/components/shared/bracket-card";
import { SectionLabel } from "@/components/shared/section-label";
import { useTranslation } from "@/hooks/use-translation";
import type { Call } from "@/lib/types";

interface LiveStreamPanelProps {
  inFlight: Call[];
  history: Call[];
  /** Manual hang-up for an in-flight card (see useLiveSocket().hangup). */
  onHangup?: (id: string) => Promise<string | undefined>;
}

export function LiveStreamPanel({ inFlight, history, onHangup }: LiveStreamPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <BracketCard>
        <SectionLabel
          index={1}
          title={t("liveUI.stream.inFlight")}
          meta={t("liveUI.stream.activeSuffix").replace("{n}", String(inFlight.length))}
          action={
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-count-tick" />
              {t("liveUI.stream.streaming")}
            </span>
          }
        />
        <div className="relative min-h-[160px]">
          {inFlight.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-10 text-center text-muted-foreground">
              <Inbox className="h-5 w-5" />
              <p className="text-xs">{t("liveUI.stream.waiting")}</p>
            </div>
          )}
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {inFlight.map((c) => (
                <LiveCallCard key={c.id} call={c} isLive onHangup={onHangup} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </BracketCard>

      {history.length > 0 && (
        <BracketCard tone="muted">
          <SectionLabel
            index={2}
            title={t("liveUI.stream.recentlySettled")}
            meta={t("liveUI.stream.lastN").replace("{n}", String(Math.min(history.length, 8)))}
          />
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {history.slice(0, 8).map((c) => (
                <LiveCallCard key={c.id} call={c} isLive={false} />
              ))}
            </AnimatePresence>
          </div>
        </BracketCard>
      )}
    </div>
  );
}
